import type { DocumentData } from '../models';

export abstract class DocumentStore {
  abstract save(id: string, data: DocumentData): void | Promise<void>;
  abstract find(id: string): DocumentData | undefined | Promise<DocumentData | undefined>;
  abstract getAll(): Array<[string, DocumentData]> | Promise<Array<[string, DocumentData]>>;
  abstract exists(id: string): boolean | Promise<boolean>;
}
