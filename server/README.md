# Backend Server

A simple HTTP server built with Node's native `http` module and [itty-router](https://itty.dev) for routing.

## Setup

The server is configured in `server/index.ts` and uses Node's native TypeScript support (Node 25+) to run directly.

## Running the Server

```bash
npm run dev:server
```

The server will start on `http://localhost:3001` by default. You can change the port with the `PORT` environment variable:

```bash
PORT=5000 npm run dev:server
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Returns server health status

### Data Endpoint
- **GET** `/api/data` - Returns sample data

### Process Endpoint
- **POST** `/api/process` - Accepts JSON body and returns processed response

## CORS

CORS is enabled for all origins in development mode. The server accepts:
- GET, POST, PUT, DELETE, OPTIONS methods
- Content-Type header

## Development

When developing, you'll likely want to run both the frontend and server in separate terminals:

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run dev:server
```

Make sure your React app is configured to call the correct API endpoint (e.g., `http://localhost:3001/api/...`).
