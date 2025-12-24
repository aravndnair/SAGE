import { useEffect, useState } from 'react';
import { addRoot as apiAddRoute, getRoots, triggerIndexing } from '../api/backend';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

const BASE_URL = "http://127.0.0.1:8000";

export default function Settings() {
  const { setScreen, saveRoutes, setPendingRoutes } = useApp();
  const [localRoutes, setLocalRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);

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
    const newRoutes = localRoutes.filter((_, i) => i !== index);
    setLocalRoutes(newRoutes);
  };

  const handleSave = () => {
    if (localRoutes.length === 0) {
      alert('Please add at least one folder');
      return;
    }
    
    setPendingRoutes(localRoutes);
    setShowAcknowledgement(true);
  };

  if (showAcknowledgement) {
    return <Acknowledgement onBack={() => setShowAcknowledgement(false)} />;
  }

  return (
    <div className="settings-screen">
      {/* Top Navigation Bar */}
      <div className="settings-top-nav">
        <div className="settings-nav-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#007aff">
            <path d="M12 2L2 7v10c0 5.5 3.8 9.7 9 11 5.2-1.3 9-5.5 9-11V7l-10-5z"/>
          </svg>
          <span>sage</span>
        </div>
        <div className="settings-nav-icons">
          <button className="settings-nav-icon-btn">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 2c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5z"/>
              <circle cx="10" cy="8" r="1.5"/>
              <path d="M10 11c-1.7 0-3 1-3 2h6c0-1-1.3-2-3-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="settings-main-container">
        {/* Header with back button */}
        <div className="settings-header-row">
          <button className="settings-circle-back" onClick={() => setScreen(SCREENS.SEARCH)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <h1 className="settings-main-title">Settings</h1>
        </div>

        {/* Content Cards */}
        <div className="settings-cards-container">
          {/* Manage Roots Card */}
          <div className="settings-card">
            <h2 className="settings-card-title">Manage Roots</h2>
            <p className="settings-card-description">
              Select the folders SAGE can access to perform semantic searches. For privacy, SAGE only scans directories you explicitly add.
            </p>

            <div className="settings-roots-section">
              <label className="settings-roots-label">Selected Roots</label>
              
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <div className="loader" />
                </div>
              ) : (
                <>
                  {localRoutes.length > 0 ? (
                    <div className="settings-roots-box">
                      {localRoutes.map((route, index) => (
                        <div key={index} className="settings-root-row">
                          <span className="settings-root-text">{route}</span>
                          <button
                            className="settings-delete-btn"
                            onClick={() => handleRemove(index)}
                            title="Remove"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 3h5v1h-5V3zm-1 2h8v8a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V5zm2 1v6h1V6h-1zm3 0v6h1V6h-1z"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="settings-empty-box">
                      <p>No folders selected yet</p>
                    </div>
                  )}
                </>
              )}
              
              <button 
                className="settings-add-btn" 
                onClick={handleSelectFolder}
                disabled={localRoutes.length >= 5}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Add Roots
              </button>
            </div>
          </div>

          {/* Save Changes Card */}
          <div className="settings-card">
            <h2 className="settings-card-title">Save Changes</h2>
            <p className="settings-card-description">
              Apply your changes to the directory settings. You will be prompted to acknowledge privacy terms.
            </p>
            
            <button 
              className="settings-save-btn" 
              onClick={handleSave}
              disabled={localRoutes.length === 0}
            >
              Save Settings
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer-text">
          © 2025. All rights reserved by Aravind
        </div>
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
      const currentBackendRoutes = await getRoots();
      const newRoutes = pendingRoutes.filter(route => !currentBackendRoutes.includes(route));
      
      for (const route of newRoutes) {
        await apiAddRoute(route);
      }

      const updatedRoutes = await getRoots();
      saveRoutes(updatedRoutes);

      if (newRoutes.length > 0) {
        await triggerIndexing();
      }

      setScreen(SCREENS.SEARCH);
    } catch (error) {
      console.error('Failed to save routes:', error);
      alert('Failed to save routes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acknowledgement-screen">
      <div className="acknowledgement-container">
        <div className="acknowledgement-card">
          <h1 className="acknowledgement-title">
            Your Privacy Matters: Important Acknowledgement
          </h1>
          
          <p className="acknowledgement-subtitle">
            Please read the following information carefully before proceeding.
          </p>

          <div className="acknowledgement-content">
            <p className="acknowledgement-paragraph">
              SAGE is designed with your privacy as its utmost priority. All file processing, 
              indexing, and semantic analysis occurs exclusively on your local device. We want 
              to assure you that your files and any data derived from them will *never* leave 
              your computer. There is no cloud storage, no external servers, and no internet 
              transmission of your file content.
            </p>

            <p className="acknowledgement-paragraph">
              You retain full control over which directories SAGE can access. It is crucial that 
              you carefully select only the folders you wish to make searchable. Please refrain 
              from adding directories containing highly sensitive or confidential information that 
              you would not want to be indexed and searched by SAGE, even locally.
            </p>

            <p className="acknowledgement-paragraph">
              While SAGE ensures your data remains offline, the responsibility for securing your 
              local device and managing access to it remains with you.
            </p>
          </div>

          <label className="acknowledgement-checkbox">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="acknowledgement-checkbox-input"
            />
            <span className="acknowledgement-checkbox-label">
              I acknowledge and understand SAGE's privacy policy.
            </span>
          </label>

          <button
            className="acknowledgement-button"
            onClick={handleConfirm}
            disabled={!acknowledged || saving}
          >
            {saving ? 'Saving...' : 'Save and Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
