import { Component, Container as Controller } from 'di-framework/decorators';
import { DocumentApplicationService } from '../../application/services/DocumentApplicationService';
import { SearchService } from '../../domain/services/SearchService';
import type { DocumentData } from '../../domain/models';

@Controller()
export class ApiController {
  private searchService: SearchService;
  private documentService: DocumentApplicationService;

  constructor(
    @Component(SearchService) searchService: SearchService,
    @Component(DocumentApplicationService) documentService: DocumentApplicationService,
  ) {
    this.searchService = searchService;
    this.documentService = documentService;
  }

  health(): Response {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  data(): Response {
    return new Response(
      JSON.stringify({
        message: 'Hello from the API',
        timestamp: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async process(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      return new Response(
        JSON.stringify({ received: body, processed: true }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  async search(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { query: string; documentId?: string; topK?: number };
      const query = (body.query ?? '').trim();
      const topK = Number.isInteger(body.topK) && (body.topK as number) > 0 ? body.topK as number : 5;
      const documentId = body.documentId;

      if (!query) {
        return new Response(
          JSON.stringify({ error: 'query parameter is required and must be a string' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const results = await this.searchService.search(query, topK, documentId);

      return new Response(
        JSON.stringify({ query, results, count: results.length }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Search failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  async loadDocument(request: Request & { params?: Record<string, string> }): Promise<Response> {
    try {
      const id = request.params?.id;
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Document id is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const body = await request.json() as DocumentData;

      if (!body?.textChunks || !body?.vectorRecords) {
        return new Response(
          JSON.stringify({ error: 'Request must include textChunks and vectorRecords' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      await this.documentService.loadDocument(id, body);

      return new Response(
        JSON.stringify({ message: `Document '${id}' loaded successfully`, chunks: body.textChunks.length }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to load document' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  async listDocuments(): Promise<Response> {
    const documents = await this.documentService.listDocuments();
    return new Response(
      JSON.stringify({ documents, total: documents.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }
}
