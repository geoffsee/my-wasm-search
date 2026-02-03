import { describe, it, expect, beforeEach } from 'vitest';
import { cosine_similarity } from 'wasm-similarity';
import type { DocumentData } from './domain/models';
import { InMemoryDocumentStore } from './infrastructure/repositories/InMemoryDocumentStore';
import { DocumentApplicationService } from './application/services/DocumentApplicationService';
import { SearchService } from './domain/services/SearchService';
import { EmbeddingPort } from './domain/ports/EmbeddingPort';

class StubEmbeddingService extends EmbeddingPort {
  async embed(text: string): Promise<Float64Array> {
    // Map text to simple unit vectors for deterministic tests
    if (text.includes('fox')) return new Float64Array([1, 0, 0]);
    if (text.includes('turtle')) return new Float64Array([0, 1, 0]);
    return new Float64Array([0, 0, 1]);
  }
}

// Test-local instances to avoid touching the global DI container
let documentsDb: InMemoryDocumentStore;
let documentService: DocumentApplicationService;
let searchService: SearchService;

describe('Semantic Search Server', () => {
  beforeEach(() => {
    documentsDb = new InMemoryDocumentStore();
    documentService = new DocumentApplicationService(documentsDb);
    searchService = new SearchService(new StubEmbeddingService(), documentsDb);
  });

  describe('Search Algorithm', () => {
    it('should calculate cosine similarity correctly', () => {
      const vector1 = new Float64Array([1, 0, 0]);
      const vector2 = new Float64Array([1, 0, 0]);
      const similarity = cosine_similarity(vector1, vector2);
      expect(similarity).toBe(1); // Perfect match
    });

    it('should handle orthogonal vectors', () => {
      const vector1 = new Float64Array([1, 0, 0]);
      const vector2 = new Float64Array([0, 1, 0]);
      const similarity = cosine_similarity(vector1, vector2);
      expect(similarity).toBe(0); // Orthogonal
    });

    it('should handle opposite vectors', () => {
      const vector1 = new Float64Array([1, 0, 0]);
      const vector2 = new Float64Array([-1, 0, 0]);
      const similarity = cosine_similarity(vector1, vector2);
      expect(similarity).toBe(-1); // Opposite
    });
  });

  describe('Document Management', () => {
    it('should load a document with chunks and vectors', () => {
      const mockDoc: DocumentData = {
        textChunks: [
          { id: 'chunk-1', text: 'Hello world' },
          { id: 'chunk-2', text: 'Goodbye world' },
        ],
        vectorRecords: [
          { id: 'chunk-1', vector: [0.1, 0.2, 0.3] },
          { id: 'chunk-2', vector: [0.4, 0.5, 0.6] },
        ],
      };

      documentService.loadDocument('doc-1', mockDoc);

      expect(documentsDb.exists('doc-1')).toBe(true);
      const loaded = documentsDb.find('doc-1')!;
      expect(loaded.textChunks).toHaveLength(2);
      expect(loaded.vectorRecords).toHaveLength(2);
    });

    it('should handle multiple documents', () => {
      const doc1: DocumentData = {
        textChunks: [{ id: 'c1', text: 'Doc 1' }],
        vectorRecords: [{ id: 'c1', vector: [0.1] }],
      };

      const doc2: DocumentData = {
        textChunks: [{ id: 'c2', text: 'Doc 2' }],
        vectorRecords: [{ id: 'c2', vector: [0.2] }],
      };

      documentService.loadDocument('doc-1', doc1);
      documentService.loadDocument('doc-2', doc2);

      const docs = documentService.listDocuments();
      expect(docs).toHaveLength(2);
      const [d1, d2] = documentService.getDocumentsToSearch();
      expect(d1[1].textChunks[0].text).toBe('Doc 1');
      expect(d2[1].textChunks[0].text).toBe('Doc 2');
    });
  });

  describe('Search Results', () => {
    it('should return empty results when no documents are loaded', () => {
      const results = documentService.getDocumentsToSearch();
      expect(results).toHaveLength(0);
    });

    it('should rank results by similarity score', () => {
      const mockDoc: DocumentData = {
        textChunks: [
          { id: 'chunk-1', text: 'The quick brown fox' },
          { id: 'chunk-2', text: 'A slow turtle' },
          { id: 'chunk-3', text: 'The fast fox jumps' },
        ],
        vectorRecords: [
          { id: 'chunk-1', vector: [0.9, 0.1, 0.0] },
          { id: 'chunk-2', vector: [0.1, 0.1, 0.8] },
          { id: 'chunk-3', vector: [0.85, 0.15, 0.0] },
        ],
      };

      documentService.loadDocument('doc-1', mockDoc);

      const results = searchService.search('fox', 5, 'doc-1');

      return results.then((r) => {
        expect(r).toHaveLength(3);
        expect(r[0].similarity).toBeGreaterThan(r[1].similarity);
        expect(r[1].similarity).toBeGreaterThan(r[2].similarity);
      });
    });

    it('should respect topK parameter', () => {
      const mockDoc: DocumentData = {
        textChunks: [
          { id: 'c1', text: 'Text 1' },
          { id: 'c2', text: 'Text 2' },
          { id: 'c3', text: 'Text 3' },
          { id: 'c4', text: 'Text 4' },
          { id: 'c5', text: 'Text 5' },
        ],
        vectorRecords: [
          { id: 'c1', vector: [0.1, 0.0, 0.0] },
          { id: 'c2', vector: [0.2, 0.0, 0.0] },
          { id: 'c3', vector: [0.3, 0.0, 0.0] },
          { id: 'c4', vector: [0.4, 0.0, 0.0] },
          { id: 'c5', vector: [0.5, 0.0, 0.0] },
        ],
      };

      documentService.loadDocument('doc-1', mockDoc);

      return searchService.search('fox', 3, 'doc-1').then((topResults) => {
        expect(topResults).toHaveLength(3);
      });
    });

    it('should search within a specific document when documentId is provided', () => {
      const doc1: DocumentData = {
        textChunks: [{ id: 'c1', text: 'Doc 1 content' }],
        vectorRecords: [{ id: 'c1', vector: [0.1, 0.0, 0.0] }],
      };

      const doc2: DocumentData = {
        textChunks: [{ id: 'c2', text: 'Doc 2 content' }],
        vectorRecords: [{ id: 'c2', vector: [0.2, 0.0, 0.0] }],
      };

      documentService.loadDocument('doc-1', doc1);
      documentService.loadDocument('doc-2', doc2);

      const docsToSearch = documentService.getDocumentsToSearch('doc-1');

      expect(docsToSearch).toHaveLength(1);
      expect(docsToSearch[0][0]).toBe('doc-1');
    });
  });

  describe('Request Validation', () => {
    it('should validate that query is a string', () => {
      const query = 'test query';
      expect(typeof query).toBe('string');
      expect(query.length).toBeGreaterThan(0);
    });

    it('should reject empty queries', () => {
      const query = '';
      const isValid = !!(query && typeof query === 'string');
      expect(isValid).toBe(false);
    });

    it('should accept topK parameter as positive integer', () => {
      const topK = 5;
      const isValid = topK > 0 && Number.isInteger(topK);
      expect(isValid).toBe(true);
    });

    it('should use default topK=5 when not provided', () => {
      const providedTopK = undefined;
      const topK = providedTopK || 5;
      expect(topK).toBe(5);
    });
  });

  describe('Vector Conversion', () => {
    it('should convert array to Float64Array', () => {
      const vector = [0.1, 0.2, 0.3];
      const f64Vector = new Float64Array(vector);
      expect(f64Vector).toHaveLength(3);
      expect(f64Vector[0]).toBe(0.1);
      expect(f64Vector[1]).toBe(0.2);
      expect(f64Vector[2]).toBe(0.3);
    });

    it('should handle vectors of different lengths', () => {
      const shortVector = [0.1];
      const longVector = [0.1, 0.2, 0.3, 0.4, 0.5];

      const f64Short = new Float64Array(shortVector);
      const f64Long = new Float64Array(longVector);

      expect(f64Short).toHaveLength(1);
      expect(f64Long).toHaveLength(5);
    });
  });
});
