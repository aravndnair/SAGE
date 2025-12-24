import { useEffect, useState } from 'react';
import { getRoots, searchFiles } from '../api/backend';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function Search() {
  const { setScreen, searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, setIsSearching, routes, userName, saveRoutes } = useApp();
  const [localQuery, setLocalQuery] = useState('');
  const [routesLoading, setRoutesLoading] = useState(true);

  useEffect(() => {
    loadRoutes();
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
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleOpenFile = async (filePath) => {
    if (window.electron && window.electron.openFile) {
      await window.electron.openFile(filePath);
    }
  };

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
      {/* Top Navigation Bar */}
      <div className="search-top-nav">
        <div className="search-nav-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#007aff">
            <path d="M12 2L2 7v10c0 5.5 3.8 9.7 9 11 5.2-1.3 9-5.5 9-11V7l-10-5z"/>
          </svg>
          <span>SAGE</span>
        </div>
        <div className="search-nav-icons">
          <button className="search-nav-icon-btn" onClick={() => setScreen(SCREENS.SETTINGS)} title="Settings">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="2.5"/>
              <path d="M10 1v2m0 14v2M4.22 4.22l1.42 1.42m8.72 8.72l1.42 1.42M1 10h2m14 0h2M4.22 15.78l1.42-1.42m8.72-8.72l1.42-1.42"/>
            </svg>
          </button>
          <button className="search-nav-icon-btn" onClick={() => setScreen(SCREENS.PROFILE)} title="Profile">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 10a3 3 0 100-6 3 3 0 000 6zM10 12c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="search-main-content">
        <h1 className="search-main-title">Find your files, effortlessly.</h1>

        <div className="search-input-container">
          <input
            type="text"
            className="search-main-input"
            placeholder="Search your files semantically..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSearching}
          />
          <button 
            className="search-main-button" 
            onClick={handleSearch}
            disabled={isSearching || !localQuery.trim()}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <p className="search-helper-text">Start typing to search your local files.</p>

        {/* Search Results */}
        {searchResults && searchResults.length > 0 && (
          <div className="search-results-container">
            <h2 className="search-results-title">Results for "{searchQuery}"</h2>
            <div className="search-results-list">
              {searchResults.map((result, index) => (
                <div 
                  key={index} 
                  className="search-result-card"
                  onClick={() => handleOpenFile(result.path)}
                >
                  <div className="result-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L13 1.586A2 2 0 0011.586 1H4z"/>
                    </svg>
                  </div>
                  <div className="result-content">
                    <h3 className="result-filename">{result.filename}</h3>
                    <p className="result-path">{result.path}</p>
                    {result.snippet && (
                      <p className="result-snippet">{result.snippet}</p>
                    )}
                  </div>
                  <div className="result-score">{(result.score * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery && searchResults && searchResults.length === 0 && !isSearching && (
          <div className="search-no-results">
            <p>No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="search-footer">
        © 2025 SAGE. All rights reserved by Aravind
      </div>
    </div>
  );
}
