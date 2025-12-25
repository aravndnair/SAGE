import { useEffect } from 'react';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function Welcome() {
  const { setScreen } = useApp();

  useEffect(() => {
    let timer;

    try {
      // If we've already shown Hello once, skip immediately.
      if (localStorage.getItem('sage_seen_hello') === 'true') {
        setScreen(SCREENS.NAME_INPUT);
        return;
      }

      // Mark as seen right away so it truly only appears once.
      localStorage.setItem('sage_seen_hello', 'true');
    } catch {
      // ignore storage failures
    }

    // Auto-transition to NAME_INPUT after 2 seconds
    timer = setTimeout(() => {
      setScreen(SCREENS.NAME_INPUT);
    }, 2000);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [setScreen]);

  return (
    <div className="screen hello-screen">
      {/* Ambient Background Elements */}
      <div className="hello-ambient" aria-hidden="true">
        <div className="hello-orb hello-orb--one" />
        <div className="hello-orb hello-orb--two" />
        <div className="hello-orb hello-orb--three" />
      </div>

      {/* Main Content */}
      <div className="hello-content">
        <div className="hello-greeting hello-fade-in-up">
          <h1 className="hello-title">Hello</h1>

          <div className="hello-brand hello-appear hello-appear--1">
            <span className="hello-brand-dot" aria-hidden="true" />
            <span className="hello-brand-text">Sage</span>
          </div>

          <div className="glass-panel hello-status hello-appear hello-appear--2">
            <div className="hello-spinner" aria-hidden="true">
              <svg
                className="hello-spinner-svg"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="hello-spinner-track"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="hello-spinner-head"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="hello-status-text">Loading your workspace...</span>
          </div>
        </div>
      </div>

      <div className="hello-footer hello-appear hello-appear--3">
        <p className="hello-footer-text">Semantic Search Engine</p>
      </div>
    </div>
  );
}
