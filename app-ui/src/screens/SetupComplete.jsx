import { useEffect, useState } from 'react';
import { SCREENS, useApp } from '../state/appState';
import '../theme/theme.css';

export default function SetupComplete() {
  const { setScreen, markOnboardingComplete } = useApp();
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    // Generate confetti particles
    const particles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: ['#007aff', '#34c759', '#ff3b30', '#ff9500', '#af52de'][Math.floor(Math.random() * 5)]
    }));
    setConfetti(particles);

    // Auto-transition to SEARCH after 3 seconds
    const timer = setTimeout(() => {
      markOnboardingComplete();
      setScreen(SCREENS.SEARCH);
    }, 3000);

    return () => clearTimeout(timer);
  }, [setScreen, markOnboardingComplete]);

  return (
    <div className="screen">
      {/* Confetti Animation */}
      {confetti.map((particle) => (
        <div
          key={particle.id}
          className="confetti"
          style={{
            left: `${particle.left}%`,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      <h1 className="text-3xl" style={{ color: 'var(--color-text-primary)' }}>
        You're all set
      </h1>
    </div>
  );
}
