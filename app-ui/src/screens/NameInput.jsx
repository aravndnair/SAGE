import { useState } from 'react';
import sageLogo from '../../logo/SageNoBG.png';
import peopleIcon from '../../logo/people.png';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function NameInput() {
  const { saveUserName, setScreen } = useApp();
  const [name, setName] = useState('');

  const handleDone = () => {
    if (name.trim()) {
      saveUserName(name.trim());
      setScreen(SCREENS.SETUP_COMPLETE);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && name.trim()) handleDone();
  };

  return (
    <div className="screen nameinput-screen">
      {/* Background */}
      <div className="nameinput-ambient" aria-hidden="true">
        <div className="nameinput-blob nameinput-blob--one" />
        <div className="nameinput-blob nameinput-blob--two" />
        <div className="nameinput-blob nameinput-blob--three" />
      </div>

      <div className="nameinput-wrap">
        <div className="glass-panel nameinput-card animate-fade-in-up">
          <div className="nameinput-logo" aria-hidden="true">
            <img className="nameinput-logo-img" src={sageLogo} alt="" />
          </div>

          <div className="nameinput-head">
            <div className="nameinput-kicker">Welcome to Sage</div>
            <h1 className="nameinput-title">
              What should we <br /> call you?
            </h1>
          </div>

          <div className="nameinput-form">
            <label className="sr-only" htmlFor="sageNameInput">
              Your Name
            </label>
            <div className="nameinput-field">
              <img className="nameinput-field-icon" src={peopleIcon} alt="" />
              <input
                id="sageNameInput"
                type="text"
                className="nameinput-input"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="off"
              />
            </div>

            <button
              className="nameinput-btn"
              onClick={handleDone}
              disabled={!name.trim()}
              type="button"
            >
              <span className="nameinput-btn-content">
                Done <span className="nameinput-btn-arrow">→</span>
              </span>
              <span className="nameinput-btn-sheen" aria-hidden="true" />
            </button>
          </div>

          <div className="nameinput-dots" aria-hidden="true">
            <span className="nameinput-dot nameinput-dot--active" />
            <span className="nameinput-dot" />
            <span className="nameinput-dot" />
          </div>
        </div>

        <div className="nameinput-footer">Press Enter to continue</div>
      </div>
    </div>
  );
}
