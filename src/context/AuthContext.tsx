import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { authService } from "../api/services";
import { useExtension } from "../hooks/useExtension";

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  hasRole: (role: string) => boolean;
  loading: boolean;

  sessionPromptOpen: boolean;
  continueSession: () => Promise<void>;
  dismissSessionPrompt: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const SESSION_PROMPT_BEFORE_MS = 5 * 60 * 1000;
const SESSION_PROMPT_TIMEOUT_MS = 60 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessionPromptOpen, setSessionPromptOpen] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);

  const { setToken: setExtensionToken } = useExtension();

  const sessionPromptTimerRef = useRef<number | null>(null);
  const sessionDecisionTimerRef = useRef<number | null>(null);

  const clearSessionTimers = () => {
    if (sessionPromptTimerRef.current) {
      window.clearTimeout(sessionPromptTimerRef.current);
      sessionPromptTimerRef.current = null;
    }
    if (sessionDecisionTimerRef.current) {
      window.clearTimeout(sessionDecisionTimerRef.current);
      sessionDecisionTimerRef.current = null;
    }
  };

  const clearLocalAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessTokenExpiresAt");
    localStorage.removeItem("user");
    setExtensionToken(null);
    setAuthToken(null);
    setUser(null);
    setSessionPromptOpen(false);
  };

  const parseJwtExpiryMs = (jwtToken: string): number | null => {
    try {
      const parts = jwtToken.split(".");
      if (parts.length < 2) return null;

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));

      if (!payload || typeof payload.exp !== "number") return null;
      return payload.exp * 1000;
    } catch {
      return null;
    }
  };

  const openSessionPrompt = (autoLogout: () => void) => {
    setSessionPromptOpen(true);

    sessionDecisionTimerRef.current = window.setTimeout(() => {
      setSessionPromptOpen(false);
      autoLogout();
    }, SESSION_PROMPT_TIMEOUT_MS);
  };

  const scheduleSessionPrompt = (expMs: number, autoLogout: () => void) => {
    clearSessionTimers();

    const now = Date.now();
    const delay = expMs - now - SESSION_PROMPT_BEFORE_MS;

    if (delay <= 0) {
      openSessionPrompt(autoLogout);
      return;
    }

    sessionPromptTimerRef.current = window.setTimeout(() => {
      openSessionPrompt(autoLogout);
    }, delay);
  };

  const logout = () => {
    clearSessionTimers();
    const refreshToken = localStorage.getItem("refreshToken") || undefined;

    authService.logout(refreshToken).catch(() => {
      // ignore logout API errors during client sign-out
    });

    clearLocalAuth();
  };

  const persistSession = (input: {
    token: string;
    refreshToken: string;
    user?: User | null;
    accessTokenExpiresAt?: string | null;
  }) => {
    localStorage.setItem("token", input.token);
    localStorage.setItem("refreshToken", input.refreshToken);

    const expFromApi = input.accessTokenExpiresAt
      ? new Date(input.accessTokenExpiresAt).getTime()
      : NaN;
    const expFromJwt = parseJwtExpiryMs(input.token);
    const expMs =
      Number.isFinite(expFromApi) && expFromApi > 0
        ? expFromApi
        : expFromJwt || null;

    if (expMs) {
      localStorage.setItem(
        "accessTokenExpiresAt",
        new Date(expMs).toISOString(),
      );
    } else {
      localStorage.removeItem("accessTokenExpiresAt");
    }

    setAuthToken(input.token);
    setExtensionToken(input.token);

    if (input.user) {
      setUser(input.user);
      localStorage.setItem("user", JSON.stringify(input.user));
    }

    if (expMs) {
      scheduleSessionPrompt(expMs, logout);
    } else {
      clearSessionTimers();
    }
  };

  const continueSession = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      logout();
      return;
    }

    clearSessionTimers();
    setSessionPromptOpen(false);
    setRefreshingSession(true);

    try {
      const res = await authService.refresh(refreshToken);
      const nextToken = res?.token || res?.data?.token || "";
      const nextRefreshToken =
        res?.refreshToken || res?.data?.refreshToken || "";
      const nextExpiresAt =
        res?.accessTokenExpiresAt || res?.data?.accessTokenExpiresAt || null;

      if (!nextToken || !nextRefreshToken) {
        logout();
        return;
      }

      persistSession({
        token: nextToken,
        refreshToken: nextRefreshToken,
        accessTokenExpiresAt: nextExpiresAt,
      });
    } catch {
      logout();
    } finally {
      setRefreshingSession(false);
    }
  };

  const dismissSessionPrompt = () => {
    setSessionPromptOpen(false);
    logout();
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedRefreshToken = localStorage.getItem("refreshToken");
    const savedUser = localStorage.getItem("user");
    const savedExpiresAt = localStorage.getItem("accessTokenExpiresAt");

    if (savedToken && savedRefreshToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        persistSession({
          token: savedToken,
          refreshToken: savedRefreshToken,
          user: parsedUser,
          accessTokenExpiresAt: savedExpiresAt,
        });
      } catch {
        clearLocalAuth();
      }
    }

    setLoading(false);

    return () => {
      clearSessionTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onTokenRefreshed = (evt: Event) => {
      const event = evt as CustomEvent<{
        token: string;
        refreshToken: string;
        accessTokenExpiresAt?: string | null;
      }>;

      if (!event.detail?.token || !event.detail?.refreshToken) return;

      persistSession({
        token: event.detail.token,
        refreshToken: event.detail.refreshToken,
        accessTokenExpiresAt: event.detail.accessTokenExpiresAt || null,
      });
    };

    const onForcedLogout = () => {
      clearSessionTimers();
      clearLocalAuth();
    };

    window.addEventListener(
      "auth:token-refreshed",
      onTokenRefreshed as EventListener,
    );
    window.addEventListener("auth:forced-logout", onForcedLogout);

    return () => {
      window.removeEventListener(
        "auth:token-refreshed",
        onTokenRefreshed as EventListener,
      );
      window.removeEventListener("auth:forced-logout", onForcedLogout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);

    const userData: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roles: result.user.roles || [],
    };

    persistSession({
      token: result.token,
      refreshToken: result.refreshToken,
      user: userData,
      accessTokenExpiresAt: result.accessTokenExpiresAt || null,
    });
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authService.register(name, email, password);

    const userData: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roles: result.user.roles || [],
    };

    persistSession({
      token: result.token,
      refreshToken: result.refreshToken,
      user: userData,
      accessTokenExpiresAt: result.accessTokenExpiresAt || null,
    });
  };

  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.roles?.includes("ADMIN") ?? false;

  const hasRole = (role: string) => {
    if (!user?.roles) return false;
    if (user.roles.includes("ADMIN")) return true;
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        login,
        register,
        logout,
        isAdmin,
        hasRole,
        loading,
        sessionPromptOpen,
        continueSession,
        dismissSessionPrompt,
      }}
    >
      {children}

      {sessionPromptOpen && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.card}>
            <h3 style={modalStyles.title}>Session Expiring Soon</h3>
            <p style={modalStyles.text}>
              Your session is about to expire. Do you want to continue?
            </p>
            <p style={modalStyles.subText}>
              If no action is taken for 60 seconds, you will be logged out.
            </p>
            <div style={modalStyles.actions}>
              <button
                type="button"
                style={modalStyles.secondary}
                onClick={dismissSessionPrompt}
                disabled={refreshingSession}
              >
                Logout
              </button>
              <button
                type="button"
                style={modalStyles.primary}
                onClick={continueSession}
                disabled={refreshingSession}
              >
                {refreshingSession ? "Refreshing..." : "Continue Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#00000099",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  card: {
    width: "min(420px, 92vw)",
    backgroundColor: "#1e1e2e",
    border: "1px solid #45475a",
    borderRadius: 12,
    padding: 20,
    color: "#cdd6f4",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: 18,
    color: "#f5c2e7",
  },
  text: {
    margin: "0 0 8px 0",
    fontSize: 14,
  },
  subText: {
    margin: "0 0 14px 0",
    fontSize: 12,
    color: "#a6adc8",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondary: {
    background: "#45475a",
    border: "1px solid #45475a",
    color: "#cdd6f4",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },
  primary: {
    background: "#89b4fa20",
    border: "1px solid #89b4fa",
    color: "#89b4fa",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
};
