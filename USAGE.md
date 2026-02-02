# Semantic Search Usage Guide

## Overview

This project provides a semantic search interface built with React that connects to a backend Node.js server with itty-router. It uses OpenAI embeddings for semantic understanding and WASM-based similarity calculations for fast vector comparisons.

## Getting Started

### 1. Start the Backend Server

In one terminal, start the Node.js server:

```bash
npm run dev:server
```

The server will run on `http://localhost:3001`

### 2. Start the Frontend Dev Server

In another terminal, start the React dev server:

```bash
npm run dev
```

The app will open at `http://localhost:5173`

## Loading Documents

Before searching, you need to load documents with their embeddings. The documents must be processed with OpenAI's embeddings API.

### Using the PDF to JSON Utility

To convert a PDF to chunks with embeddings:

```bash
OPENAI_API_KEY=your-api-key npm run pdf-to-json path/to/file.pdf
```

This creates a JSON file with:
- `textChunks`: Array of text chunks from the PDF
- `vectorRecords`: Array of embedding vectors for each chunk

### Loading Documents via API

Use the document loading endpoint to load the processed JSON:

```bash
curl -X POST http://localhost:3001/api/documents/my-doc \
  -H "Content-Type: application/json" \
  -d @path/to/file.json
```

Or from JavaScript:

```javascript
const docData = await fetch('path/to/file.json').then(r => r.json());
await fetch('http://localhost:3001/api/documents/my-doc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(docData)
});
```

## Using the Search Interface

1. **Enter a Query**: Type your search query in the input field
2. **Click Search**: Press the Search button or Enter
3. **View Results**: See ranked results with similarity scores

### Understanding Results

Each result shows:
- **Rank**: Position in the results (#1, #2, etc.)
- **Similarity**: How similar the result is to your query (0-100%)
- **Text**: The actual text chunk from the document
- **Document ID**: Which document the result came from
- **Similarity Bar**: Visual representation of the similarity score

## API Endpoints

### Health Check
```
GET /api/health
```

### Load a Document
```
POST /api/documents/:id
Content-Type: application/json

{
  "textChunks": [
    { "id": "chunk-1", "text": "..." }
  ],
  "vectorRecords": [
    { "id": "chunk-1", "vector": [...] }
  ]
}
```

### List Documents
```
GET /api/documents
```

### Search
```
POST /api/search
Content-Type: application/json

{
  "query": "your search query",
  "topK": 10,
  "documentId": "optional-doc-id"
}
```

Response:
```json
{
  "query": "your search query",
  "results": [
    {
      "id": "chunk-id",
      "text": "chunk text",
      "similarity": 0.95,
      "documentId": "my-doc"
    }
  ],
  "count": 1
}
```

## Environment Variables

### Frontend

The React app expects the backend at `http://localhost:3001`. Update the `API_URL` in `src/components/Search.tsx` if needed.

### Backend

```bash
# Required for the server to accept requests
OPENAI_API_KEY=your-openai-api-key

# Optional: Change the port (default: 3001)
PORT=5000
```

## Example Workflow

```bash
# 1. Start server
npm run dev:server

# 2. Start frontend
npm run dev

# 3. Convert a PDF to embeddings (requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-... npm run pdf-to-json test-data/sample.pdf

# 4. Load the document via API
curl -X POST http://localhost:3001/api/documents/sample \
  -H "Content-Type: application/json" \
  -d @test-data/sample.json

# 5. Go to http://localhost:5173 and search!
```

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
```

## Architecture

```
┌─────────────────┐
│   React App     │  src/components/Search.tsx
│   (Frontend)    │  Beautiful search interface
└────────┬────────┘
         │
    HTTP │ fetch()
         │
┌────────▼────────┐
│  Node.js Server │  server/index.ts
│  (itty-router)  │  API endpoints, document storage
└────────┬────────┘
         │
    WASM │ cosine_similarity()
         │
    ┌────▼─────┐
    │  Embeddings   │  OpenAI text-embedding-3-small
    └───────────┘
```

## Performance Tips

- **Batch Processing**: Load multiple documents to search across them
- **TopK Parameter**: Adjust the topK in search requests (default: 10)
- **Chunking**: The PDF converter uses 500-token chunks with 50-token overlap
- **WASM**: Vector similarity calculations run in WebAssembly for speed

## Troubleshooting

### "No results found" message
- Make sure you've loaded documents using `/api/documents/:id`
- Verify your OPENAI_API_KEY is set when converting PDFs

### CORS errors
- CORS is enabled on the backend for development
- If testing from a different host, the backend already allows all origins

### Search returning empty results
- The query might not match your documents well
- Try simpler or different search terms
- Ensure the documents were loaded successfully with `GET /api/documents`

### Server won't start
- Check that port 3001 is not in use
- Verify Node 25+ is installed (or use `tsx` instead of `--experimental-strip-types`)
- Ensure OPENAI_API_KEY is set if using PDF conversion
