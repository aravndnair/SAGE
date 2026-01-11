import { useEffect, useMemo, useRef, useState } from 'react';
import { getRoots, searchFiles } from '../api/backend';
import ResultCard from '../components/ResultCard';
import SearchBar from '../components/SearchBar';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

import peopleIcon from '../../logo/people.png';
import settingsIcon from '../../logo/setting.png';

export default function Search() {
  const { setScreen, searchQuery, setSearchQuery, searchResults, setSearchResults, setIndexingLogs, isSearching, setIsSearching, routes, userName, saveRoutes } = useApp();
  const [localQuery, setLocalQuery] = useState('');
  const [routesLoading, setRoutesLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    const onGlobalKeyDown = (e) => {
      const isK = typeof e.key === 'string' && e.key.toLowerCase() === 'k';
      if (!isK) return;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        inputRef.current?.focus?.();
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const loadRoutes = async () => {
    try {
      const fetchedRoutes = await getRoots();
      const uniqueRoutes = [...new Set(fetchedRoutes || [])];
      saveRoutes(uniqueRoutes);
    } catch (error) {
      console.error('Failed to load routes:', error);
    } finally {
      setRoutesLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!localQuery.trim()) return;

    setIsSearching(true);
    setSearchQuery(localQuery);
    
    try {
      const results = await searchFiles(localQuery, 10);
      setSearchResults(results || []);
      // Persist to Indexing Logs (but NOT back into Search on restart).
      setIndexingLogs?.(localQuery, results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setIndexingLogs?.(localQuery, []);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenFile = async (filePath) => {
    if (window.electron && window.electron.openFile) {
      await window.electron.openFile(filePath);
    }
  };

  const results = useMemo(() => (Array.isArray(searchResults) ? searchResults : []), [searchResults]);

  // First-run gate
  if (routesLoading) {
    return (
      <div className="screen">
        <div className="loader" />
      </div>
    );
  }

  if (!routes || routes.length === 0) {
    return (
      <div className="screen">
        <div className="glass-card" style={{ 
          maxWidth: '480px', 
          textAlign: 'center', 
          padding: 'var(--spacing-2xl)' 
        }}>
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto' }}>
              <circle cx="32" cy="32" r="28" stroke="var(--color-primary)" strokeWidth="2" opacity="0.3" />
              <path d="M32 20v16M32 44v.5" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl" style={{ marginBottom: 'var(--spacing-md)' }}>
            No Folders Added
          </h2>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-xl)' }}>
            To start searching, please add at least one folder in Settings.
          </p>
          <button className="btn-primary" onClick={() => setScreen(SCREENS.SETTINGS)}>
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="search-page">
      {/* Ambient Background */}
      <div className="search-ambient" aria-hidden="true">
        <div className="search-ambient-blob search-ambient-blob--primary" />
        <div className="search-ambient-blob search-ambient-blob--secondary" />
      </div>

      {/* Header */}
      <header className="search-top-nav">
        <div className="search-nav-spacer" />

        <div className="search-nav-logo" aria-label="SAGE Home">
          <div className="search-brand">
            <h1 className="search-logo-text">SAGE</h1>
            <div className="search-brand-sub">© 2025 . All rights reserved by Aravind</div>
          </div>
        </div>

        <div className="search-nav-controls">
          <button
            className="search-icon-btn"
            onClick={() => setScreen(SCREENS.SETTINGS)}
            title="Settings"
            type="button"
          >
            <img className="search-nav-icon-img" src={settingsIcon} alt="" />
          </button>

          <button
            className="search-avatar-btn"
            onClick={() => setScreen(SCREENS.PROFILE)}
            title="Profile"
            type="button"
          >
            <span className="sr-only">Open profile</span>
            <img className="search-nav-icon-img" src={peopleIcon} alt="" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="search-main">
        <div className="search-headline animate-fade-in-up">
          <h2 className="search-title">Search your files.</h2>
          <p className="search-subtitle">Find your files instantly.</p>
        </div>

        <div className="search-bar-wrap">
          <SearchBar
            inputRef={inputRef}
            value={localQuery}
            onChange={setLocalQuery}
            onSubmit={handleSearch}
            isSearching={isSearching}
          />
        </div>

        <section className={`search-results ${isScrolled ? 'is-scrolled' : ''}`} aria-label="Search results">
          <div 
            ref={scrollRef}
            className="search-results-scroll sage-scroll"
            onScroll={(e) => setIsScrolled(e.target.scrollTop > 10)}
          >
            {isSearching ? (
              <div className="search-loading-overlay" aria-live="polite" aria-busy="true">
                <div className="search-loading-pill">
                  <span className="search-loading-spinner" aria-hidden="true" />
                  <span className="search-loading-text">Searching...</span>
                </div>
              </div>
            ) : null}
            {searchQuery && !isSearching && results.length === 0 ? (
              <div className="search-no-results">No results found for "{searchQuery}"</div>
            ) : (
              <div className="search-results-list">
                {results.map((result, index) => (
                  <ResultCard
                    key={`${result?.path || result?.filename || 'result'}-${index}`}
                    title={result?.filename || result?.path}
                    snippet={result?.snippet}
                    score={typeof result?.score === 'number' ? result.score : undefined}
                    path={result?.path}
                    matchedTerms={result?.matched_terms}
                    onOpen={handleOpenFile}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
