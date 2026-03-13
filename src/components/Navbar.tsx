import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <span style={styles.brand} onClick={() => navigate("/")}>
        🤖 Automation Recorder
      </span>
      {isAuthenticated && (
        <div style={styles.right}>
          <span style={styles.userText}>👤 {user?.name}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    backgroundColor: "#1e1e2e",
    color: "#fff",
    borderBottom: "1px solid #313244",
  },
  brand: {
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "pointer",
    color: "#cba6f7",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  userText: {
    fontSize: "14px",
    color: "#a6e3a1",
  },
  logoutBtn: {
    padding: "6px 14px",
    backgroundColor: "#f38ba8",
    color: "#1e1e2e",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default Navbar;
