export interface TextChunk {
  id: string;
  text: string;
}

export interface VectorRecord {
  id: string;
  vector: number[];
}

export interface DocumentData {
  textChunks: TextChunk[];
  vectorRecords: VectorRecord[];
}

export interface SearchResult {
  id: string;
  text: string;
  similarity: number;
  documentId: string;
  semanticScore?: number;
  keywordScore?: number;
}

export type SearchMode = 'semantic' | 'keyword' | 'hybrid';
