#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: test-data/load-pdf.sh <pdf-path> [document-id] [output-json]"
  exit 1
fi

PDF_PATH="$1"
DOC_ID="${2:-}"
OUTPUT_JSON="${3:-}"

if [[ -z "${DOC_ID}" ]]; then
  base="$(basename "${PDF_PATH}")"
  DOC_ID="${base%.*}"
fi

if [[ -z "${OUTPUT_JSON}" ]]; then
  OUTPUT_JSON="${PDF_PATH%.*}.json"
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY environment variable is required"
  exit 1
fi

API_URL="${API_URL:-http://localhost:3001/api}"

echo "Generating embeddings JSON..."
bun run pdf-to-json "${PDF_PATH}" "${OUTPUT_JSON}"

echo "Loading document '${DOC_ID}' into ${API_URL}..."
curl -sS -X POST "${API_URL}/documents/${DOC_ID}" \
  -H "Content-Type: application/json" \
  -d @"${OUTPUT_JSON}"

echo
echo "Done."
