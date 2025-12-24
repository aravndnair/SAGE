import { useState } from 'react';
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && name.trim()) {
      handleDone();
    }
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xl)' }}>
        <h2 className="text-2xl text-center" style={{ color: 'var(--color-text-primary)' }}>
          What's your name?
        </h2>
        
        <input
          type="text"
          className="glass-input"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
          autoFocus
          style={{
            width: '360px',
            textAlign: 'center'
          }}
        />

        <button
          className="btn-primary"
          onClick={handleDone}
          disabled={!name.trim()}
        >
          Done
        </button>
      </div>
    </div>
  );
}
