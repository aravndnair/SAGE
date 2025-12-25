import { useMemo } from 'react';
import ResultCard from '../components/ResultCard';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

import sageLogo from '../../logo/SageNoBG.png';

export default function IndexingLogs() {
  const { setScreen, indexingLogsQuery, indexingLogsResults, clearIndexingLogs, userName } = useApp();

  const initials = useMemo(() => {
    const name = (userName || 'User').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return (first + second).toUpperCase();
  }, [userName]);

  const results = Array.isArray(indexingLogsResults) ? indexingLogsResults : [];

  const handleOpenFile = async (filePath) => {
    if (window.electron && window.electron.openFile) {
      await window.electron.openFile(filePath);
    }
  };

  return (
    <div className="settings-screen">
      <div className="settings-backdrop" aria-hidden="true" />

      <main className="settings-frame settings-animate-fade-in" aria-label="Indexing Logs">
        <aside className="settings-aside">
          <div className="settings-aside-logo" aria-label="SAGE">
            <img src={sageLogo} alt="SAGE Logo" />
          </div>

          <nav className="settings-nav" aria-label="Navigation">
            <button
              type="button"
              className="settings-nav-item"
              onClick={() => setScreen(SCREENS.SEARCH)}
            >
              <span className="settings-nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8.5 15a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />
                  <path d="M13.5 13.5 18 18" />
                </svg>
              </span>
              <span className="settings-nav-text">Search</span>
            </button>

            <div className="settings-nav-section">System</div>

            <button type="button" className="settings-nav-item is-active" disabled>
              <span className="settings-nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3v7l4 2" />
                  <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
                </svg>
              </span>
              <span className="settings-nav-text">Indexing Logs</span>
            </button>
          </nav>

          <button
            type="button"
            className="settings-user"
            onClick={() => setScreen(SCREENS.PROFILE)}
            aria-label="Open Profile"
          >
            <div className="settings-user-avatar" aria-hidden="true">{initials}</div>
            <div className="settings-user-meta">
              <div className="settings-user-name">{userName || 'User'}</div>
              <div className="settings-user-plan">Pro Plan</div>
            </div>
          </button>
        </aside>

        <section className="settings-main">
          <header className="settings-header">
            <h1 className="settings-header-title">Indexing Logs</h1>
            <div className="settings-header-actions">
              <button
                type="button"
                className="indexinglogs-clear"
                onClick={() => {
                  const ok = window.confirm('Clear indexing logs? This cannot be undone.');
                  if (ok) {
                    clearIndexingLogs?.();
                  }
                }}
                disabled={results.length === 0}
              >
                Clear Logs
              </button>
            </div>
          </header>

          <div className="settings-scroll sage-scroll">
            <div className="settings-intro">
              Previous search results{indexingLogsQuery ? (
                <> for <span className="settings-intro-strong">“{indexingLogsQuery}”</span></>
              ) : null}.
            </div>

            {results.length === 0 ? (
              <div className="settings-empty">
                No previous search results yet. Run a search first.
              </div>
            ) : (
              <div className="indexinglogs-list">
                {results.map((result, index) => (
                  <ResultCard
                    key={`${result?.path || result?.filename || 'result'}-${index}`}
                    title={result?.filename || result?.path}
                    snippet={result?.snippet}
                    score={typeof result?.score === 'number' ? result.score : undefined}
                    path={result?.path}
                    onOpen={handleOpenFile}
                  />
                ))}
              </div>
            )}
          </div>

          <footer className="settings-footer">
            <button
              type="button"
              className="settings-footer-cancel"
              onClick={() => setScreen(SCREENS.SETTINGS)}
            >
              Back
            </button>
            <button
              type="button"
              className="settings-footer-save"
              onClick={() => setScreen(SCREENS.SEARCH)}
            >
              Go to Search
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}
