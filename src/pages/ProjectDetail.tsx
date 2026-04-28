import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { moduleService, projectService } from "../api/services";
import Card from "../components/Card";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";

interface Module {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [projectName, setProjectName] = useState("");
  const [editTarget, setEditTarget] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const openCreateModal = () => {
    setEditTarget(null);
    setName("");
    setDescription("");
    setShowModal(true);
  };

  const openEditModal = (moduleItem: Module) => {
    setEditTarget(moduleItem);
    setName(moduleItem.name || "");
    setDescription(moduleItem.description || "");
    setShowModal(true);
  };

  const fetchProjectMeta = async () => {
    if (!projectId) return;
    try {
      const data = await projectService.getById(projectId);
      setProjectName(data?.name || "");
    } catch {
      setProjectName("");
    }
  };

  const fetchModules = async () => {
    if (!projectId) return;
    try {
      const data = await moduleService.getByProject(projectId);
      setModules(data);
    } catch {
      setError("Failed to fetch modules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectMeta();
    fetchModules();
  }, [projectId]);

  const handleCreate = async () => {
    if (!name.trim() || !projectId) return;
    try {
      await moduleService.create(name, projectId, description);
      setName("");
      setDescription("");
      setShowModal(false);
      fetchModules();
    } catch {
      setError("Failed to create module");
    }
  };

  const handleUpdate = async () => {
    if (!editTarget || !name.trim()) return;
    try {
      setError("");
      await moduleService.update(editTarget.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setShowModal(false);
      setEditTarget(null);
      setName("");
      setDescription("");
      await fetchModules();
    } catch {
      setError("Failed to update module");
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!window.confirm("Delete this module and all its test cases?")) return;

    try {
      setError("");
      await moduleService.delete(moduleId);
      await fetchModules();
    } catch {
      setError("Failed to delete module");
    }
  };

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate("/")}>
        ← Back to Projects
      </button>
      <div style={styles.header}>
        <h2 style={styles.title}>
          {(projectName || "Project") + " > Modules"}
        </h2>
        <button style={styles.addBtn} onClick={openCreateModal}>
          + New Module
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : modules.length === 0 ? (
        <p style={styles.empty}>No modules yet.</p>
      ) : (
        modules.map((m) => (
          <Card
            key={m.id}
            title={m.name}
            subtitle={
              m.description || new Date(m.createdAt).toLocaleDateString()
            }
            onEdit={() => openEditModal(m)}
            onDelete={() => handleDeleteModule(m.id)}
            onClick={() => navigate(`/modules/${m.id}`)}
          />
        ))
      )}

      {showModal && (
        <Modal
          title={editTarget ? "Edit Module" : "New Module"}
          onClose={() => {
            setShowModal(false);
            setEditTarget(null);
          }}
        >
          <FormInput
            label="Module Name"
            value={name}
            onChange={setName}
            placeholder="Login Flow"
          />
          <FormInput
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="What does this module test?"
          />
          <button
            style={styles.addBtn}
            onClick={editTarget ? handleUpdate : handleCreate}
          >
            {editTarget ? "Update Module" : "Create Module"}
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
  back: {
    background: "transparent",
    border: "none",
    color: "#89b4fa",
    cursor: "pointer",
    fontSize: "13px",
    marginBottom: "16px",
    padding: 0,
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
  empty: { color: "#6c7086", fontSize: "14px" },
};

export default ProjectDetailPage;
