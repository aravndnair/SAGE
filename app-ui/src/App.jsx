import { useEffect, useRef, useState } from "react";
import IndexingLogs from "./screens/IndexingLogs.jsx";
import NameInput from "./screens/NameInput.jsx";
import Profile from "./screens/Profile.jsx";
import Search from "./screens/Search.jsx";
import Settings from "./screens/Settings.jsx";
import SetupComplete from "./screens/SetupComplete.jsx";
import Welcome from "./screens/Welcome.jsx";
import { SCREENS, useApp } from "./state/appState.jsx";
import "./theme/theme.css";

export default function App() {
  try {
    const { screen } = useApp();

    const TRANSITION_MS = 350;
    const [activeScreen, setActiveScreen] = useState(screen);
    const [outgoingScreen, setOutgoingScreen] = useState(null);
    const activeRef = useRef(activeScreen);

    useEffect(() => {
      activeRef.current = activeScreen;
    }, [activeScreen]);

    useEffect(() => {
      if (!screen) return;
      if (screen === activeRef.current) return;

      setOutgoingScreen(activeRef.current);
      setActiveScreen(screen);

      const timer = setTimeout(() => {
        setOutgoingScreen(null);
      }, TRANSITION_MS);

      return () => clearTimeout(timer);
    }, [screen]);

    // Debug: log current screen
    console.log("Current screen:", screen);

    // 🔒 HARD SAFETY NET
    if (!screen) {
      console.log("No screen set, defaulting to SEARCH");
      return <Search />;
    }

    const renderScreen = (screenId) => {
      switch (screenId) {
        case SCREENS.WELCOME:
          return <Welcome />;
        case SCREENS.NAME_INPUT:
          return <NameInput />;
        case SCREENS.SETUP_COMPLETE:
          return <SetupComplete />;
        case SCREENS.SEARCH:
          return <Search />;
        case SCREENS.INDEXING_LOGS:
          return <IndexingLogs />;
        case SCREENS.SETTINGS:
          return <Settings />;
        case SCREENS.PROFILE:
          return <Profile />;
        default:
          return <Search />;
      }
    };

    return (
      <div className="sage-screen-stack">
        {outgoingScreen && (
          <div className="sage-screen-layer sage-screen-layer--out" aria-hidden="true">
            {renderScreen(outgoingScreen)}
          </div>
        )}
        <div className="sage-screen-layer sage-screen-layer--in">
          {renderScreen(activeScreen)}
        </div>
      </div>
    );
  } catch (error) {
    console.error("App Error:", error);
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#ff3b30' }}>Error Loading App</h1>
        <p style={{ color: '#6e6e73' }}>{error.message}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            background: '#007aff',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer'
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
