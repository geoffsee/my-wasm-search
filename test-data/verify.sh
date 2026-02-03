#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"

echo "Checking API at ${API_URL}..."

if ! response=$(curl -sS -w "\n%{http_code}" "${API_URL}/health" 2>&1); then
  echo "Failed to connect to API"
  echo "Is the server running? Start with: npm run dev:server"
  exit 1
fi

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" != "200" ]]; then
  echo "API check failed with status ${http_code}"
  if [[ -n "$body" ]]; then
    echo "Response: ${body}"
  fi
  echo ""
  echo "Troubleshooting:"
  echo "  - Start the server: npm run dev:server"
  echo "  - Check what's on port 3001: lsof -i :3001"
  exit 1
fi

echo "API is running"

# Fetch documents
echo ""
echo "Loaded documents:"
docs_response=$(curl -sS "${API_URL}/documents")
echo "$docs_response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
docs = data.get('documents', [])
total = data.get('total', 0)
if total == 0:
    print('  (none)')
else:
    for doc in docs:
        print(f'  - {doc}')
    print(f'  Total: {total}')
" 2>/dev/null || echo "  $docs_response"

exit 0
