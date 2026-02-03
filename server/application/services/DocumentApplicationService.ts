import { Component, Container as Service } from 'di-framework/decorators';
import type { DocumentData } from '../../domain/models';
import { DocumentStore } from '../../domain/ports/DocumentStore';

@Service()
export class DocumentApplicationService {
  private store: DocumentStore;

  constructor(
    @Component('DocumentStore') store: DocumentStore,
  ) {
    this.store = store;
  }

  loadDocument(id: string, data: DocumentData): void {
    this.store.save(id, data);
  }

  listDocuments(): Array<{ id: string; chunkCount: number }> {
    return this.store.getAll().map(([docId, docData]) => ({
      id: docId,
      chunkCount: docData.textChunks.length,
    }));
  }

  getDocumentsToSearch(documentId?: string): Array<[string, DocumentData]> {
    if (documentId) {
      if (!this.store.exists(documentId)) return [];
      const doc = this.store.find(documentId);
      return doc ? [[documentId, doc]] : [];
    }
    return this.store.getAll();
  }

  getDocument(id: string): DocumentData | undefined {
    return this.store.find(id);
  }
}
