import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import React from "react";

const AdminLayout = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const navItems = [
    { to: "/admin/users", label: "👥 Users" },
    { to: "/admin/roles", label: "🛡️ Roles" },
    { to: "/admin/project-mapping", label: "📁 Project Mapping" },
  ];

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={{ fontSize: "18px" }}>⚙️</span>
          <span style={styles.brandText}>Admin Panel</span>
        </div>
        <div style={styles.userInfo}>
          <div style={styles.userName}>{user?.name}</div>
          <div style={styles.userEmail}>{user?.email}</div>
        </div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...styles.navItem,
                backgroundColor: isActive ? "#cba6f720" : "transparent",
                color: isActive ? "#cba6f7" : "#6c7086",
                borderLeft: isActive
                  ? "3px solid #cba6f7"
                  : "3px solid transparent",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <button onClick={() => navigate("/")} style={styles.backBtn}>
            ← Back to App
          </button>
          <button onClick={logout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#181825",
  },
  sidebar: {
    width: "250px",
    backgroundColor: "#1e1e2e",
    borderRight: "1px solid #313244",
    display: "flex",
    flexDirection: "column",
    padding: "0",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "20px 20px 16px",
    borderBottom: "1px solid #313244",
  },
  brandText: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#cba6f7",
  },
  userInfo: {
    padding: "16px 20px",
    borderBottom: "1px solid #313244",
  },
  userName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#cdd6f4",
  },
  userEmail: {
    fontSize: "12px",
    color: "#6c7086",
    marginTop: "2px",
  },
  nav: {
    flex: 1,
    padding: "12px 0",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  navItem: {
    display: "block",
    padding: "12px 20px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
    transition: "all 0.15s",
  },
  sidebarFooter: {
    padding: "16px 20px",
    borderTop: "1px solid #313244",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  backBtn: {
    width: "100%",
    padding: "10px",
    backgroundColor: "transparent",
    color: "#6c7086",
    border: "1px solid #313244",
    borderRadius: "8px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: 500,
  },
  logoutBtn: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#f38ba820",
    color: "#f38ba8",
    border: "1px solid #f38ba850",
    borderRadius: "8px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
  },
};

export default AdminLayout;
