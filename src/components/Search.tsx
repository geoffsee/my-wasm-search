import { useState } from 'react';
import '../styles/Search.css';

interface SearchResult {
  id: string;
  text: string;
  similarity: number;
  documentId: string;
}

const API_URL = 'http://localhost:3001/api';

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setHasSearched(true);

    if (!query.trim()) {
      setError('Please enter a search query');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          topK: 10,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);

      if (data.results.length === 0) {
        setError('No results found. Make sure to load documents first.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while searching'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="search-container">
      <div className="search-header">
        <h1>Semantic Search</h1>
        <p className="subtitle">Search across your documents with AI embeddings</p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query..."
            className="search-input"
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            className="search-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Searching...
              </>
            ) : (
              <>
                <span className="search-icon">⌕</span>
                Search
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {hasSearched && results.length > 0 && (
        <div className="results-container">
          <h2 className="results-title">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>
          <div className="results-list">
            {results.map((result, index) => (
              <div key={result.id} className="result-card">
                <div className="result-header">
                  <div className="result-rank">#{index + 1}</div>
                  <div className="result-similarity">
                    <span className="similarity-label">Similarity</span>
                    <span className="similarity-score">
                      {(result.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <p className="result-text">{result.text}</p>
                <div className="result-footer">
                  <span className="result-doc-id">Doc: {result.documentId}</span>
                  <span className="result-chunk-id">ID: {result.id}</span>
                </div>
                <div className="similarity-bar">
                  <div
                    className="similarity-fill"
                    style={{ width: `${result.similarity * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSearched && results.length === 0 && !error && (
        <div className="empty-state">
          <p>No results found</p>
          <p className="empty-hint">
            Try loading documents first using the API endpoint /api/documents/:id
          </p>
        </div>
      )}

      {!hasSearched && (
        <div className="initial-state">
          <div className="initial-content">
            <h2>Ready to search</h2>
            <p>
              Enter a query above to search across your documents using semantic search.
            </p>
            <div className="feature-list">
              <div className="feature">
                <span className="feature-icon">🔍</span>
                <span>Semantic understanding</span>
              </div>
              <div className="feature">
                <span className="feature-icon">⚡</span>
                <span>Fast WASM similarity</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📊</span>
                <span>Ranked by relevance</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
