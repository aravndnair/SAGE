import { createContext, useContext, useEffect, useState } from "react";

/**
 * All valid screens in the app.
 * DO NOT mutate dynamically.
 */
export const SCREENS = Object.freeze({
  WELCOME: "WELCOME",
  NAME_INPUT: "NAME_INPUT",
  SETUP_COMPLETE: "SETUP_COMPLETE",
  SEARCH: "SEARCH",
  PROFILE: "PROFILE",
  SETTINGS: "SETTINGS",
  ACKNOWLEDGEMENT: "ACKNOWLEDGEMENT",
});

const AppContext = createContext(null);

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: "sage_onboarding_complete",
  USER_NAME: "sage_user_name",
  USER_ROUTES: "sage_user_routes",
};

/**
 * Check if user has completed onboarding
 */
function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === "true";
  } catch {
    return false;
  }
}

/**
 * Determine initial screen based on onboarding status
 */
function getInitialScreen() {
  return hasCompletedOnboarding() ? SCREENS.SEARCH : SCREENS.WELCOME;
}

export function AppProvider({ children }) {
  const [screen, _setScreen] = useState(getInitialScreen());
  const [userName, setUserName] = useState("");
  const [routes, setRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRoutes, setPendingRoutes] = useState([]); // Routes before acknowledgement

  // Load user data from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(STORAGE_KEYS.USER_NAME);
      if (savedName) setUserName(savedName);
      
      // FORCE CLEAR routes from localStorage to prevent stale duplicates
      localStorage.removeItem(STORAGE_KEYS.USER_ROUTES);
      console.log('[SAGE] Cleared localStorage routes - backend is the single source of truth');
      
      // Routes will be loaded by Settings/Search screens from backend API
    } catch (err) {
      console.error("[SAGE] Failed to load user data:", err);
    }
  }, []);

  /**
   * Safe screen setter.
   * Prevents invalid screen values from breaking render.
   */
  const setScreen = (nextScreen) => {
    if (Object.values(SCREENS).includes(nextScreen)) {
      _setScreen(nextScreen);
    } else {
      console.warn(
        "[SAGE] Invalid screen requested:",
        nextScreen,
        "→ falling back to SEARCH"
      );
      _setScreen(SCREENS.SEARCH);
    }
  };

  /**
   * Save user name
   */
  const saveUserName = (name) => {
    setUserName(name);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
    } catch (err) {
      console.error("[SAGE] Failed to save user name:", err);
    }
  };

  /**
   * Save routes to localStorage
   */
  const saveRoutes = (newRoutes) => {
    // Deduplicate routes before saving
    const uniqueRoutes = [...new Set(newRoutes)];
    setRoutes(uniqueRoutes);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_ROUTES, JSON.stringify(uniqueRoutes));
    } catch (err) {
      console.error("[SAGE] Failed to save routes:", err);
    }
  };

  /**
   * Add a new route (max 5)
   */
  const addRoute = (path) => {
    if (routes.length >= 5) {
      return { success: false, error: "Maximum 5 routes allowed" };
    }
    if (routes.includes(path)) {
      return { success: false, error: "Route already exists" };
    }
    const newRoutes = [...routes, path];
    saveRoutes(newRoutes);
    return { success: true };
  };

  /**
   * Remove a route
   */
  const removeRoute = (path) => {
    const newRoutes = routes.filter((r) => r !== path);
    saveRoutes(newRoutes);
  };

  /**
   * Mark onboarding as complete
   * Should be called after setup is finished
   */
  const markOnboardingComplete = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
    } catch (err) {
      console.error("[SAGE] Failed to save onboarding state:", err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        setScreen,
        userName,
        saveUserName,
        routes,
        saveRoutes,
        addRoute,
        removeRoute,
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
        setIsSearching,
        pendingRoutes,
        setPendingRoutes,
        markOnboardingComplete,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error(
      "useApp() must be used inside <AppProvider>. App is misconfigured."
    );
  }

  return ctx;
}
