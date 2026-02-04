# my-wasm-search

Semantic Search application to demonstrate [wasm-similarity](https://www.npmjs.com/package/wasm-similarity) and [di-framework](https://github.com/geoffsee/di-framework)

![Screenshot](./screenshot.png)

## Quick Start

```bash
npm install
OPENAI_API_KEY=$YOUR_KEY npm run dev
open http://localhost:5173
```

## System Architecture

```mermaid
erDiagram
    DOCUMENT {
        text id PK
        text title
    }

    TEXT_CHUNK {
        text document_id PK,FK
        text chunk_id PK
        integer chunk_index
        text text
    }

    VECTOR_RECORD {
        text document_id PK,FK
        text chunk_id PK
        double_precision[] vector
    }

    SEARCH_RESULT {
        text id
        text text
        float similarity
        float semanticScore
        float keywordScore
        integer rank
        integer chunkIndex
        integer totalChunks
        text documentId FK
        text documentTitle
        text[] highlights
    }

    NEIGHBOR_CHUNKS {
        text prev
        text next
    }

    DOCUMENT ||--o{ TEXT_CHUNK : contains
    DOCUMENT ||--o{ VECTOR_RECORD : "has embeddings"
    TEXT_CHUNK ||--|| VECTOR_RECORD : "embedded as"
    SEARCH_RESULT }o--|| DOCUMENT : references
    SEARCH_RESULT ||--o| NEIGHBOR_CHUNKS : "includes context"
```

### Data Flow

1. **Document Ingestion**: Documents are split into `TEXT_CHUNK`s and each chunk is embedded into a `VECTOR_RECORD`
2. **Search**: Queries are processed via semantic (vector similarity), keyword (Jaccard index), or hybrid (RRF fusion) modes
3. **Results**: `SEARCH_RESULT`s reference chunks with optional neighbor context for surrounding text
