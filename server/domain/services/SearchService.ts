import { Component, Container as Service } from 'di-framework/decorators';
import { cosine_similarity_dataspace } from 'wasm-similarity';
import type { SearchResult, DocumentData } from '../models';
import { EmbeddingPort } from '../ports/EmbeddingPort';
import { DocumentStore } from '../ports/DocumentStore';

interface VectorMetadata {
  docId: string;
  chunkId: string;
  text: string;
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

  async search(query: string, topK: number, documentId?: string): Promise<SearchResult[]> {
    const queryVector = await this.embeddingService.embed(query);

    const docsToSearch: Array<[string, DocumentData]> = documentId
      ? (() => {
          const doc = this.documentStore.find(documentId);
          return doc ? [[documentId, doc]] : [];
        })()
      : this.documentStore.getAll();

    const metadata: VectorMetadata[] = [];
    const vectors: number[] = [];
    let dim = 0;

    for (const [docId, docData] of docsToSearch) {
      for (const vectorRecord of docData.vectorRecords) {
        const chunk = docData.textChunks.find((c) => c.id === vectorRecord.id);
        if (chunk) {
          metadata.push({ docId, chunkId: vectorRecord.id, text: chunk.text });
          vectors.push(...vectorRecord.vector);
          dim = vectorRecord.vector.length;
        }
      }
    }

    if (metadata.length === 0) {
      return [];
    }

    const flatVectors = new Float64Array(vectors);
    const rankings = cosine_similarity_dataspace(flatVectors, metadata.length, dim, queryVector);

    const results: SearchResult[] = [];
    const limit = Math.min(topK, metadata.length);

    for (let i = 0; i < limit; i++) {
      const similarity = rankings[i * 2];
      const idx = rankings[i * 2 + 1];
      const meta = metadata[idx];
      results.push({
        id: meta.chunkId,
        text: meta.text,
        similarity,
        documentId: meta.docId,
      });
    }

    return results;
  }
}
