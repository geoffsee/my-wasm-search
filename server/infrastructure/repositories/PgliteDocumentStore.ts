import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Container as Service } from 'di-framework/decorators';
import type { DocumentData, TextChunk, VectorRecord } from '../../domain/models';
import { DocumentStore } from '../../domain/ports/DocumentStore';

const DB_PATH = process.env.PGLITE_DB_PATH || 'data/documents';

@Service()
export class PgliteDocumentStore extends DocumentStore {
  private db: PGlite;
  private initialized: Promise<void>;

  constructor() {
    super();
    const dir = dirname(DB_PATH);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new PGlite(DB_PATH);
    this.initialized = this.initSchema();
  }

  private async initSchema(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS text_chunks (
        document_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (document_id, chunk_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_records (
        document_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        vector DOUBLE PRECISION[] NOT NULL,
        PRIMARY KEY (document_id, chunk_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_doc ON text_chunks(document_id)`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_vectors_doc ON vector_records(document_id)`);
  }

  private async ensureReady(): Promise<void> {
    await this.initialized;
  }

  async save(id: string, data: DocumentData): Promise<void> {
    await this.ensureReady();

    await this.db.exec('BEGIN');
    try {
      await this.db.query('DELETE FROM vector_records WHERE document_id = $1', [id]);
      await this.db.query('DELETE FROM text_chunks WHERE document_id = $1', [id]);
      await this.db.query('DELETE FROM documents WHERE id = $1', [id]);

      await this.db.query('INSERT INTO documents (id) VALUES ($1)', [id]);

      for (const chunk of data.textChunks) {
        await this.db.query(
          'INSERT INTO text_chunks (document_id, chunk_id, text) VALUES ($1, $2, $3)',
          [id, chunk.id, chunk.text],
        );
      }

      for (const record of data.vectorRecords) {
        await this.db.query(
          'INSERT INTO vector_records (document_id, chunk_id, vector) VALUES ($1, $2, $3)',
          [id, record.id, record.vector],
        );
      }

      await this.db.exec('COMMIT');
    } catch (err) {
      await this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async find(id: string): Promise<DocumentData | undefined> {
    await this.ensureReady();

    const docResult = await this.db.query('SELECT id FROM documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) return undefined;

    const chunksResult = await this.db.query(
      'SELECT chunk_id, text FROM text_chunks WHERE document_id = $1',
      [id],
    );

    const vectorsResult = await this.db.query(
      'SELECT chunk_id, vector FROM vector_records WHERE document_id = $1',
      [id],
    );

    const textChunks: TextChunk[] = chunksResult.rows.map((row) => ({
      id: row.chunk_id as string,
      text: row.text as string,
    }));

    const vectorRecords: VectorRecord[] = vectorsResult.rows.map((row) => ({
      id: row.chunk_id as string,
      vector: row.vector as number[],
    }));

    return { textChunks, vectorRecords };
  }

  async getAll(): Promise<Array<[string, DocumentData]>> {
    await this.ensureReady();

    const docsResult = await this.db.query('SELECT id FROM documents');
    const results: Array<[string, DocumentData]> = [];

    for (const row of docsResult.rows) {
      const id = row.id as string;
      const data = await this.find(id);
      if (data) {
        results.push([id, data]);
      }
    }

    return results;
  }

  async exists(id: string): Promise<boolean> {
    await this.ensureReady();
    const result = await this.db.query('SELECT 1 FROM documents WHERE id = $1', [id]);
    return result.rows.length > 0;
  }
}
