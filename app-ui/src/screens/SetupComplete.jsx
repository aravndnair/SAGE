import { useEffect, useState } from 'react';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function SetupComplete() {
  const { setScreen, markOnboardingComplete } = useApp();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger confetti after a brief moment
    setTimeout(() => setShowConfetti(true), 100);

    // Auto-transition to SEARCH after 3 seconds
    const timer = setTimeout(() => {
      markOnboardingComplete();
      setScreen(SCREENS.SEARCH);
    }, 3000);

    return () => clearTimeout(timer);
  }, [setScreen, markOnboardingComplete]);

  // Generate confetti pieces
  const confettiPieces = showConfetti ? Array.from({ length: 60 }, (_, i) => {
    const colors = ['#007aff', '#34c759', '#ff3b30', '#ff9500', '#af52de', '#5856d6', '#ff2d55'];
    
    // Create radial burst pattern
    const angle = (Math.PI * 2 * i) / 60;
    const velocity = 200 + Math.random() * 150;
    const xTarget = Math.cos(angle) * velocity;
    const yTarget = Math.sin(angle) * velocity - 100; // Slight upward bias
    
    const delay = Math.random() * 0.2;
    const duration = 2.8 + Math.random() * 0.8;
    const rotation = (Math.random() - 0.5) * 1080;
    const size = 7 + Math.random() * 5;
    const isCircle = Math.random() > 0.4;
    
    return (
      <div
        key={i}
        className="confetti-piece"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: colors[Math.floor(Math.random() * colors.length)],
          borderRadius: isCircle ? '50%' : '2px',
          '--delay': `${delay}s`,
          '--duration': `${duration}s`,
          '--x-target': `${xTarget}px`,
          '--y-target': `${yTarget}px`,
          '--rotation': `${rotation}deg`,
        }}
      />
    );
  }) : [];

  return (
    <div className="screen">
      {confettiPieces}

      <h1 className="text-3xl" style={{ color: 'var(--color-text-primary)' }}>
        You're all set
      </h1>
    </div>
  );
}
