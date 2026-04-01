import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../api/services";
import FormInput from "../components/FormInput";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Dev only: store the token returned from API
  const [devToken, setDevToken] = useState("");

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await authService.forgotPassword(email);
      setMessage(result.message);
      // In dev mode, the API returns the token directly
      if (result.token) {
        setDevToken(result.token);
        setToken(result.token);
      }
      setStep("reset");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to request reset token";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resetPassword(token, newPassword);
      setMessage(result.message);
      setStep("done");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reset password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>🔑 Reset Password</h2>

        {step === "request" && (
          <>
            <p style={styles.sub}>Enter your email to receive a reset token</p>
            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}
            <form onSubmit={handleRequestToken}>
              <FormInput
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Token"}
              </button>
            </form>
          </>
        )}

        {step === "reset" && (
          <>
            <p style={styles.sub}>
              Enter the reset token and your new password
            </p>
            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}
            {devToken && (
              <div style={styles.devBox}>
                <span style={{ fontSize: "11px", color: "#fab387" }}>
                  ⚠️ DEV MODE — Token:
                </span>
                <code style={styles.devToken}>{devToken}</code>
              </div>
            )}
            <form onSubmit={handleResetPassword}>
              <FormInput
                label="Reset Token"
                type="text"
                value={token}
                onChange={setToken}
                placeholder="Paste your reset token"
              />
              <FormInput
                label="New Password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="••••••••"
              />
              <FormInput
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
              />
              <button style={styles.btn} type="submit" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <div style={styles.success}>✅ {message}</div>
            <Link
              to="/login"
              style={{
                ...styles.btn,
                display: "block",
                textAlign: "center",
                textDecoration: "none",
                marginTop: "16px",
              }}
            >
              Go to Login
            </Link>
          </>
        )}

        <p style={styles.link}>
          Remember your password?{" "}
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
    width: "420px",
    border: "1px solid #313244",
  },
  title: { margin: "0 0 6px", color: "#cba6f7", fontSize: "22px" },
  sub: { margin: "0 0 24px", color: "#6c7086", fontSize: "13px" },
  error: {
    backgroundColor: "#f38ba820",
    border: "1px solid #f38ba8",
    color: "#f38ba8",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  success: {
    backgroundColor: "#a6e3a120",
    border: "1px solid #a6e3a1",
    color: "#a6e3a1",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  devBox: {
    backgroundColor: "#fab38715",
    border: "1px solid #fab38750",
    borderRadius: "8px",
    padding: "10px 14px",
    marginBottom: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  devToken: {
    fontSize: "11px",
    color: "#cdd6f4",
    wordBreak: "break-all",
    backgroundColor: "#313244",
    padding: "6px 8px",
    borderRadius: "4px",
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
  anchor: { color: "#cba6f7" },
};

export default ForgotPasswordPage;
