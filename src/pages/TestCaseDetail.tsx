import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { recordingService, testCaseService } from "../api/services";
import { useExtension } from "../hooks/useExtension";
import ExtensionBanner from "../components/ExtensionBanner";
import RecordingControls from "../components/RecordingControl";
import RecordingDetailsTabs from "../components/RecordingDetailsTabs";
import TestCaseAssertionBuilder from "../components/AssertionBuilder";

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
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordingSuccess, setRecordingSuccess] = useState("");
  const [baseScript, setBaseScript] = useState("");
  const [finalScript, setFinalScript] = useState("");
  const baseScriptRef = useRef("");
  const lastSavedScriptRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);

  const {
    status: extensionStatus,
    recordingState,
    startRecording,
    stopRecording,
    checkExtension,
  } = useExtension();

  const fetchRecording = async () => {
    if (!testCaseId) return;
    try {
      setError("");
      const data = await recordingService.getByTestCase(testCaseId);
      setRecording(data || null);
    } catch {
      setError("Failed to fetch recording");
    } finally {
      setLoading(false);
    }
  };

  const fetchScripts = async () => {
    if (!testCaseId) return;
    try {
      const data = await testCaseService.getScripts(testCaseId);
      const fetchedBase = data?.base_script || "";
      setBaseScript(fetchedBase);
      setFinalScript(data?.final_script || "");
      baseScriptRef.current = fetchedBase;
      lastSavedScriptRef.current = fetchedBase.trim();
    } catch {
      // non-blocking
    }
  };

  const handlePythonScriptGenerated = useCallback(
    (script: string) => {
      if (!testCaseId) return;
      const next = (script || "").trim();
      if (!next) return;
      const current = (baseScriptRef.current || "").trim();
      if (next === current || next === lastSavedScriptRef.current) return;

      setBaseScript(script);

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(async () => {
        try {
          await testCaseService.saveBaseScript(testCaseId, script, {
            source: "recording-tabs",
            language: "python",
          });
          lastSavedScriptRef.current = next;
          baseScriptRef.current = script;
        } catch {
          setError("Failed to auto-save base script");
        }
      }, 600);
    },
    [testCaseId],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchRecording();
    fetchScripts();
  }, [testCaseId]);

  useEffect(() => {
    baseScriptRef.current = baseScript;
  }, [baseScript]);

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
    await fetchRecording();
    await fetchScripts();
  };

  const getRecordingForDisplay = (r: Recording) => {
    const steps = r.steps?.length ? r.steps : r.structuredSteps || [];
    const variables = r.variables?.length
      ? r.variables
      : r.structuredVars || [];

    return {
      steps,
      variables,
      videoUrl: r.videoUrl,
    };
  };

  const recordingDisplay = useMemo(
    () =>
      recording
        ? getRecordingForDisplay(recording)
        : { steps: [], variables: [], videoUrl: null },
    [recording],
  );

  const assertionApi = useMemo(
    () => ({
      getAssertionOperators: testCaseService.getAssertionOperators,
      generateFinalScript: testCaseService.generateFinalScript,
    }),
    [],
  );

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate(-1)}>
        ← Back to Test Cases
      </button>

      <div style={styles.header}>
        <h2 style={styles.title}>🎥 Recording</h2>
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

      <div style={styles.sectionTitleRow}>
        <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
          Current Recording
        </h3>
        {testCaseId && (
          <TestCaseAssertionBuilder
            testCaseId={testCaseId}
            baseScript={baseScript}
            variables={recordingDisplay.variables}
            api={assertionApi}
            onFinalScriptGenerated={(script: string) => {
              setFinalScript(script);
            }}
            setActiveTab={() => {}}
          />
        )}
      </div>

      {loading ? (
        <p style={styles.empty}>Loading...</p>
      ) : !recording ? (
        <div style={styles.emptyBox}>
          <p style={styles.emptyTitle}>No recording yet</p>
          <p style={styles.emptySub}>
            Enter a URL above and click Start Recording.
          </p>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>
                🎬 {new Date(recording.createdAt).toLocaleString()}
              </div>
              <div style={styles.cardSub}>
                {(recording.structuredSteps || recording.steps || []).length}{" "}
                steps
                {(recording.structuredVars || recording.variables || [])
                  .length > 0
                  ? ` · ${(recording.structuredVars || recording.variables || []).length} variables`
                  : ""}
                {recording.videoUrl ? " · 📹 Video" : ""}
              </div>
            </div>
          </div>

          <div style={styles.cardBody}>
            <RecordingDetailsTabs
              recording={recordingDisplay}
              onPythonScriptGenerated={handlePythonScriptGenerated}
            />
          </div>
        </div>
      )}

      {finalScript ? (
        <div style={styles.finalScriptBox}>
          <div style={styles.finalScriptHeader}>
            <span style={styles.finalScriptTitle}>
              Final Script with Assertions
            </span>
            <button
              type="button"
              style={styles.copyBtn}
              onClick={() => navigator.clipboard.writeText(finalScript)}
            >
              Copy
            </button>
          </div>
          <pre style={styles.finalScriptCode}>{finalScript}</pre>
        </div>
      ) : null}
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
  sectionTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: "15px",
    color: "#a6adc8",
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
  cardBody: {
    padding: "0 16px 16px",
    borderTop: "1px solid #45475a",
  },
  finalScriptBox: {
    backgroundColor: "#313244",
    borderRadius: "10px",
    marginTop: "12px",
    border: "1px solid #a6e3a1",
    overflow: "hidden",
  },
  finalScriptHeader: {
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #45475a",
  },
  finalScriptTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#a6e3a1",
  },
  copyBtn: {
    background: "#45475a",
    border: "none",
    color: "#cdd6f4",
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  },
  finalScriptCode: {
    padding: 14,
    backgroundColor: "#1e1e2e",
    borderRadius: 0,
    border: "none",
    fontSize: 11,
    color: "#cdd6f4",
    whiteSpace: "pre-wrap",
    margin: 0,
    maxHeight: 420,
    overflowY: "auto",
  },
};

export default TestCaseDetailPage;
