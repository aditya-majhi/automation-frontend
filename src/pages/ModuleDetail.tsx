import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { testCaseService, moduleService } from "../api/services";
import Card from "../components/Card";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";

interface TestCase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

interface ModuleMeta {
  id: string;
  name: string;
  project?: {
    id: string;
    name: string;
  };
}

const ModuleDetailPage = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [moduleMeta, setModuleMeta] = useState<ModuleMeta | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [editTarget, setEditTarget] = useState<TestCase | null>(null);
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

  const openEditModal = (testCase: TestCase) => {
    setEditTarget(testCase);
    setName(testCase.name || "");
    setDescription(testCase.description || "");
    setShowModal(true);
  };

  const fetchModuleMeta = async () => {
    if (!moduleId) return;
    try {
      const data = await moduleService.getById(moduleId);
      setModuleMeta(data || null);
    } catch {
      setModuleMeta(null);
    }
  };

  const fetchTestCases = async () => {
    if (!moduleId) return;
    try {
      const data = await testCaseService.getByModule(moduleId);
      setTestCases(data);
    } catch {
      setError("Failed to fetch test cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModuleMeta();
    fetchTestCases();
  }, [moduleId]);

  const handleCreate = async () => {
    if (!name.trim() || !moduleId) return;
    try {
      await testCaseService.create(name, moduleId, description);
      setName("");
      setDescription("");
      setShowModal(false);
      fetchTestCases();
    } catch {
      setError("Failed to create test case");
    }
  };

  const handleUpdate = async () => {
    if (!editTarget || !name.trim()) return;
    try {
      setError("");
      await testCaseService.updateMeta(editTarget.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setShowModal(false);
      setEditTarget(null);
      setName("");
      setDescription("");
      await fetchTestCases();
    } catch {
      setError("Failed to update test case");
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    if (!window.confirm("Delete this test case?")) return;

    try {
      setError("");
      await testCaseService.delete(id);
      await fetchTestCases();
    } catch {
      setError("Failed to delete test case");
    }
  };

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate(-1)}>
        ← Back to Modules
      </button>
      <div style={styles.header}>
        <h2 style={styles.title}>
          {(moduleMeta?.project?.name || "Project") +
            " > " +
            (moduleMeta?.name || "Module") +
            " > Testcases"}
        </h2>
        <button style={styles.addBtn} onClick={openCreateModal}>
          + New Test Case
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : testCases.length === 0 ? (
        <p style={styles.empty}>No test cases yet.</p>
      ) : (
        testCases.map((tc) => (
          <Card
            key={tc.id}
            title={tc.name}
            subtitle={
              tc.description || new Date(tc.createdAt).toLocaleDateString()
            }
            onEdit={() => openEditModal(tc)}
            onDelete={() => handleDeleteTestCase(tc.id)}
            onClick={() => navigate(`/testcases/${tc.id}`)}
          />
        ))
      )}

      {showModal && (
        <Modal
          title={editTarget ? "Edit Test Case" : "New Test Case"}
          onClose={() => {
            setShowModal(false);
            setEditTarget(null);
          }}
        >
          <FormInput
            label="Test Case Name"
            value={name}
            onChange={setName}
            placeholder="Login with valid credentials"
          />
          <FormInput
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="What does this test verify?"
          />
          <button
            style={styles.addBtn}
            onClick={editTarget ? handleUpdate : handleCreate}
          >
            {editTarget ? "Update Test Case" : "Create Test Case"}
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

export default ModuleDetailPage;
