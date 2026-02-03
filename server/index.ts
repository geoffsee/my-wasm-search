import { createServer } from 'http';
import { Router } from 'itty-router';
import { useContainer } from 'di-framework/container';
import { ApiController } from './interfaces/http/ApiController';
import { InMemoryDocumentStore } from './infrastructure/repositories/InMemoryDocumentStore';
import { OpenAIEmbeddingService } from './infrastructure/services/OpenAIEmbeddingService';

const router = Router();
const container = useContainer();

// Register domain ports to concrete implementations
container.registerFactory('DocumentStore', () => container.resolve(InMemoryDocumentStore));
container.registerFactory('EmbeddingPort', () => container.resolve(OpenAIEmbeddingService));

const apiController = container.resolve(ApiController);

// Health check endpoint
router.get('/api/health', () => apiController.health());

// Example API endpoint
router.get('/api/data', () => apiController.data());

// POST example
router.post('/api/process', (request: Request) => apiController.process(request));

// Semantic search endpoint
router.post('/api/search', (request: Request) => apiController.search(request));

// Load document endpoint
router.post('/api/documents/:id', (request: Request) => apiController.loadDocument(request));

// List loaded documents endpoint
router.get('/api/documents', () => apiController.listDocuments());

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
