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

    // Debug: log current screen
    console.log("Current screen:", screen);

    // 🔒 HARD SAFETY NET
    if (!screen) {
      console.log("No screen set, defaulting to SEARCH");
      return <Search />;
    }

    switch (screen) {
      case SCREENS.WELCOME:
        return <Welcome />;

      case SCREENS.NAME_INPUT:
        return <NameInput />;

      case SCREENS.SETUP_COMPLETE:
        return <SetupComplete />;

      case SCREENS.SEARCH:
        return <Search />;

      case SCREENS.SETTINGS:
        return <Settings />;

      case SCREENS.PROFILE:
        return <Profile />;

      default:
        return <Search />;
    }
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
