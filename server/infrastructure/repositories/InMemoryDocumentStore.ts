import { Container as Service } from 'di-framework/decorators';
import type { DocumentData } from '../../domain/models';
import { DocumentStore } from '../../domain/ports/DocumentStore';

@Service()
export class InMemoryDocumentStore extends DocumentStore {
  private documents = new Map<string, DocumentData>();

  save(id: string, data: DocumentData): void {
    this.documents.set(id, data);
  }

  find(id: string): DocumentData | undefined {
    return this.documents.get(id);
  }

  getAll(): Array<[string, DocumentData]> {
    return Array.from(this.documents.entries());
  }

  exists(id: string): boolean {
    return this.documents.has(id);
  }
}
