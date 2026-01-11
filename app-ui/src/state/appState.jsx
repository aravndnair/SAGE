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
  INDEXING_LOGS: "INDEXING_LOGS",
  PROFILE: "PROFILE",
  SETTINGS: "SETTINGS",
  ACKNOWLEDGEMENT: "ACKNOWLEDGEMENT",
  DEEPDIVE: "DEEPDIVE",
});

const AppContext = createContext(null);

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: "sage_onboarding_complete",
  HELLO_SEEN: "sage_seen_hello",
  USER_NAME: "sage_user_name",
  USER_ROUTES: "sage_user_routes",
  // Persisted Indexing Logs (search history)
  INDEXING_LOGS_QUERY: "sage_indexing_logs_query",
  INDEXING_LOGS_RESULTS: "sage_indexing_logs_results",

  // Back-compat (older builds persisted last search directly into Search)
  LAST_SEARCH_QUERY: "sage_last_search_query",
  LAST_SEARCH_RESULTS: "sage_last_search_results",
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

function hasSeenHello() {
  try {
    return localStorage.getItem(STORAGE_KEYS.HELLO_SEEN) === "true";
  } catch {
    return false;
  }
}

/**
 * Determine initial screen based on onboarding status
 */
function getInitialScreen() {
  if (hasCompletedOnboarding()) return SCREENS.SEARCH;
  // Show the Hello screen only once, on the first-ever launch.
  return hasSeenHello() ? SCREENS.NAME_INPUT : SCREENS.WELCOME;
}

export function AppProvider({ children }) {
  const [screen, _setScreen] = useState(getInitialScreen());
  const [userName, setUserName] = useState("");
  const [routes, setRoutes] = useState([]);
  const [searchQuery, _setSearchQuery] = useState("");
  const [searchResults, _setSearchResults] = useState([]);
  const [indexingLogsQuery, _setIndexingLogsQuery] = useState('');
  const [indexingLogsResults, _setIndexingLogsResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRoutes, setPendingRoutes] = useState([]); // Routes before acknowledgement
  
  // DeepDive state
  const [deepdiveSessionId, setDeepDiveSessionId] = useState(null);

  // Load user data from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(STORAGE_KEYS.USER_NAME);
      if (savedName) setUserName(savedName);

      // Indexing Logs persist across restarts.
      // IMPORTANT: We do NOT hydrate Search screen with old results.
      const savedLogsQuery = localStorage.getItem(STORAGE_KEYS.INDEXING_LOGS_QUERY);
      const savedLogsResultsRaw = localStorage.getItem(STORAGE_KEYS.INDEXING_LOGS_RESULTS);

      if (typeof savedLogsQuery === 'string') {
        _setIndexingLogsQuery(savedLogsQuery);
      }

      if (savedLogsResultsRaw) {
        const parsed = JSON.parse(savedLogsResultsRaw);
        if (Array.isArray(parsed)) {
          _setIndexingLogsResults(parsed);
        }
      }

      // Back-compat migration: if old keys exist but new keys don't, migrate once.
      if (!savedLogsQuery && !savedLogsResultsRaw) {
        const legacyQuery = localStorage.getItem(STORAGE_KEYS.LAST_SEARCH_QUERY);
        const legacyResultsRaw = localStorage.getItem(STORAGE_KEYS.LAST_SEARCH_RESULTS);

        if (typeof legacyQuery === 'string') {
          _setIndexingLogsQuery(legacyQuery);
          localStorage.setItem(STORAGE_KEYS.INDEXING_LOGS_QUERY, legacyQuery);
        }

        if (legacyResultsRaw) {
          try {
            const legacyParsed = JSON.parse(legacyResultsRaw);
            if (Array.isArray(legacyParsed)) {
              _setIndexingLogsResults(legacyParsed);
              localStorage.setItem(STORAGE_KEYS.INDEXING_LOGS_RESULTS, JSON.stringify(legacyParsed));
            }
          } catch {
            // ignore
          }
        }
      }
      
      // FORCE CLEAR routes from localStorage to prevent stale duplicates
      localStorage.removeItem(STORAGE_KEYS.USER_ROUTES);
      console.log('[SAGE] Cleared localStorage routes - backend is the single source of truth');
      
      // Routes will be loaded by Settings/Search screens from backend API
    } catch (err) {
      console.error("[SAGE] Failed to load user data:", err);
    }
  }, []);

  /**
   * Search state is session-only (fresh results).
   * Indexing Logs are persisted separately.
   */
  const setSearchQuery = (nextQuery) => _setSearchQuery(String(nextQuery ?? ''));

  const setSearchResults = (nextResults) => {
    const safeResults = Array.isArray(nextResults) ? nextResults.slice(0, 50) : [];
    _setSearchResults(safeResults);
  };

  const setIndexingLogs = (nextQuery, nextResults) => {
    const safeQuery = String(nextQuery ?? '');
    const safeResults = Array.isArray(nextResults) ? nextResults.slice(0, 50) : [];

    _setIndexingLogsQuery(safeQuery);
    _setIndexingLogsResults(safeResults);

    try {
      localStorage.setItem(STORAGE_KEYS.INDEXING_LOGS_QUERY, safeQuery);
      localStorage.setItem(STORAGE_KEYS.INDEXING_LOGS_RESULTS, JSON.stringify(safeResults));
    } catch (err) {
      console.error('[SAGE] Failed to persist indexing logs:', err);
    }
  };

  const clearIndexingLogs = () => {
    // Clear all search and indexing state
    setIsSearching(false);
    _setSearchQuery('');
    _setSearchResults([]);
    _setIndexingLogsQuery('');
    _setIndexingLogsResults([]);
    
    try {
      localStorage.removeItem(STORAGE_KEYS.INDEXING_LOGS_QUERY);
      localStorage.removeItem(STORAGE_KEYS.INDEXING_LOGS_RESULTS);
      localStorage.removeItem(STORAGE_KEYS.LAST_SEARCH_QUERY);
      localStorage.removeItem(STORAGE_KEYS.LAST_SEARCH_RESULTS);
    } catch (err) {
      console.error('[SAGE] Failed to clear indexing logs:', err);
    }
  };

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
        indexingLogsQuery,
        indexingLogsResults,
        setIndexingLogs,
        clearIndexingLogs,
        isSearching,
        setIsSearching,
        pendingRoutes,
        setPendingRoutes,
        markOnboardingComplete,
        // DeepDive
        deepdiveSessionId,
        setDeepDiveSessionId,
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
