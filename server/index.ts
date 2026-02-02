import { createServer } from 'http';
import { Router } from 'itty-router';
import OpenAI from 'openai';
import { cosine_similarity } from 'wasm-similarity';

interface DocumentData {
  textChunks: { id: string; text: string }[];
  vectorRecords: { id: string; vector: number[] }[];
}

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory document storage
// In production, this would be a database
const documentsDb: Map<string, DocumentData> = new Map();

// Health check endpoint
router.get('/api/health', () => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// Example API endpoint
router.get('/api/data', () => {
  return new Response(
    JSON.stringify({
      message: 'Hello from the API',
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

// POST example
router.post('/api/process', async (request: Request) => {
  try {
    const body = await request.json();
    return new Response(
      JSON.stringify({
        received: body,
        processed: true,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

// Semantic search endpoint
router.post('/api/search', async (request: Request) => {
  try {
    const body = await request.json() as { query: string; documentId?: string; topK?: number };
    const { query, documentId, topK = 5 } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'query parameter is required and must be a string',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!openai.apiKey) {
      return new Response(
        JSON.stringify({
          error: 'OpenAI API key not configured',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get embedding for the query
    const queryEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryVector = queryEmbedding.data[0].embedding;

    // Search across documents
    const results: Array<{
      id: string;
      text: string;
      similarity: number;
      documentId: string;
    }> = [];

    const docsToSearch = documentId
      ? documentsDb.has(documentId)
        ? [[documentId, documentsDb.get(documentId)!]]
        : []
      : Array.from(documentsDb.entries());

    for (const [docId, docData] of docsToSearch) {
      for (const vectorRecord of docData.vectorRecords) {
        const sim = cosine_similarity(
          new Float64Array(queryVector),
          new Float64Array(vectorRecord.vector)
        );
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

    // Sort by similarity and return top K
    const topResults = results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);

    return new Response(
      JSON.stringify({
        query,
        results: topResults,
        count: topResults.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Search failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

// Load document endpoint
router.post('/api/documents/:id', async (request) => {
  try {
    const { id } = (request as Request & { params: { id: string } }).params;
    const body = await request.json() as DocumentData;

    if (!body.textChunks || !body.vectorRecords) {
      return new Response(
        JSON.stringify({
          error: 'Request must include textChunks and vectorRecords',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    documentsDb.set(id, body);

    return new Response(
      JSON.stringify({
        message: `Document '${id}' loaded successfully`,
        chunks: body.textChunks.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Document load error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to load document',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

// List loaded documents endpoint
router.get('/api/documents', () => {
  const documents = Array.from(documentsDb.entries()).map(([id, data]) => ({
    id,
    chunkCount: data.textChunks.length,
  }));

  return new Response(
    JSON.stringify({
      documents,
      total: documents.length,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

// 404 fallback
router.all('*', () => {
  return new Response('Not found', { status: 404 });
});

const PORT = process.env.PORT || 3001;

const server = createServer(async (req, res) => {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

    let body: Buffer | undefined;
    if (hasBody) {
      body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
    }

    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body,
    });

    const response = await router.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api/*`);
});
