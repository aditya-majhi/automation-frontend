import { useState, useEffect } from "react";
import { adminService } from "../api/services";
import { colors, commonStyles } from "../styles/common";

interface UserData {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; role: string }[];
}

interface RoleOption {
  value: string;
  label: string;
  description: string;
}

const RolesPage = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        adminService.getUsers(),
        adminService.getAvailableRoles(),
      ]);
      setUsers(usersData);
      setAvailableRoles(rolesData);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (
    userId: string,
    role: string,
    hasRole: boolean,
  ) => {
    setSaving(userId + role);
    setError("");
    try {
      if (hasRole) {
        await adminService.removeRole(userId, role);
      } else {
        await adminService.addRole(userId, role);
      }
      setSuccess(`Role ${hasRole ? "removed from" : "added to"} user`);
      await fetchData();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return { bg: "#f38ba830", color: "#f38ba8", border: "#f38ba850" };
      case "DEFINE_PROJECTS":
        return { bg: "#89b4fa30", color: "#89b4fa", border: "#89b4fa50" };
      case "EXECUTE_PROJECTS":
        return { bg: "#a6e3a130", color: "#a6e3a1", border: "#a6e3a150" };
      case "DEFINE_ASSIGNED_PROJECTS":
        return { bg: "#74c7ec30", color: "#74c7ec", border: "#74c7ec50" };
      default:
        return { bg: "#6c708630", color: "#6c7086", border: "#6c708650" };
    }
  };

  if (loading) {
    return (
      <div style={{ ...commonStyles.container, color: colors.textDim }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", color: colors.text }}>
          Role Management
        </h1>
        <p
          style={{ margin: "4px 0 0", color: colors.textDim, fontSize: "14px" }}
        >
          Assign roles to users. Click a role to toggle it.
        </p>
      </div>

      {success && (
        <div
          style={{
            backgroundColor: colors.successBg,
            border: `1px solid ${colors.success}`,
            color: colors.success,
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
          }}
        >
          ✅ {success}
        </div>
      )}
      {error && (
        <div
          style={{
            backgroundColor: colors.errorBg,
            border: `1px solid ${colors.error}`,
            color: colors.error,
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* Role Legend */}
      <div
        style={{
          ...commonStyles.card,
          marginBottom: "20px",
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        {availableRoles.map((role) => {
          const c = getRoleBadgeColor(role.value);
          return (
            <div
              key={role.value}
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <span
                style={{
                  ...commonStyles.badge,
                  backgroundColor: c.bg,
                  color: c.color,
                  padding: "5px 14px",
                  fontSize: "12px",
                }}
              >
                {role.label}
              </span>
              <span style={{ fontSize: "12px", color: colors.textDim }}>
                {role.description}
              </span>
            </div>
          );
        })}
      </div>

      {/* Role Matrix */}
      <div style={commonStyles.card}>
        <table style={commonStyles.table}>
          <thead>
            <tr>
              <th style={commonStyles.th}>User</th>
              {availableRoles.map((role) => (
                <th
                  key={role.value}
                  style={{ ...commonStyles.th, textAlign: "center" }}
                >
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={commonStyles.td}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: "12px", color: colors.textDim }}>
                      {user.email}
                    </div>
                  </div>
                </td>
                {availableRoles.map((role) => {
                  const hasRole = user.roles.some((r) => r.role === role.value);
                  const isSaving = saving === user.id + role.value;
                  const c = getRoleBadgeColor(role.value);
                  return (
                    <td
                      key={role.value}
                      style={{ ...commonStyles.td, textAlign: "center" }}
                    >
                      <button
                        onClick={() =>
                          handleToggleRole(user.id, role.value, hasRole)
                        }
                        disabled={isSaving}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          border: `2px solid ${hasRole ? c.color : colors.border}`,
                          backgroundColor: hasRole ? c.bg : "transparent",
                          color: hasRole ? c.color : colors.textMuted,
                          fontSize: "16px",
                          cursor: isSaving ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: isSaving ? 0.5 : 1,
                        }}
                      >
                        {isSaving ? "…" : hasRole ? "✓" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: colors.textDim,
            }}
          >
            No users found.
          </div>
        )}
      </div>
    </div>
  );
};

export default RolesPage;
