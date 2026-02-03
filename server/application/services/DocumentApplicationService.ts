import { Component, Container as Service } from 'di-framework/decorators';
import type { DocumentData } from '../../domain/models';
import { DocumentStore } from '../../domain/ports/DocumentStore';

@Service()
export class DocumentApplicationService {
  private store: DocumentStore;

  constructor(@Component('DocumentStore') store: DocumentStore) {
    this.store = store;
  }

  async loadDocument(id: string, data: DocumentData): Promise<void> {
    await this.store.save(id, data);
  }

  async listDocuments(): Promise<Array<{ id: string; chunkCount: number }>> {
    const docs = await this.store.getAll();
    return docs.map(([docId, docData]) => ({
      id: docId,
      chunkCount: docData.textChunks.length,
    }));
  }

  async getDocumentsToSearch(documentId?: string): Promise<Array<[string, DocumentData]>> {
    if (documentId) {
      const exists = await this.store.exists(documentId);
      if (!exists) return [];
      const doc = await this.store.find(documentId);
      return doc ? [[documentId, doc]] : [];
    }
    return this.store.getAll();
  }

  async getDocument(id: string): Promise<DocumentData | undefined> {
    return this.store.find(id);
  }
}
