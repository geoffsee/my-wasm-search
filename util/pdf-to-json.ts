import fs from "node:fs";
import path from "node:path";
import { encode, decode } from "gpt-tokenizer";
import { randomUUIDv7 } from "./uuid.js";
import OpenAI from "openai";
import { extractTextFromPdf } from "./extract-pdf-text.js";

export const CHUNK_SIZE = 500;
export const CHUNK_OVERLAP = 50;

export function chunkText(text: string): string[] {
  const tokens = encode(text);
  const chunks: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE, tokens.length);
    chunks.push(decode(tokens.slice(start, end)));
    if (end >= tokens.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export interface TextChunk {
  id: string;
  text: string;
}

export interface VectorRecord {
  id: string;
  vector: number[];
}

export interface PdfJsonOutput {
  textChunks: TextChunk[];
  vectorRecords: VectorRecord[];
}

export async function pdfToJson(
  pdfPath: string,
  openaiClient: OpenAI
): Promise<PdfJsonOutput> {
  const text = await extractTextFromPdf(pdfPath);

  const chunks = chunkText(text);
  const ids = chunks.map(() => randomUUIDv7());

  const response = await openaiClient.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
  });

  const textChunks = ids.map((id, i) => ({ id, text: chunks[i] }));
  const vectorRecords = response.data.map((item, i) => ({
    id: ids[i],
    vector: item.embedding,
  }));

  return { textChunks, vectorRecords };
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npm run pdf-to-json <pdf-path> [output-path]");
    process.exit(1);
  }

  const outputPath = process.argv[3] ?? pdfPath.replace(/\.pdf$/i, ".json");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const result = await pdfToJson(pdfPath, openai);

  console.log(`Extracted ${result.textChunks.length} chunks from PDF`);
  fs.writeFileSync(
    path.resolve(outputPath),
    JSON.stringify(result, null, 2)
  );
  console.log(`Written to ${outputPath}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "");
if (isMain) {
  main();
}
