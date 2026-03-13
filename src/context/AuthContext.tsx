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
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  // extension integration
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
    const data = await authService.login(email, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);

    // sync JWT to extension so its API calls don't get 401
    setToken(data.token);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await authService.register(name, email, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);

    // sync JWT to extension after registration as well
    setToken(data.token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    // optional: you can also clear the token in the extension if you extend SET_TOKEN to handle null
    // setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
