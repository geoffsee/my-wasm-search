import { Component, Container as Service } from 'di-framework/decorators';
import { cosine_similarity } from 'wasm-similarity';
import type { SearchResult, DocumentData } from '../models';
import { EmbeddingPort } from '../ports/EmbeddingPort';
import { DocumentStore } from '../ports/DocumentStore';

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

    const results: SearchResult[] = [];

    for (const [docId, docData] of docsToSearch) {
      for (const vectorRecord of docData.vectorRecords) {
        const sim = cosine_similarity(queryVector, new Float64Array(vectorRecord.vector));
        const chunk = docData.textChunks.find((c) => c.id === vectorRecord.id);
        if (chunk) {
          results.push({
            id: vectorRecord.id,
            text: chunk.text,
            similarity: sim,
            documentId: docId,
          });
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
}
