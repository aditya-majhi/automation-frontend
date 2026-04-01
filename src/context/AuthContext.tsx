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

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        setAuthToken(savedToken);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const { setToken } = useExtension();

  // On app load, if we already have a token in localStorage, push it to extension
  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log({ token, setToken });

    if (token) {
      setToken(token);
    }
  }, [setToken]);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    const userData: User = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      roles: result.user.roles || [],
    };
    setToken(result.token);
    setAuthToken(result.token);
    setUser(userData);
    localStorage.setItem("token", result.token);
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
    setToken(result.token);
    setAuthToken(result.token);
    setUser(userData);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const isAuthenticated = Boolean(token && user); // ← ADD THIS
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
