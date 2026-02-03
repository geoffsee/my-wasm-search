import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { encode } from "gpt-tokenizer";

// Define mock function using vi.hoisted so it's available during vi.mock hoisting
const { mockExtract } = vi.hoisted(() => ({
  mockExtract: vi.fn<() => Promise<string>>(),
}));

// Mock the extract-pdf-text module so pdfjs-dist is never loaded
vi.mock("./extract-pdf-text.ts", () => ({
  extractTextFromPdf: mockExtract,
}));

import { chunkText, pdfToJson, CHUNK_SIZE, CHUNK_OVERLAP } from "./pdf-to-json.js";
import type { PdfJsonOutput } from "./pdf-to-json.js";
import type OpenAI from "openai";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const text = "Hello world";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("chunks long text into overlapping segments", () => {
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const totalTokens = encode(text).length;

    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 0; i < chunks.length - 1; i++) {
      expect(encode(chunks[i]).length).toBe(CHUNK_SIZE);
    }

    const lastTokenCount = encode(chunks[chunks.length - 1]).length;
    expect(lastTokenCount).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(lastTokenCount).toBeGreaterThan(0);

    const expectedChunks = Math.ceil(
      (totalTokens - CHUNK_OVERLAP) / (CHUNK_SIZE - CHUNK_OVERLAP)
    );
    expect(chunks.length).toBe(expectedChunks);
  });

  it("produces chunks that together cover all original text", () => {
    const words = Array.from({ length: 1500 }, (_, i) => `token${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text);

    expect(text.startsWith(chunks[0])).toBe(true);
    expect(text.endsWith(chunks[chunks.length - 1])).toBe(true);
  });

  it("handles text exactly at chunk boundary", () => {
    const exactText = "a ".repeat(1000).trim();
    const exactTokens = encode(exactText).length;

    if (exactTokens <= CHUNK_SIZE) {
      expect(chunkText(exactText)).toHaveLength(1);
    } else {
      expect(chunkText(exactText).length).toBeGreaterThan(1);
    }
  });
});

describe("pdfToJson", () => {
  const testPdfPath = path.resolve("test-data/test.pdf");

  it("extracts text, chunks it, and pairs IDs between textChunks and vectorRecords", async () => {
    const longText = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(" ");
    mockExtract.mockResolvedValueOnce(longText);

    const mockEmbeddings = { create: vi.fn() };
    const mockClient = { embeddings: mockEmbeddings } as unknown as OpenAI;

    mockEmbeddings.create.mockImplementation(
      async (params: { input: string[] }) => ({
        data: params.input.map((_: string, i: number) => ({
          embedding: Array.from({ length: 3 }, () => i * 0.1),
        })),
      })
    );

    const result: PdfJsonOutput = await pdfToJson(testPdfPath, mockClient);

    expect(result.textChunks.length).toBeGreaterThan(1);
    expect(result.vectorRecords.length).toBeGreaterThan(0);
    expect(result.textChunks.length).toBe(result.vectorRecords.length);

    // IDs match between textChunks and vectorRecords
    for (let i = 0; i < result.textChunks.length; i++) {
      expect(result.textChunks[i].id).toBe(result.vectorRecords[i].id);
    }

    // IDs are unique
    const ids = result.textChunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    // IDs are UUIDv7 format
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }

    // Each chunk has non-empty text
    for (const chunk of result.textChunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
    }

    // Each vector record has a vector array
    for (const record of result.vectorRecords) {
      expect(Array.isArray(record.vector)).toBe(true);
      expect(record.vector.length).toBeGreaterThan(0);
    }

    // OpenAI called once with all chunks batched
    expect(mockEmbeddings.create).toHaveBeenCalledOnce();
    expect(mockEmbeddings.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: expect.any(Array),
    });
  });

  it("produces correct output for short text", async () => {
    mockExtract.mockResolvedValueOnce("short text");

    const mockClient = {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
    } as unknown as OpenAI;

    const result = await pdfToJson(testPdfPath, mockClient);
    expect(result.textChunks).toHaveLength(1);
    expect(result.textChunks[0].text).toBe("short text");
    expect(result.vectorRecords[0].vector).toEqual([0.1, 0.2, 0.3]);
  });
});
