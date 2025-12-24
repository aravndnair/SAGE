import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function Profile() {
  const { setScreen, userName } = useApp();

  return (
    <div className="screen">
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '0 var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-xl)'
      }}>
        {/* Back Button */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          <button className="btn-icon" onClick={() => setScreen(SCREENS.SEARCH)} title="Back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10H5M5 10l4 4M5 10l4-4" />
            </svg>
          </button>
        </div>

        {/* Profile Content */}
        <div className="glass-card" style={{ 
          padding: 'var(--spacing-2xl)',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #5856d6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--spacing-lg)',
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-white)'
          }}>
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>

          <h2 className="text-2xl" style={{ 
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            {userName || 'User'}
          </h2>

          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Welcome to SAGE
          </p>
        </div>
      </div>
    </div>
  );
}
