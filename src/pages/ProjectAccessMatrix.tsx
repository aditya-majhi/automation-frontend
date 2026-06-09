import { useEffect, useState } from "react";
import { adminService } from "../api/services";
import { colors, commonStyles } from "../styles/common";

type User = {
  id: string;
  name: string;
  email: string;
};

type UserProject = {
  id: string;
  name: string;
  description?: string | null;
  relation?: "owner" | "member" | string;
};

export default function ProjectAccessMatrixPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [userProjects, setUserProjects] = useState<
    Record<string, UserProject[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const usersData = await adminService.getUsers();
      setUsers(usersData);

      const pairs = await Promise.all(
        usersData.map(async (u: User) => {
          const projects = await adminService.getUserProjects(u.id);
          return [u.id, projects] as const;
        }),
      );

      const map: Record<string, UserProject[]> = {};
      for (const [uid, projects] of pairs) map[uid] = projects || [];
      setUserProjects(map);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (userId: string, projectId: string) => {
    try {
      setBusyKey(userId + ":" + projectId);
      setError("");
      await adminService.unmapUserFromProject(projectId, userId);
      setSuccess("Project access revoked");
      await load();
      setTimeout(() => setSuccess(""), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to revoke");
    } finally {
      setBusyKey("");
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
      <h1 style={{ marginTop: 0, color: colors.text }}>
        Project Access Matrix
      </h1>
      <p style={{ color: colors.textDim, marginTop: -6 }}>
        View which projects are mapped to which users and revoke mapped access.
      </p>

      {success && (
        <div
          style={{
            backgroundColor: colors.successBg,
            border: `1px solid ${colors.success}`,
            color: colors.success,
            padding: "10px 12px",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {success}
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: colors.errorBg,
            border: `1px solid ${colors.error}`,
            color: colors.error,
            padding: "10px 12px",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={commonStyles.card}>
        <table style={commonStyles.table}>
          <thead>
            <tr>
              <th style={commonStyles.th}>User</th>
              <th style={commonStyles.th}>Projects</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const projects = userProjects[u.id] || [];
              return (
                <tr key={u.id}>
                  <td style={commonStyles.td}>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: colors.textDim, fontSize: 12 }}>
                      {u.email}
                    </div>
                  </td>
                  <td style={commonStyles.td}>
                    {projects.length === 0 ? (
                      <span style={{ color: colors.textDim }}>No projects</span>
                    ) : (
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                      >
                        {projects.map((p) => {
                          const isOwner = p.relation === "owner";
                          const key = u.id + ":" + p.id;
                          return (
                            <div
                              key={p.id}
                              style={{
                                border: "1px solid #45475a",
                                borderRadius: 8,
                                padding: "6px 8px",
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                background: isOwner ? "#89b4fa20" : "#1e1e2e",
                              }}
                            >
                              <span>{p.name}</span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: isOwner ? "#89b4fa" : "#a6e3a1",
                                }}
                              >
                                {isOwner ? "owner" : "mapped"}
                              </span>
                              {!isOwner && (
                                <button
                                  type="button"
                                  disabled={busyKey === key}
                                  onClick={() => revoke(u.id, p.id)}
                                  style={{
                                    border: "1px solid #f38ba850",
                                    color: "#f38ba8",
                                    background: "transparent",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    padding: "2px 6px",
                                    cursor: "pointer",
                                  }}
                                >
                                  {busyKey === key ? "..." : "Revoke"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
