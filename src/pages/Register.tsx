import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FormInput from "../components/FormInput";

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Registration failed. Try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>🤖 Create Account</h2>
        <p style={styles.sub}>Start automating with Automation Recorder</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <FormInput
            label="Full Name"
            value={name}
            onChange={setName}
            placeholder="John Doe"
          />
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
            placeholder="Min. 6 characters"
          />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p style={styles.link}>
          Already have an account?{" "}
          <Link to="/login" style={styles.anchor}>
            Sign In
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

export default RegisterPage;
