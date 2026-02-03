export interface TextChunk {
  id: string;
  text: string;
}

export interface VectorRecord {
  id: string;
  vector: number[];
}

export interface DocumentData {
  title?: string;
  textChunks: TextChunk[];
  vectorRecords: VectorRecord[];
}

export interface NeighborChunks {
  prev?: string;
  next?: string;
}

export interface SearchResult {
  id: string;
  text: string;
  similarity: number;
  documentId: string;
  semanticScore?: number;
  keywordScore?: number;
  rank: number;
  chunkIndex: number;
  totalChunks: number;
  documentTitle?: string;
  highlights: string[];
  neighborChunks: NeighborChunks;
}

export type SearchMode = 'semantic' | 'keyword' | 'hybrid';
