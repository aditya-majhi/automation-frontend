import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { projectService } from "../api/services";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  moduleCount?: number;
  testCaseCount?: number;
}

const ProjectsPage = () => {
  const { hasRole } = useAuth();
  const canManageProjects = hasRole("DEFINE_PROJECTS");
  const [projects, setProjects] = useState<Project[]>([]);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const openCreateModal = () => {
    setEditTarget(null);
    setName("");
    setDescription("");
    setShowModal(true);
  };

  const openEditModal = (item: Project) => {
    setEditTarget(item);
    setName(item.name || "");
    setDescription(item.description || "");
    setShowModal(true);
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await projectService.getAll();
      setProjects(data);
    } catch {
      setError("Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      setError("");
      await projectService.create(name, description);
      setName("");
      setDescription("");
      setShowModal(false);
      await fetchProjects();
    } catch {
      setError("Failed to create project");
    }
  };

  const handleUpdate = async () => {
    if (!editTarget || !name.trim()) return;
    try {
      setError("");
      await projectService.update(editTarget.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setShowModal(false);
      setEditTarget(null);
      setName("");
      setDescription("");
      await fetchProjects();
    } catch {
      setError("Failed to update project");
    }
  };

  const handleDelete = async (project: Project) => {
    if (!canManageProjects) return;

    const moduleCount = project.moduleCount || 0;
    const testCaseCount = project.testCaseCount || 0;

    const message =
      moduleCount > 0 || testCaseCount > 0
        ? `This project contains ${moduleCount} module(s) and ${testCaseCount} test case(s). Delete anyway?`
        : "Delete this project?";

    if (!window.confirm(message)) return;

    try {
      setError("");
      await projectService.delete(project.id);
      await fetchProjects();
    } catch {
      setError("Failed to delete project");
    }
  };

  const emptyMessage = canManageProjects
    ? "No projects yet. Create one to get started."
    : "You don't have any Projects. Ask the Admin to assign projects.";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>📁 Projects</h2>
        {canManageProjects && (
          <button style={styles.addBtn} onClick={openCreateModal}>
            + New Project
          </button>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : projects.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.empty}>{emptyMessage}</p>
        </div>
      ) : (
        projects.map((project) => (
          <Card
            key={project.id}
            title={project.name}
            subtitle={
              project.description ||
              new Date(project.createdAt).toLocaleDateString()
            }
            onEdit={
              canManageProjects ? () => openEditModal(project) : undefined
            }
            onDelete={
              canManageProjects ? () => handleDelete(project) : undefined
            }
            onClick={() => navigate(`/projects/${project.id}`)}
          />
        ))
      )}

      {showModal && canManageProjects && (
        <Modal
          title={editTarget ? "Edit Project" : "New Project"}
          onClose={() => {
            setShowModal(false);
            setEditTarget(null);
          }}
        >
          <FormInput
            label="Project Name"
            value={name}
            onChange={setName}
            placeholder="My Automation Project"
          />
          <FormInput
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="What does this project do?"
          />
          <button
            style={styles.addBtn}
            onClick={editTarget ? handleUpdate : handleCreate}
          >
            {editTarget ? "Update Project" : "Create Project"}
          </button>
        </Modal>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "28px",
    backgroundColor: "#181825",
    minHeight: "calc(100vh - 52px)",
    color: "#cdd6f4",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    margin: 0,
    fontSize: "20px",
    color: "#cba6f7",
  },
  addBtn: {
    padding: "9px 18px",
    backgroundColor: "#a6e3a1",
    color: "#1e1e2e",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
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
  emptyState: {
    padding: "32px 20px",
    border: "1px dashed #45475a",
    borderRadius: "12px",
    backgroundColor: "#1e1e2e",
  },
  empty: {
    color: "#6c7086",
    fontSize: "14px",
    margin: 0,
  },
};

export default ProjectsPage;
