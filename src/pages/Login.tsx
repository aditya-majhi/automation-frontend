// d:\AutomationModule\AutomationFrontend\automation-frontend\src\pages\Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FormInput from "../components/FormInput";
import { isAxiosError } from "axios";

const LoginPage = () => {
  const { login, token, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getLoginErrorMessage = (err: unknown): string => {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const apiMessage = String(
        err.response?.data?.message || "",
      ).toLowerCase();

      if (status === 400 || apiMessage.includes("required")) {
        return "Username or password is missing.";
      }

      if (status === 401 && apiMessage.includes("not registered")) {
        return "This email is not registered.";
      }

      if (
        status === 401 ||
        apiMessage.includes("wrong username or password") ||
        apiMessage.includes("invalid credentials")
      ) {
        return "Wrong username or password.";
      }

      if (status === 403 || apiMessage.includes("deactivated")) {
        return "Your account is deactivated. Contact your administrator.";
      }
    }

    return "Login failed. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err));
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
