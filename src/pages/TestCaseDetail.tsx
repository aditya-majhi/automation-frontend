import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { recordingService } from "../api/services";
import { useExtension } from "../hooks/useExtension";
import ExtensionBanner from "../components/ExtensionBanner";
import RecordingControls from "../components/RecordingControl";
import RecordingDetailsTabs from "../components/RecordingDetailsTabs";

interface Recording {
  id: string;
  steps: any[];
  variables?: any[];
  structuredSteps?: any[];
  structuredVars?: any[];
  videoUrl?: string;
  createdAt: string;
}

const TestCaseDetailPage = () => {
  const { testCaseId } = useParams<{ testCaseId: string }>();
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordingSuccess, setRecordingSuccess] = useState("");

  const {
    status: extensionStatus,
    recordingState,
    startRecording,
    stopRecording,
    checkExtension,
  } = useExtension();

  const fetchRecordings = async () => {
    if (!testCaseId) return;
    try {
      const data = await recordingService.getByTestCase(testCaseId);
      setRecordings(data);
    } catch {
      setError("Failed to fetch recordings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [testCaseId]);

  const handleStart = async (url: string) => {
    if (!testCaseId) return;
    const result = await startRecording(url, testCaseId);
    if (!result.success) {
      throw new Error(result.error || "Failed to start recording");
    }
  };

  const handleStop = async () => {
    if (!testCaseId) return;
    const result = await stopRecording(testCaseId);
    if (!result.success) {
      throw new Error(result.error || "Failed to stop recording");
    }
    setRecordingSuccess("Recording saved successfully!");
    setTimeout(() => setRecordingSuccess(""), 4000);
    fetchRecordings();
  };

  // Merge structured data from backend with raw JSON data
  // Prefer structuredSteps/structuredVars if available
  const getRecordingForDisplay = (r: Recording) => {
    const steps = r.structuredSteps?.length ? r.structuredSteps : r.steps || [];
    const variables = r.structuredVars?.length
      ? r.structuredVars
      : r.variables || [];

    return {
      steps,
      variables,
      videoUrl: r.videoUrl,
    };
  };

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate(-1)}>
        ← Back to Test Cases
      </button>

      <div style={styles.header}>
        <h2 style={styles.title}>🎥 Recordings</h2>
      </div>

      {extensionStatus === "checking" && (
        <div style={styles.checking}>🔍 Checking for extension...</div>
      )}
      {extensionStatus === "not_installed" && (
        <ExtensionBanner onRetry={checkExtension} />
      )}

      {testCaseId && (
        <RecordingControls
          testCaseId={testCaseId}
          isRecording={recordingState.isRecording}
          stepCount={recordingState.stepCount}
          isExtensionInstalled={extensionStatus === "installed"}
          onStart={handleStart}
          onStop={handleStop}
        />
      )}

      {recordingSuccess && <div style={styles.success}>{recordingSuccess}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <h3 style={styles.sectionTitle}>Past Recordings</h3>

      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : recordings.length === 0 ? (
        <div style={styles.emptyBox}>
          <p style={styles.emptyTitle}>No recordings yet</p>
          <p style={styles.emptySub}>
            Enter a URL above and click Start Recording.
          </p>
        </div>
      ) : (
        recordings.map((r) => (
          <div key={r.id} style={styles.card}>
            <div
              style={styles.cardHeader}
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <div>
                <div style={styles.cardTitle}>
                  🎬 {new Date(r.createdAt).toLocaleString()}
                </div>
                <div style={styles.cardSub}>
                  {(r.structuredSteps || r.steps || []).length} steps
                  {(r.structuredVars || r.variables || []).length > 0
                    ? ` · ${(r.structuredVars || r.variables || []).length} variables`
                    : ""}
                  {r.videoUrl ? " · 📹 Video" : ""}
                </div>
              </div>
              <span style={styles.toggle}>
                {expandedId === r.id ? "▲" : "▼"}
              </span>
            </div>

            {expandedId === r.id && (
              <div style={styles.cardBody}>
                <RecordingDetailsTabs recording={getRecordingForDisplay(r)} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// ...existing code...
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
  sectionTitle: {
    fontSize: "15px",
    color: "#a6adc8",
    marginBottom: "14px",
    fontWeight: "600",
  },
  checking: {
    fontSize: "13px",
    color: "#89dceb",
    marginBottom: "16px",
  },
  success: {
    backgroundColor: "#a6e3a120",
    border: "1px solid #a6e3a1",
    color: "#a6e3a1",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
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
  emptyBox: {
    backgroundColor: "#313244",
    borderRadius: "10px",
    padding: "28px",
    textAlign: "center",
    border: "1px solid #45475a",
  },
  emptyTitle: {
    fontSize: "16px",
    color: "#cdd6f4",
    margin: "0 0 8px",
  },
  emptySub: {
    fontSize: "13px",
    color: "#6c7086",
    margin: 0,
  },
  card: {
    backgroundColor: "#313244",
    borderRadius: "10px",
    marginBottom: "12px",
    border: "1px solid #45475a",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#cdd6f4",
  },
  cardSub: {
    fontSize: "12px",
    color: "#6c7086",
    marginTop: "4px",
  },
  toggle: { color: "#6c7086", fontSize: "12px" },
  cardBody: {
    padding: "0 16px 16px",
    borderTop: "1px solid #45475a",
  },
};

export default TestCaseDetailPage;
