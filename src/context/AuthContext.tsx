import {
  createContext,
  useContext,
  useState,
  useEffect,
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { setToken: setExtensionToken } = useExtension();

  const clearLocalAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setExtensionToken(null);
    setAuthToken(null);
    setUser(null);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        setAuthToken(savedToken);
        setUser(parsedUser);
        setExtensionToken(savedToken);
      } catch {
        clearLocalAuth();
      }
    }

    setLoading(false);
  }, [setExtensionToken]);

  useEffect(() => {
    const existingToken = localStorage.getItem("token");
    if (existingToken) {
      setExtensionToken(existingToken);
    }
  }, [setExtensionToken]);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);

    const userData: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roles: result.user.roles || [],
    };

    setExtensionToken(result.token);
    setAuthToken(result.token);
    setUser(userData);

    localStorage.setItem("token", result.token);
    localStorage.setItem("refreshToken", result.refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authService.register(name, email, password);

    const userData: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roles: result.user.roles || [],
    };

    setExtensionToken(result.token);
    setAuthToken(result.token);
    setUser(userData);

    localStorage.setItem("token", result.token);
    localStorage.setItem("refreshToken", result.refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    const refreshToken = localStorage.getItem("refreshToken") || undefined;
    authService.logout(refreshToken).catch(() => {
      // ignore logout API errors during client sign-out
    });
    clearLocalAuth();
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
