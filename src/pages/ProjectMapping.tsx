import { useState, useEffect } from "react";
import { adminService, projectService } from "../api/services";
import { colors, commonStyles } from "../styles/common";
import Select from "react-select";

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

type SelectOption = { value: string; label: string };

const ProjectMappingPage = () => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [targetUserId, setTargetUserId] = useState("");
  const [selectedProjectOptions, setSelectedProjectOptions] = useState<
    SelectOption[]
  >([]);

  //User and Project options for dropdowns
  const userOptions: SelectOption[] = users.map((u) => ({
    value: u.id,
    label: `${u.name} (${u.email})`,
  }));

  const projectOptions: SelectOption[] = projects.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const handleAssignProjectsToUser = async () => {
    if (!targetUserId || selectedProjectOptions.length === 0) return;
    setError("");
    try {
      await adminService.assignProjectsToUser(
        targetUserId,
        selectedProjectOptions.map((p) => p.value),
      );
      setSuccess("Projects assigned successfully");
      setSelectedProjectOptions([]);
      await fetchAvailableProjectsForUser(targetUserId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!targetUserId) {
      setProjects([]);
      setSelectedProjectOptions([]);
      return;
    }

    setSelectedProjectOptions([]);
    fetchAvailableProjectsForUser(targetUserId);
  }, [targetUserId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const usersData = await adminService.getUsers();
      setUsers(usersData);
      setProjects([]);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProjectsForUser = async (userId: string) => {
    try {
      setError("");
      const projectsData =
        await adminService.getAvailableProjectsForUser(userId);
      setProjects(projectsData || []);
    } catch (err: any) {
      setProjects([]);
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to load projects",
      );
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return { bg: "#f38ba830", color: "#f38ba8" };
      case "DEFINE_PROJECTS":
        return { bg: "#89b4fa30", color: "#89b4fa" };
      case "EXECUTE_PROJECTS":
        return { bg: "#a6e3a130", color: "#a6e3a1" };
      case "DEFINE_ASSIGNED_PROJECTS":
        return { bg: "#74c7ec30", color: "#74c7ec" };
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
        <h3
          style={{ margin: "0 0 14px", fontSize: "16px", color: colors.text }}
        >
          Assign Multiple Projects to One User
        </h3>

        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <label style={commonStyles.label}>Select User</label>
            <Select
              options={userOptions}
              value={userOptions.find((u) => u.value === targetUserId) || null}
              onChange={(opt) => setTargetUserId(opt?.value || "")}
              isClearable
            />
          </div>

          <div>
            <label style={commonStyles.label}>Select Projects</label>
            <Select
              options={projectOptions}
              value={selectedProjectOptions}
              onChange={(opts) =>
                setSelectedProjectOptions((opts as SelectOption[]) || [])
              }
              isMulti
              closeMenuOnSelect={false}
            />
          </div>

          <button
            style={{ ...commonStyles.btn, width: "fit-content" }}
            onClick={handleAssignProjectsToUser}
            disabled={!targetUserId || selectedProjectOptions.length === 0}
          >
            Assign Projects
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectMappingPage;
