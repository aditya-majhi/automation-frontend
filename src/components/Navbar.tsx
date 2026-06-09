import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout, isAdmin, hasRole } = useAuth();
  const navigate = useNavigate();

  const canAccessProjects =
    hasRole("DEFINE_PROJECTS") || hasRole("DEFINE_ASSIGNED_PROJECTS");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <Link to="/" style={styles.brand}>
          🤖 Automation Recorder
        </Link>

        <div style={styles.navLinks}>
          {canAccessProjects && (
            <Link to="/projects" style={styles.navLink}>
              Projects
            </Link>
          )}
          <Link to="/executions" style={styles.navLink}>
            Executions
          </Link>
        </div>
      </div>

      <div style={styles.right}>
        {isAdmin && (
          <Link to="/admin" style={styles.adminLink}>
            ⚙️ Admin
          </Link>
        )}
        <span style={styles.userName}>{user?.name}</span>
        <span style={styles.roleBadge}>
          {user?.roles?.includes("ADMIN")
            ? "Admin"
            : user?.roles?.join(", ") || "User"}
        </span>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </nav>
  );
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    backgroundColor: "#1e1e2e",
    borderBottom: "1px solid #313244",
    gap: "16px",
    flexWrap: "wrap",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },
  brand: {
    color: "#cba6f7",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "16px",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  navLink: {
    color: "#cdd6f4",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: "6px",
    backgroundColor: "#313244",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  adminLink: {
    color: "#fab387",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 600,
    padding: "6px 14px",
    backgroundColor: "#fab38720",
    borderRadius: "6px",
    border: "1px solid #fab38740",
  },
  userName: {
    color: "#cdd6f4",
    fontSize: "14px",
    fontWeight: 500,
  },
  roleBadge: {
    fontSize: "11px",
    padding: "3px 10px",
    borderRadius: "12px",
    backgroundColor: "#cba6f720",
    color: "#cba6f7",
    fontWeight: 600,
  },
  logoutBtn: {
    padding: "7px 16px",
    backgroundColor: "transparent",
    color: "#f38ba8",
    border: "1px solid #f38ba850",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: 500,
  },
};

export default Navbar;
