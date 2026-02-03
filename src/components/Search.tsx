import { useState, useCallback, useEffect } from 'react';
import '../styles/Search.css';

interface NeighborChunks {
  prev?: string;
  next?: string;
}

interface SearchResult {
  id: string;
  text: string;
  similarity: number;
  documentId: string;
  semanticScore?: number;
  keywordScore?: number;
  rank: number;
  chunkIndex: number;
  totalChunks: number;
  documentTitle?: string;
  highlights: string[];
  neighborChunks: NeighborChunks;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const API_URL = 'http://localhost:3001/api';

function highlightText(text: string, highlights: string[]): React.ReactNode {
  if (!highlights.length) return text;

  const regex = new RegExp(`\\b(${highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isHighlight = highlights.some(h => h.toLowerCase() === part.toLowerCase());
    return isHighlight ? <mark key={i} className="highlight">{part}</mark> : part;
  });
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    return stored || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  const toggleTheme = () => {
    setTheme(current => {
      if (current === 'system') {
        return getSystemTheme() === 'dark' ? 'light' : 'dark';
      }
      return current === 'dark' ? 'light' : 'dark';
    });
  };

  return { theme, resolvedTheme, toggleTheme };
}

export function Search() {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const { resolvedTheme, toggleTheme } = useTheme();

  const fetchResults = useCallback(async (searchQuery: string, page: number, limit: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          page,
          limit,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setPagination(data.pagination || null);

      if (data.pagination?.total === 0) {
        setError('No results found. Make sure to load documents first.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while searching'
      );
      setResults([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Please enter a search query');
      return;
    }

    setHasSearched(true);
    setSearchedQuery(trimmedQuery);
    await fetchResults(trimmedQuery, 1, pageSize);
  };

  const handlePageSizeChange = async (newSize: number) => {
    setPageSize(newSize);
    if (searchedQuery) {
      await fetchResults(searchedQuery, 1, newSize);
    }
  };

  const goToPage = async (page: number) => {
    if (!pagination || !searchedQuery) return;
    const targetPage = Math.max(1, Math.min(page, pagination.totalPages));
    if (targetPage !== pagination.page) {
      await fetchResults(searchedQuery, targetPage, pageSize);
    }
  };

  const currentPage = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  return (
    <div className="search-container">
      <div className="search-header">
        <h1>Search</h1>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your documents..."
            className="search-input"
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            className="search-button"
            disabled={isLoading}
            aria-label="Search"
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              <SearchIcon />
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {hasSearched && results.length > 0 && pagination && (
        <div className="results-container">
          <div className="results-header">
            <h2 className="results-title">
              {total} result{total !== 1 ? 's' : ''}
            </h2>
            <div className="page-size-selector">
              <label htmlFor="page-size">Per page:</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                disabled={isLoading}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="results-info">
            {startIndex + 1}–{endIndex} of {total}
          </div>

          <div className="results-list">
            {results.map((result) => (
              <div key={result.id} className="result-card">
                {result.documentTitle && (
                  <div className="result-doc-title">{result.documentTitle}</div>
                )}

                <p className="result-text">
                  {highlightText(result.text, result.highlights)}
                </p>

                <div className="result-footer">
                  <span className="result-chunk-pos">
                    Chunk {result.chunkIndex + 1} of {result.totalChunks}
                  </span>
                  <span className="result-doc-id">{result.documentId}</span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1 || isLoading}
                title="First page"
              >
                ««
              </button>
              <button
                className="pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                title="Previous page"
              >
                «
              </button>

              <div className="pagination-pages">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    const distance = Math.abs(page - currentPage);
                    return distance === 0 || distance === 1 || page === 1 || page === totalPages;
                  })
                  .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                      acc.push('ellipsis');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        className={`pagination-page ${currentPage === item ? 'active' : ''}`}
                        onClick={() => goToPage(item)}
                        disabled={isLoading}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                className="pagination-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                title="Next page"
              >
                »
              </button>
              <button
                className="pagination-btn"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages || isLoading}
                title="Last page"
              >
                »»
              </button>
            </div>
          )}
        </div>
      )}

      {hasSearched && results.length === 0 && !error && !isLoading && (
        <div className="empty-state">
          <p>No results found</p>
        </div>
      )}

      {!hasSearched && (
        <div className="initial-state">
          <div className="initial-content">
            <p>Search your documents</p>
          </div>
        </div>
      )}
    </div>
  );
}
