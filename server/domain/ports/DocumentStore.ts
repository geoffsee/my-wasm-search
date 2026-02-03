import type {DocumentData} from '../models';

export abstract class DocumentStore {
  abstract save(id: string, data: DocumentData): void;
  abstract find(id: string): DocumentData | undefined;
  abstract getAll(): Array<[string, DocumentData]>;
  abstract exists(id: string): boolean;
}
