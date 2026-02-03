import { Component, Container as Service } from 'di-framework/decorators';
import { cosine_similarity_dataspace, jaccard_index } from 'wasm-similarity';
import type { SearchResult, DocumentData, SearchMode } from '../models';
import { EmbeddingPort } from '../ports/EmbeddingPort';
import { DocumentStore } from '../ports/DocumentStore';

interface VectorMetadata {
  docId: string;
  docTitle?: string;
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  prevChunkId?: string;
  nextChunkId?: string;
}

interface ScoredCandidate {
  idx: number;
  semanticScore: number;
  keywordScore: number;
  rrfScore: number;
}

function tokenize(text: string): Int32Array {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const uniqueHashes = new Set<number>();
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    uniqueHashes.add(hash);
  }
  return new Int32Array([...uniqueHashes]);
}

function tokenizeToStrings(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function extractHighlights(text: string, query: string): string[] {
  const queryTokens = new Set(tokenizeToStrings(query));
  const textTokens = tokenizeToStrings(text);
  const matches = textTokens.filter((t) => queryTokens.has(t));
  return [...new Set(matches)];
}

function reciprocalRankFusion(
  semanticRanks: Map<number, number>,
  keywordRanks: Map<number, number>,
  k: number = 60,
): Map<number, number> {
  const scores = new Map<number, number>();
  const allIndices = new Set([...semanticRanks.keys(), ...keywordRanks.keys()]);

  for (const idx of allIndices) {
    const semanticRank = semanticRanks.get(idx) ?? Infinity;
    const keywordRank = keywordRanks.get(idx) ?? Infinity;
    const rrf = 1 / (k + semanticRank) + 1 / (k + keywordRank);
    scores.set(idx, rrf);
  }
  return scores;
}

@Service()
export class SearchService {
  private embeddingService: EmbeddingPort;
  private documentStore: DocumentStore;

  constructor(
    @Component('EmbeddingPort') embeddingService: EmbeddingPort,
    @Component('DocumentStore') documentStore: DocumentStore,
  ) {
    this.embeddingService = embeddingService;
    this.documentStore = documentStore;
  }

  async search(
    query: string,
    topK: number,
    documentId?: string,
    mode: SearchMode = 'semantic',
  ): Promise<SearchResult[]> {
    let docsToSearch: Array<[string, DocumentData]>;
    if (documentId) {
      const doc = await this.documentStore.find(documentId);
      docsToSearch = doc ? [[documentId, doc]] : [];
    } else {
      docsToSearch = await this.documentStore.getAll();
    }

    const metadata: VectorMetadata[] = [];
    const vectors: number[] = [];
    let dim = 0;

    for (const [docId, docData] of docsToSearch) {
      const totalChunks = docData.textChunks.length;
      const chunkIdToIndex = new Map<string, number>();
      docData.textChunks.forEach((chunk, idx) => chunkIdToIndex.set(chunk.id, idx));

      for (const vectorRecord of docData.vectorRecords) {
        const chunkIndex = chunkIdToIndex.get(vectorRecord.id);
        if (chunkIndex === undefined) continue;

        const chunk = docData.textChunks[chunkIndex];
        const prevChunk = chunkIndex > 0 ? docData.textChunks[chunkIndex - 1] : undefined;
        const nextChunk =
          chunkIndex < totalChunks - 1 ? docData.textChunks[chunkIndex + 1] : undefined;

        metadata.push({
          docId,
          docTitle: docData.title,
          chunkId: vectorRecord.id,
          chunkIndex,
          totalChunks,
          text: chunk.text,
          prevChunkId: prevChunk?.id,
          nextChunkId: nextChunk?.id,
        });
        vectors.push(...vectorRecord.vector);
        dim = vectorRecord.vector.length;
      }
    }

    if (metadata.length === 0) {
      return [];
    }

    if (mode === 'keyword') {
      return this.keywordSearch(query, topK, metadata);
    }

    const queryVector = await this.embeddingService.embed(query);

    if (mode === 'semantic') {
      return this.semanticSearch(query, queryVector, topK, metadata, vectors, dim);
    }

    return this.hybridSearch(query, queryVector, topK, metadata, vectors, dim);
  }

  private semanticSearch(
    query: string,
    queryVector: Float64Array,
    topK: number,
    metadata: VectorMetadata[],
    vectors: number[],
    dim: number,
  ): SearchResult[] {
    const flatVectors = new Float64Array(vectors);
    const rankings = cosine_similarity_dataspace(flatVectors, metadata.length, dim, queryVector);

    const results: SearchResult[] = [];
    const limit = Math.min(topK, rankings.length / 2);

    for (let i = 0; i < limit; i++) {
      const similarity = rankings[i * 2];
      const idx = rankings[i * 2 + 1];
      const meta = metadata[idx];
      results.push({
        id: meta.chunkId,
        text: meta.text,
        similarity,
        semanticScore: similarity,
        documentId: meta.docId,
        rank: i + 1,
        chunkIndex: meta.chunkIndex,
        totalChunks: meta.totalChunks,
        documentTitle: meta.docTitle,
        highlights: extractHighlights(meta.text, query),
        neighborChunks: {
          prev: meta.prevChunkId,
          next: meta.nextChunkId,
        },
      });
    }

    return results;
  }

  private keywordSearch(query: string, topK: number, metadata: VectorMetadata[]): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const scored: Array<{ idx: number; score: number }> = [];

    for (let i = 0; i < metadata.length; i++) {
      const chunkTokens = tokenize(metadata[i].text);
      if (chunkTokens.length === 0) continue;
      const score = jaccard_index(queryTokens, chunkTokens);
      if (score > 0) {
        scored.push({ idx: i, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(({ idx, score }, rank) => {
      const meta = metadata[idx];
      return {
        id: meta.chunkId,
        text: meta.text,
        similarity: score,
        keywordScore: score,
        documentId: meta.docId,
        rank: rank + 1,
        chunkIndex: meta.chunkIndex,
        totalChunks: meta.totalChunks,
        documentTitle: meta.docTitle,
        highlights: extractHighlights(meta.text, query),
        neighborChunks: {
          prev: meta.prevChunkId,
          next: meta.nextChunkId,
        },
      };
    });
  }

  private hybridSearch(
    query: string,
    queryVector: Float64Array,
    topK: number,
    metadata: VectorMetadata[],
    vectors: number[],
    dim: number,
  ): SearchResult[] {
    const flatVectors = new Float64Array(vectors);
    const semanticRankings = cosine_similarity_dataspace(
      flatVectors,
      metadata.length,
      dim,
      queryVector,
    );

    const semanticScores = new Map<number, number>();
    const semanticRanks = new Map<number, number>();
    for (let i = 0; i < semanticRankings.length / 2; i++) {
      const score = semanticRankings[i * 2];
      const idx = semanticRankings[i * 2 + 1];
      semanticScores.set(idx, score);
      semanticRanks.set(idx, i + 1);
    }

    const queryTokens = tokenize(query);
    const keywordScored: Array<{ idx: number; score: number }> = [];

    for (let i = 0; i < metadata.length; i++) {
      const chunkTokens = tokenize(metadata[i].text);
      if (chunkTokens.length === 0 || queryTokens.length === 0) {
        keywordScored.push({ idx: i, score: 0 });
        continue;
      }
      const score = jaccard_index(queryTokens, chunkTokens);
      keywordScored.push({ idx: i, score });
    }

    keywordScored.sort((a, b) => b.score - a.score);
    const keywordScores = new Map<number, number>();
    const keywordRanks = new Map<number, number>();
    keywordScored.forEach(({ idx, score }, rank) => {
      keywordScores.set(idx, score);
      keywordRanks.set(idx, rank + 1);
    });

    const rrfScores = reciprocalRankFusion(semanticRanks, keywordRanks);

    const candidates: ScoredCandidate[] = [];
    for (const [idx, rrfScore] of rrfScores) {
      candidates.push({
        idx,
        semanticScore: semanticScores.get(idx) ?? 0,
        keywordScore: keywordScores.get(idx) ?? 0,
        rrfScore,
      });
    }

    candidates.sort((a, b) => b.rrfScore - a.rrfScore);

    return candidates.slice(0, topK).map((c, rank) => {
      const meta = metadata[c.idx];
      return {
        id: meta.chunkId,
        text: meta.text,
        similarity: c.rrfScore,
        semanticScore: c.semanticScore,
        keywordScore: c.keywordScore,
        documentId: meta.docId,
        rank: rank + 1,
        chunkIndex: meta.chunkIndex,
        totalChunks: meta.totalChunks,
        documentTitle: meta.docTitle,
        highlights: extractHighlights(meta.text, query),
        neighborChunks: {
          prev: meta.prevChunkId,
          next: meta.nextChunkId,
        },
      };
    });
  }
}
