import { useState, useEffect } from "react";
import { adminService, projectService } from "../api/services";
import { colors, commonStyles } from "../styles/common";

interface UserData {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { role: string }[];
}

interface ProjectData {
  id: string;
  name: string;
  description?: string;
}

interface ProjectUserMapping {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    roles: { role: string }[];
  };
}

const ProjectMappingPage = () => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [mappedUsers, setMappedUsers] = useState<ProjectUserMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectUsers(selectedProject);
    } else {
      setMappedUsers([]);
    }
  }, [selectedProject]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [projectsData, usersData] = await Promise.all([
        projectService.getAll(),
        adminService.getUsers(),
      ]);
      setProjects(projectsData);
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectUsers = async (projectId: string) => {
    try {
      setMappingLoading(true);
      const data = await adminService.getProjectUsers(projectId);
      setMappedUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setMappingLoading(false);
    }
  };

  const handleMapUser = async () => {
    if (!selectedProject || !selectedUser) return;
    setError("");
    try {
      await adminService.mapUserToProject(selectedProject, selectedUser);
      setSuccess("User mapped to project successfully");
      setSelectedUser("");
      fetchProjectUsers(selectedProject);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleUnmapUser = async (userId: string, userName: string) => {
    if (!selectedProject) return;
    if (!window.confirm(`Remove "${userName}" from this project?`)) return;
    try {
      await adminService.unmapUserFromProject(selectedProject, userId);
      setSuccess("User removed from project");
      fetchProjectUsers(selectedProject);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  };

  // Filter out users already mapped
  const mappedUserIds = new Set(mappedUsers.map((m) => m.user.id));
  const unmappedUsers = users.filter((u) => !mappedUserIds.has(u.id));

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
        Loading...
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", color: colors.text }}>
          Project Mapping
        </h1>
        <p
          style={{ margin: "4px 0 0", color: colors.textDim, fontSize: "14px" }}
        >
          Map users to projects to grant access
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

      {/* Project Selector */}
      <div style={{ ...commonStyles.card, marginBottom: "20px" }}>
        <label style={commonStyles.label}>Select Project</label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          style={{ ...commonStyles.input, cursor: "pointer" }}
        >
          <option value="">-- Choose a project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.description ? ` — ${p.description}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedProject && (
        <>
          {/* Add User Section */}
          <div style={{ ...commonStyles.card, marginBottom: "20px" }}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: "16px",
                color: colors.text,
              }}
            >
              Add User to Project
            </h3>
            <div
              style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}
            >
              <div style={{ flex: 1 }}>
                <label style={commonStyles.label}>Select User</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  style={{ ...commonStyles.input, cursor: "pointer" }}
                >
                  <option value="">-- Choose a user --</option>
                  {unmappedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                style={{ ...commonStyles.btn, whiteSpace: "nowrap" }}
                onClick={handleMapUser}
                disabled={!selectedUser}
              >
                + Add to Project
              </button>
            </div>
            {unmappedUsers.length === 0 && (
              <p
                style={{
                  margin: "12px 0 0",
                  color: colors.textMuted,
                  fontSize: "13px",
                }}
              >
                All users are already mapped to this project.
              </p>
            )}
          </div>

          {/* Mapped Users Table */}
          <div style={commonStyles.card}>
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: "16px",
                color: colors.text,
              }}
            >
              Mapped Users ({mappedUsers.length})
            </h3>

            {mappingLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "30px",
                  color: colors.textDim,
                }}
              >
                Loading...
              </div>
            ) : (
              <table style={commonStyles.table}>
                <thead>
                  <tr>
                    <th style={commonStyles.th}>Name</th>
                    <th style={commonStyles.th}>Email</th>
                    <th style={commonStyles.th}>Roles</th>
                    <th style={commonStyles.th}>Status</th>
                    <th style={commonStyles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedUsers.map((mapping) => (
                    <tr key={mapping.id}>
                      <td style={commonStyles.td}>
                        <span style={{ fontWeight: 600 }}>
                          {mapping.user.name}
                        </span>
                      </td>
                      <td style={commonStyles.td}>
                        <span style={{ color: colors.textDim }}>
                          {mapping.user.email}
                        </span>
                      </td>
                      <td style={commonStyles.td}>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          {mapping.user.roles.map((r, i) => {
                            const c = getRoleBadgeColor(r.role);
                            return (
                              <span
                                key={i}
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
                        <span
                          style={{
                            ...commonStyles.badge,
                            backgroundColor: mapping.user.isActive
                              ? colors.successBg
                              : colors.errorBg,
                            color: mapping.user.isActive
                              ? colors.success
                              : colors.error,
                          }}
                        >
                          {mapping.user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={commonStyles.td}>
                        <button
                          style={{
                            ...commonStyles.btnSmall,
                            backgroundColor: colors.errorBg,
                            color: colors.error,
                          }}
                          onClick={() =>
                            handleUnmapUser(mapping.user.id, mapping.user.name)
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!mappingLoading && mappedUsers.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: colors.textDim,
                }}
              >
                No users mapped to this project yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectMappingPage;
