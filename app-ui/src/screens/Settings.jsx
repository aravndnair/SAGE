import { useEffect, useState } from 'react';
import { addRoot as apiAddRoute, getRoots, triggerIndexing } from '../api/backend';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

const BASE_URL = "http://127.0.0.1:8000";

export default function Settings() {
  const { setScreen, routes, saveRoutes, setPendingRoutes } = useApp();
  const [localRoutes, setLocalRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      // Backend is the single source of truth
      const fetchedRoutes = await getRoots();
      const uniqueRoutes = [...new Set(fetchedRoutes || [])];
      setLocalRoutes(uniqueRoutes);
      // Sync to localStorage
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
        // Check for duplicate before adding
        if (localRoutes.includes(folderPath)) {
          alert('This folder is already added');
          return;
        }
        setLocalRoutes([...localRoutes, folderPath]);
      }
    }
  };

  const handleRemove = async (index) => {
    const routeToRemove = localRoutes[index];
    try {
      // Remove from backend
      await fetch(`${BASE_URL}/roots/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: routeToRemove })
      });
      
      // Reload from backend (single source of truth)
      const updatedRoutes = await getRoots();
      setLocalRoutes(updatedRoutes);
      saveRoutes(updatedRoutes);
    } catch (error) {
      console.error('Failed to remove route:', error);
      alert('Failed to remove route. Please try again.');
    }
  };

  const handleSave = () => {
    if (localRoutes.length === 0) {
      alert('Please add at least one folder');
      return;
    }
    
    // Store pending routes and show acknowledgement
    setPendingRoutes(localRoutes);
    setShowAcknowledgement(true);
  };

  if (showAcknowledgement) {
    return <Acknowledgement onBack={() => setShowAcknowledgement(false)} />;
  }

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: 'var(--spacing-3xl)' }}>
      {/* Header */}
      <div style={{ 
        width: '100%', 
        maxWidth: '600px', 
        padding: '0 var(--spacing-xl)',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <button className="btn-icon" onClick={() => setScreen(SCREENS.SEARCH)} title="Back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10H5M5 10l4 4M5 10l4-4" />
            </svg>
          </button>
          <h2 className="text-2xl" style={{ color: 'var(--color-text-primary)' }}>
            Settings
          </h2>
        </div>

        <p className="text-base" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
          Manage directory routes (folders) that SAGE can access
        </p>

        {/* Routes List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-2xl)' }}>
            <div className="loader" />
          </div>
        ) : (
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            {localRoutes.length > 0 ? (
              <div className="stagger-animation" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {localRoutes.map((route, index) => (
                  <div
                    key={index}
                    className="glass-card"
                    style={{
                      padding: 'var(--spacing-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ 
                      fontSize: 'var(--font-size-sm)', 
                      color: 'var(--color-text-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {route}
                    </span>
                    <button
                      onClick={() => handleRemove(index)}
                      style={{
                        color: 'var(--color-danger)',
                        fontSize: 'var(--font-size-sm)',
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        fontWeight: 'var(--font-weight-medium)'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                <p className="text-base" style={{ color: 'var(--color-text-tertiary)' }}>
                  No routes configured
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <button
            className="btn-secondary"
            onClick={handleSelectFolder}
            disabled={localRoutes.length >= 5}
            style={{ width: '100%' }}
          >
            {localRoutes.length >= 5 ? 'Maximum routes reached' : 'Add Folder'}
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={localRoutes.length === 0}
            style={{ width: '100%' }}
          >
            Save
          </button>
        </div>

        <p className="text-sm" style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
          {localRoutes.length}/5 routes
        </p>
      </div>
    </div>
  );
}

function Acknowledgement({ onBack }) {
  const { setScreen, pendingRoutes, saveRoutes } = useApp();
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!acknowledged) return;

    setSaving(true);
    try {
      // Get current backend routes
      const currentBackendRoutes = await getRoots();
      
      // Only add routes that don't already exist in backend
      const newRoutes = pendingRoutes.filter(route => !currentBackendRoutes.includes(route));
      
      for (const route of newRoutes) {
        await apiAddRoute(route);
      }

      // Fetch fresh routes from backend after adding (single source of truth)
      const updatedRoutes = await getRoots();
      saveRoutes(updatedRoutes);

      // Trigger indexing only if we added new routes
      if (newRoutes.length > 0) {
        await triggerIndexing();
      }

      // Navigate back to search
      setScreen(SCREENS.SEARCH);
    } catch (error) {
      console.error('Failed to save routes:', error);
      alert('Failed to save routes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <div className="glass-card" style={{ 
        maxWidth: '560px', 
        padding: 'var(--spacing-2xl)',
        margin: '0 var(--spacing-xl)'
      }}>
        <h2 className="text-2xl" style={{ 
          color: 'var(--color-text-primary)', 
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          Important Notice
        </h2>

        <div style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--color-text-secondary)',
          lineHeight: '1.6',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <p style={{ marginBottom: 'var(--spacing-md)' }}>
            Please review the following before proceeding:
          </p>

          <ul style={{ 
            paddingLeft: 'var(--spacing-lg)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--spacing-md)' 
          }}>
            <li>
              <strong>Privacy First:</strong> SAGE runs completely offline. Your files never leave your device.
            </li>
            <li>
              <strong>Local Processing:</strong> All indexing and searching happens on your machine. No cloud services involved.
            </li>
            <li>
              <strong>Sensitive Files:</strong> Avoid indexing folders containing passwords, private keys, or highly sensitive personal data.
            </li>
            <li>
              <strong>Your Responsibility:</strong> You are responsible for choosing which folders SAGE can access.
            </li>
          </ul>
        </div>

        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-xl)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-primary)'
        }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ 
              width: '20px', 
              height: '20px',
              cursor: 'pointer',
              accentColor: 'var(--color-primary)'
            }}
          />
          <span>I acknowledge and understand</span>
        </label>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <button
            className="btn-secondary"
            onClick={onBack}
            disabled={saving}
            style={{ flex: 1 }}
          >
            Back
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!acknowledged || saving}
            style={{ flex: 1 }}
          >
            {saving ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
