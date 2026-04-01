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
}

const ProjectsPage = () => {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

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

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this project?")) return;

    try {
      setError("");
      await projectService.delete(id);
      await fetchProjects();
    } catch {
      setError("Failed to delete project");
    }
  };

  const emptyMessage = isAdmin
    ? "No projects yet. Create one to get started."
    : "You don't have any Projects. Ask the Admin to assign projects.";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>📁 Projects</h2>
        {isAdmin && (
          <button style={styles.addBtn} onClick={() => setShowModal(true)}>
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
            onDelete={isAdmin ? () => handleDelete(project.id) : undefined}
            onClick={() => navigate(`/projects/${project.id}`)}
          />
        ))
      )}

      {showModal && isAdmin && (
        <Modal title="New Project" onClose={() => setShowModal(false)}>
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
          <button style={styles.addBtn} onClick={handleCreate}>
            Create Project
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
