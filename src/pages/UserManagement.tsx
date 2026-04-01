import { useState, useEffect } from "react";
import { adminService } from "../api/services";
import { colors, commonStyles } from "../styles/common";

interface UserData {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  roles: { id: string; role: string }[];
  projectMappings: { id: string; project: { id: string; name: string } }[];
}

interface RoleOption {
  value: string;
  label: string;
  description: string;
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

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

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRoles([]);
    setFormIsActive(true);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword("");
    setFormRoles(user.roles.map((r) => r.role));
    setFormIsActive(user.isActive);
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editingUser) {
        const updateData: any = {
          name: formName,
          email: formEmail,
          isActive: formIsActive,
        };
        if (formPassword) updateData.password = formPassword;
        await adminService.updateUser(editingUser.id, updateData);
        await adminService.assignRoles(editingUser.id, formRoles);
        setSuccess("User updated successfully");
      } else {
        if (!formPassword) {
          setError("Password is required");
          return;
        }
        await adminService.createUser({
          name: formName,
          email: formEmail,
          password: formPassword,
          roles: formRoles,
        });
        setSuccess("User created successfully");
      }
      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Operation failed",
      );
    }
  };

  const handleDelete = async (user: UserData) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name}"?`))
      return;
    try {
      await adminService.deleteUser(user.id);
      setSuccess("User deleted successfully");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const toggleRole = (role: string) => {
    setFormRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return { bg: "#f38ba830", color: "#f38ba8" };
      case "DEFINE_PROJECTS":
        return { bg: "#89b4fa30", color: "#89b4fa" };
      case "EXECUTE_PROJECTS":
        return { bg: "#a6e3a130", color: "#a6e3a1" };
      default:
        return { bg: "#6c708630", color: "#6c7086" };
    }
  };

  if (loading) {
    return (
      <div style={{ ...commonStyles.container, color: colors.textDim }}>
        {" "}
        Loading users...
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: colors.text }}>
            {" "}
            User Management{" "}
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              color: colors.textDim,
              fontSize: "14px",
            }}
          >
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button style={commonStyles.btn} onClick={openCreateModal}>
          + Create User
        </button>
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
          {success}
        </div>
      )}
      {error && !showModal && (
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

      <div style={commonStyles.card}>
        <table style={commonStyles.table}>
          <thead>
            <tr>
              <th style={commonStyles.th}> Name </th>
              <th style={commonStyles.th}> Email </th>
              <th style={commonStyles.th}> Roles </th>
              <th style={commonStyles.th}> Projects </th>
              <th style={commonStyles.th}> Status </th>
              <th style={commonStyles.th}> Actions </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={commonStyles.td}>
                  <span style={{ fontWeight: 600 }}> {user.name} </span>
                </td>
                <td style={commonStyles.td}>
                  <span style={{ color: colors.textDim }}> {user.email} </span>
                </td>
                <td style={commonStyles.td}>
                  <div
                    style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
                  >
                    {user.roles.length === 0 && (
                      <span
                        style={{ color: colors.textMuted, fontSize: "12px" }}
                      >
                        {" "}
                        No roles{" "}
                      </span>
                    )}
                    {user.roles.map((r) => {
                      const c = getRoleBadgeColor(r.role);
                      return (
                        <span
                          key={r.id}
                          style={{
                            ...commonStyles.badge,
                            backgroundColor: c.bg,
                            color: c.color,
                          }}
                        >
                          {r.role}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td style={commonStyles.td}>
                  <span style={{ color: colors.textDim, fontSize: "13px" }}>
                    {user.projectMappings.length} project
                    {user.projectMappings.length !== 1 ? "s" : ""}
                  </span>
                </td>
                <td style={commonStyles.td}>
                  <span
                    style={{
                      ...commonStyles.badge,
                      backgroundColor: user.isActive
                        ? colors.successBg
                        : colors.errorBg,
                      color: user.isActive ? colors.success : colors.error,
                    }}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={commonStyles.td}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      style={{
                        ...commonStyles.btnSmall,
                        backgroundColor: colors.infoBg,
                        color: colors.info,
                      }}
                      onClick={() => openEditModal(user)}
                    >
                      Edit
                    </button>
                    <button
                      style={{
                        ...commonStyles.btnSmall,
                        backgroundColor: colors.errorBg,
                        color: colors.error,
                      }}
                      onClick={() => handleDelete(user)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
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
            No users found.Create one to get started.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h2
              style={{
                margin: "0 0 20px",
                color: colors.primary,
                fontSize: "18px",
              }}
            >
              {editingUser ? "Edit User" : "Create User"}
            </h2>

            {error && (
              <div
                style={{
                  backgroundColor: colors.errorBg,
                  border: `1px solid ${colors.error}`,
                  color: colors.error,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={commonStyles.label}> Name </label>
                <input
                  style={commonStyles.input}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={commonStyles.label}> Email </label>
                <input
                  style={commonStyles.input}
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={commonStyles.label}>
                  Password{" "}
                  {editingUser && (
                    <span style={{ color: colors.textMuted }}>
                      {" "}
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  style={commonStyles.input}
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : "Min 6 characters"}
                  required={!editingUser}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={commonStyles.label}> Roles </label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {availableRoles.map((role) => (
                    <label
                      key={role.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        backgroundColor: formRoles.includes(role.value)
                          ? colors.primaryDim
                          : colors.surfaceLight,
                        border: `1px solid ${formRoles.includes(role.value) ? colors.primary : colors.border}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        style={{ accentColor: colors.primary }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: colors.text,
                          }}
                        >
                          {" "}
                          {role.label}{" "}
                        </div>
                        <div
                          style={{ fontSize: "11px", color: colors.textDim }}
                        >
                          {" "}
                          {role.description}{" "}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {editingUser && (
                <div style={{ marginBottom: "18px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      style={{ accentColor: colors.primary }}
                    />
                    <span style={{ fontSize: "13px", color: colors.text }}>
                      {" "}
                      Active Account{" "}
                    </span>
                  </label>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  style={commonStyles.btnOutline}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" style={commonStyles.btn}>
                  {editingUser ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#1e1e2e",
    borderRadius: "14px",
    border: "1px solid #313244",
    padding: "32px",
    width: "480px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
};

export default UsersPage;
