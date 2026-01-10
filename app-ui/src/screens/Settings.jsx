import { useEffect, useMemo, useState } from 'react';
import { addRoot as apiAddRoute, removeRoot as apiRemoveRoute, getRoots, triggerIndexing } from '../api/backend';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

import sageLogo from '../../logo/SageNoBG.png';

const BASE_URL = "http://127.0.0.1:8000";

export default function Settings() {
  const { setScreen, saveRoutes, setPendingRoutes, userName } = useApp();
  const [localRoutes, setLocalRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { index, path }

  const initials = useMemo(() => {
    const name = (userName || 'User').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return (first + second).toUpperCase();
  }, [userName]);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const fetchedRoutes = await getRoots();
      const uniqueRoutes = [...new Set(fetchedRoutes || [])];
      setLocalRoutes(uniqueRoutes);
      saveRoutes(uniqueRoutes);
    } catch (error) {
      console.error('Failed to load routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    if (localRoutes.length >= 5) {
      alert('Maximum 5 routes allowed');
      return;
    }

    if (window.electron && window.electron.selectFolder) {
      const folderPath = await window.electron.selectFolder();
      if (folderPath) {
        if (localRoutes.includes(folderPath)) {
          alert('This folder is already added');
          return;
        }
        setLocalRoutes([...localRoutes, folderPath]);
      }
    }
  };

  const handleRemove = (index) => {
    setConfirmDelete({ index, path: localRoutes[index] });
  };

  const confirmRemove = async () => {
    if (confirmDelete !== null) {
      const pathToRemove = confirmDelete.path;
      const newRoutes = localRoutes.filter((_, i) => i !== confirmDelete.index);
      
      // Immediately remove from backend
      try {
        await apiRemoveRoute(pathToRemove);
        setLocalRoutes(newRoutes);
        saveRoutes(newRoutes);
      } catch (error) {
        console.error('Failed to remove route:', error);
        alert('Failed to remove directory. Please try again.');
      }
      
      setConfirmDelete(null);
    }
  };

  const cancelRemove = () => {
    setConfirmDelete(null);
  };

  const handleSave = () => {
    setPendingRoutes(localRoutes);
    setShowAcknowledgement(true);
  };

  if (showAcknowledgement) {
    return <Acknowledgement onBack={() => setShowAcknowledgement(false)} />;
  }

  return (
    <div className="settings-screen">
      <div className="settings-backdrop" aria-hidden="true" />

      {/* Confirmation Modal */}
      {confirmDelete !== null && (
        <div className="confirm-modal-overlay" onClick={cancelRemove}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="confirm-modal-title">Remove Directory?</h3>
            <p className="confirm-modal-text">
              Are you sure you want to remove this directory from monitoring?
            </p>
            <p className="confirm-modal-path">{confirmDelete.path}</p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn confirm-modal-btn--cancel" onClick={cancelRemove}>
                Cancel
              </button>
              <button className="confirm-modal-btn confirm-modal-btn--confirm" onClick={confirmRemove}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="settings-frame settings-animate-fade-in" aria-label="Settings">
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

            <button
              type="button"
              className="settings-nav-item"
              onClick={() => setScreen(SCREENS.INDEXING_LOGS)}
            >
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
            <h1 className="settings-header-title">Directory Management</h1>
            <div className="settings-header-actions" />
          </header>

          <div className="settings-scroll sage-scroll">
            <div className="settings-intro">
              Manage the folders SAGE can access for semantic search. You can monitor up to <span className="settings-intro-strong">5 directory routes</span>.
              Changes require re-indexing.
            </div>

            <div className="settings-routes-card">
              <div className="settings-routes-header">
                <h3 className="settings-routes-title">Monitored Routes ({localRoutes.length}/5)</h3>
                <button
                  type="button"
                  className="settings-add-route"
                  onClick={handleSelectFolder}
                  disabled={loading || localRoutes.length >= 5}
                >
                  <span className="settings-add-route-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M10 4v12" />
                      <path d="M4 10h12" />
                    </svg>
                  </span>
                  Add Route
                </button>
              </div>

              {loading ? (
                <div className="settings-loading">
                  <div className="loader" />
                </div>
              ) : (
                <>
                  {localRoutes.length > 0 ? (
                    <ul className="settings-route-list">
                      {localRoutes.map((route, index) => (
                        (() => {
                          const variants = ['blue', 'purple', 'green'];
                          const variant = variants[index % variants.length];

                          return (
                        <li key={`${route}-${index}`} className="settings-route-item">
                          <div className="settings-route-left">
                            <div className={`settings-route-icon is-${variant}`} aria-hidden="true">
                              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3.5 6.5a2 2 0 0 1 2-2h3.6l2 2H16.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V6.5Z" />
                              </svg>
                            </div>
                            <div className="settings-route-text">
                              <div className="settings-route-path" title={route}>{route}</div>
                              <div className="settings-route-sub">Selected local folder</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="settings-route-remove"
                            onClick={() => handleRemove(index)}
                            title="Remove Route"
                            aria-label="Remove Route"
                          >
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M7.5 4.5h5" />
                              <path d="M6 6h8" />
                              <path d="M7 6l.6 9h4.8l.6-9" />
                              <path d="M8.5 8.5v5" />
                              <path d="M11.5 8.5v5" />
                            </svg>
                          </button>
                        </li>
                          );
                        })()
                      ))}
                    </ul>
                  ) : (
                    <div className="settings-empty">No directory routes added yet.</div>
                  )}
                </>
              )}
            </div>
          </div>

          <footer className="settings-footer">
            <button
              type="button"
              className="settings-footer-cancel"
              onClick={() => setScreen(SCREENS.SEARCH)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="settings-footer-save"
              onClick={handleSave}
              disabled={localRoutes.length === 0}
            >
              Save Changes
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}

function Acknowledgement({ onBack }) {
  const { setScreen, pendingRoutes, saveRoutes } = useApp();
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const normalizeRoute = (route) => String(route ?? '').replace(/[\\/]+$/, '');

  const handleConfirm = async () => {
    if (!acknowledged) return;

    setSaving(true);
    try {
      const desiredRoutes = Array.isArray(pendingRoutes) ? pendingRoutes : [];

      const currentBackendRoutes = await getRoots();
      const currentNorm = new Map(
        (currentBackendRoutes || []).map((r) => [normalizeRoute(r), r])
      );
      const desiredNorm = new Map(
        desiredRoutes.map((r) => [normalizeRoute(r), r])
      );

      const routesToRemove = (currentBackendRoutes || []).filter((r) => !desiredNorm.has(normalizeRoute(r)));
      const routesToAdd = desiredRoutes.filter((r) => !currentNorm.has(normalizeRoute(r)));

      // Apply removals first so backend roots match desired state.
      for (const route of routesToRemove) {
        await apiRemoveRoute(route);
      }

      for (const route of routesToAdd) {
        await apiAddRoute(route);
      }

      const updatedRoutes = await getRoots();
      saveRoutes(updatedRoutes);

      // Any change (add OR remove) requires re-indexing to keep vector store in sync.
      if (routesToAdd.length > 0 || routesToRemove.length > 0) {
        await triggerIndexing();
      }

      setIsDone(true);
    } catch (error) {
      console.error('Failed to save routes:', error);
      alert('Failed to save routes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isDone) {
    return (
      <div className="acknowledgement-screen">
        <div className="acknowledgement-success">
          <div className="acknowledgement-success-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10l4 4 8-8" />
            </svg>
          </div>
          <h2 className="acknowledgement-success-title">You're all set</h2>
          <p className="acknowledgement-success-subtitle">SAGE is now configured for secure local search.</p>
          <button
            className="acknowledgement-success-button"
            type="button"
            onClick={() => setScreen(SCREENS.SEARCH)}
          >
            Return to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="acknowledgement-screen">
      <main className="acknowledgement-card" aria-label="Security Acknowledgement">
        <div className="acknowledgement-header">
          <div className="acknowledgement-logo" aria-hidden="true">
            <img src={sageLogo} alt="SAGE Semantic Search Logo" />
          </div>
          <h1 className="acknowledgement-title">Security Acknowledgment</h1>
          <p className="acknowledgement-subtitle">SAGE Semantic Search System</p>
        </div>

        <div className="acknowledgement-body">
          <div className="acknowledgement-tiles">
            <div className="acknowledgement-tile">
              <div className="acknowledgement-tile-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l8 8" />
                  <path d="M14 6l-1.3 1.3" />
                  <path d="M7.3 12.7 6 14" />
                  <path d="M3 10a7 7 0 0 1 12.2-4.7" />
                  <path d="M17 10a7 7 0 0 1-12.2 4.7" />
                </svg>
              </div>
              <h3 className="acknowledgement-tile-title">100% Offline</h3>
              <p className="acknowledgement-tile-text">No internet connection required for analysis.</p>
            </div>

            <div className="acknowledgement-tile">
              <div className="acknowledgement-tile-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h12" />
                  <path d="M4 10h12" />
                  <path d="M4 15h12" />
                  <path d="M6 5v10" />
                  <path d="M14 5v10" />
                </svg>
              </div>
              <h3 className="acknowledgement-tile-title">Local Processing</h3>
              <p className="acknowledgement-tile-text">All computations happen on your device.</p>
            </div>

            <div className="acknowledgement-tile">
              <div className="acknowledgement-tile-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2l7 3v6c0 4-2.7 6.9-7 7.9C5.7 17.9 3 15 3 11V5l7-3Z" />
                  <path d="M7.5 10.2 9.4 12l3.6-3.6" />
                </svg>
              </div>
              <h3 className="acknowledgement-tile-title">Zero Exfiltration</h3>
              <p className="acknowledgement-tile-text">Your files never leave this device.</p>
            </div>
          </div>

          <div className="acknowledgement-warning">
            <div className="acknowledgement-warning-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2 2.3 17h15.4L10 2Z" />
                <path d="M10 7v4" />
                <path d="M10 14h.01" />
              </svg>
            </div>
            <div>
              <h4 className="acknowledgement-warning-title">Sensitive Data Handling Warning</h4>
              <p className="acknowledgement-warning-text">
                SAGE creates semantic vector embeddings of your documents to enable natural language search. While these embeddings are stored locally,
                you are responsible for ensuring that the folders you index do not contain restricted or classified material that violates your organization's
                compliance policies.
              </p>
            </div>
          </div>

          <div className="acknowledgement-note">
            By proceeding, you confirm that you understand SAGE runs as a strictly local instance. No telemetry, usage data, or file contents are
            transmitted to external servers or third-party APIs.
          </div>

          <button
            type="button"
            className="acknowledgement-checkrow"
            onClick={() => setAcknowledged((v) => !v)}
          >
            <span className="acknowledgement-checkbox" aria-hidden="true">
              <input
                id="acknowledge-check"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
            </span>
            <span className="acknowledgement-checktext">
              <span className="acknowledgement-checktitle">I acknowledge and understand</span>
              <span className="acknowledgement-checkdesc">I confirm that I have read the security notice and authorize local indexing.</span>
            </span>
          </button>
        </div>

        <div className="acknowledgement-footer">
          <button
            type="button"
            className="acknowledgement-cancel"
            onClick={onBack}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="acknowledgement-confirm"
            onClick={handleConfirm}
            disabled={!acknowledged || saving}
          >
            <span>{saving ? 'Saving…' : 'Confirm & Continue'}</span>
            <span className="acknowledgement-confirm-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h12" />
                <path d="M12 6l4 4-4 4" />
              </svg>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
