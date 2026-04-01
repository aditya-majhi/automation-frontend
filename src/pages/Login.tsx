// d:\AutomationModule\AutomationFrontend\automation-frontend\src\pages\Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FormInput from "../components/FormInput";

const LoginPage = () => {
  const { login, token, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    console.log("[LoginPage] submit start", { email });

    try {
      await login(email, password);

      console.log("[LoginPage] login resolved", {
        localStorageToken: localStorage.getItem("token"),
        localStorageUser: localStorage.getItem("user"),
      });

      navigate("/");
      console.log("[LoginPage] navigate('/') called");
    } catch (err: unknown) {
      console.error("[LoginPage] login failed", err);
      const msg =
        err instanceof Error ? err.message : "Login failed. Try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  console.log("[LoginPage] render", {
    token,
    user,
    isAdmin,
    authLoading,
    localStorageToken: localStorage.getItem("token"),
    localStorageUser: localStorage.getItem("user"),
  });

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>🤖 Sign In</h2>
        <p style={styles.sub}>Welcome back to Automation Recorder</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <FormInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <FormInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
          <div style={styles.forgotRow}>
            <Link to="/forgot-password" style={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p style={styles.link}>
          Don't have an account?{" "}
          <Link to="/register" style={styles.anchor}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#181825",
  },
  card: {
    backgroundColor: "#1e1e2e",
    padding: "36px",
    borderRadius: "14px",
    width: "380px",
    border: "1px solid #313244",
  },
  title: {
    margin: "0 0 6px",
    color: "#cba6f7",
    fontSize: "22px",
  },
  sub: {
    margin: "0 0 24px",
    color: "#6c7086",
    fontSize: "13px",
  },
  error: {
    backgroundColor: "#f38ba820",
    border: "1px solid #f38ba8",
    color: "#f38ba8",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  forgotRow: {
    textAlign: "right",
    marginBottom: "12px",
    marginTop: "-4px",
  },
  forgotLink: {
    color: "#6c7086",
    fontSize: "12px",
    textDecoration: "none",
  },
  btn: {
    width: "100%",
    padding: "11px",
    backgroundColor: "#cba6f7",
    color: "#1e1e2e",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "4px",
  },
  link: {
    textAlign: "center",
    marginTop: "18px",
    fontSize: "13px",
    color: "#6c7086",
  },
  anchor: {
    color: "#cba6f7",
  },
};

export default LoginPage;
