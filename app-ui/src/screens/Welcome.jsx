import { useEffect, useState } from 'react';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function Welcome() {
  const { setScreen } = useApp();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Auto-transition to NAME_INPUT after 2 seconds
    const timer = setTimeout(() => {
      setFadeOut(true);
      // Wait for fade-out animation, then navigate
      setTimeout(() => {
        setScreen(SCREENS.NAME_INPUT);
      }, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [setScreen]);

  return (
    <div className={`screen ${fadeOut ? 'fade-out' : ''}`}>
      <h1 className="text-3xl" style={{ color: 'var(--color-text-primary)' }}>
        Hello
      </h1>
    </div>
  );
}
