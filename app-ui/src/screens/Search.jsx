import { useEffect, useState } from 'react';
import { getRoots, searchFiles } from '../api/backend';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function Search() {
  const { setScreen, searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, setIsSearching, routes, userName, saveRoutes } = useApp();
  const [localQuery, setLocalQuery] = useState('');
  const [greeting, setGreeting] = useState('Hello');
  const [routesLoading, setRoutesLoading] = useState(true);
  const [suggestionChips] = useState([
    'Meeting notes',
    'Financial reports',
    'Project documentation',
    'Recent files'
  ]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Load routes from backend (single source of truth)
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

  const handleSuggestionClick = (suggestion) => {
    setLocalQuery(suggestion);
    setSearchQuery(suggestion);
  };

  const handleOpenFile = async (filePath) => {
    if (window.electron && window.electron.openFile) {
      await window.electron.openFile(filePath);
    }
  };

  // First-run gate: no routes configured (show loading or empty state)
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
    <div className="screen search-gradient" style={{ justifyContent: 'flex-start', paddingTop: 'var(--spacing-3xl)' }}>
      {/* Header with icons */}
      <div style={{ 
        position: 'absolute', 
        top: 'var(--spacing-lg)', 
        left: 0, 
        right: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 var(--spacing-xl)'
      }}>
        <div style={{ width: '40px' }} /> {/* Spacer */}
        
        <h2 className="text-xl" style={{ color: 'white', fontWeight: 'var(--font-weight-bold)', textShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          SAGE
        </h2>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button className="btn-icon" onClick={() => setScreen(SCREENS.SETTINGS)} title="Settings">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path d="M10 1v2m0 14v2M4.22 4.22l1.42 1.42m8.48 8.48l1.42 1.42M1 10h2m14 0h2M4.22 15.78l1.42-1.42m8.48-8.48l1.42-1.42" />
            </svg>
          </button>
          <button className="btn-icon" onClick={() => setScreen(SCREENS.PROFILE)} title="Profile">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="7" r="3" />
              <path d="M4 18c0-3.314 2.686-6 6-6s6 2.686 6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Area */}
      <div style={{ width: '100%', maxWidth: '720px', padding: '0 var(--spacing-xl)' }}>
        {/* Personalized Greeting */}
        <div style={{ marginBottom: 'var(--spacing-xl)', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: 'var(--font-size-3xl)', 
            fontWeight: 'var(--font-weight-bold)', 
            color: 'white',
            marginBottom: 'var(--spacing-xs)',
            textShadow: '0 2px 12px rgba(0,0,0,0.15)'
          }}>
            {greeting}, {userName || 'there'}!
          </h1>
          <p style={{ 
            fontSize: 'var(--font-size-lg)', 
            color: 'rgba(255,255,255,0.9)',
            textShadow: '0 1px 4px rgba(0,0,0,0.1)'
          }}>
            What are you looking for?
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-md)'
        }}>
          <input
            type="text"
            className="glass-input search-input-enhanced"
            placeholder="Enter your semantic query..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{ flex: 1 }}
          />
          <button 
            className="btn-primary btn-search" 
            onClick={handleSearch}
            disabled={isSearching || !localQuery.trim()}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Suggestion Chips */}
        {!searchQuery && (
          <div style={{ 
            display: 'flex', 
            gap: 'var(--spacing-sm)',
            flexWrap: 'wrap',
            marginBottom: 'var(--spacing-xl)',
            justifyContent: 'center'
          }}>
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Loading Indicator */}
        {isSearching && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-2xl)' }}>
            <div className="loader" />
          </div>
        )}

        {/* Search Results */}
        {!isSearching && searchResults.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--spacing-md)',
            maxHeight: '60vh',
            overflowY: 'auto',
            paddingRight: 'var(--spacing-sm)'
          }}>
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="glass-card"
                onClick={() => handleOpenFile(result.path)}
                style={{
                  padding: 'var(--spacing-lg)',
                  cursor: 'pointer',
                  animation: `slideUp var(--transition-normal) ease-out ${index * 0.05}s both`
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: 'var(--spacing-xs)'
                }}>
                  <h4 style={{ 
                    fontSize: 'var(--font-size-base)', 
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)'
                  }}>
                    {result.filename || result.path.split(/[/\\]/).pop()}
                  </h4>
                  <span style={{ 
                    fontSize: 'var(--font-size-sm)', 
                    color: 'var(--color-primary)',
                    fontWeight: 'var(--font-weight-medium)'
                  }}>
                    {(result.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--spacing-sm)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {result.path}
                </p>
                {result.chunk && (
                  <p style={{ 
                    fontSize: 'var(--font-size-sm)', 
                    color: 'var(--color-text-tertiary)',
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {result.chunk}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {!isSearching && searchQuery && searchResults.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-2xl)' }}>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              No results found for "{searchQuery}"
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && !searchQuery && searchResults.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-2xl)' }}>
            <p className="text-base" style={{ color: 'var(--color-text-tertiary)' }}>
              Enter a query to search your files
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
