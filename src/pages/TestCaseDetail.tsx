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

interface TestCaseMeta {
  id: string;
  name: string;
  module?: {
    id: string;
    name: string;
    project?: {
      id: string;
      name: string;
    };
  };
}

const CollapsibleSection = ({
  title,
  subtitle,
  defaultOpen = false,
  titleColor = "#cdd6f4",
  children,
  rightAction,
}: {
  title: React.ReactNode;
  subtitle?: string;
  defaultOpen?: boolean;
  titleColor?: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={styles.collapseCard}>
      <button
        type="button"
        style={styles.collapseHeader}
        onClick={() => setIsOpen((v) => !v)}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ ...styles.collapseTitle, color: titleColor }}>
            {isOpen ? "▼" : "▶"} {title}
          </div>
          {subtitle ? (
            <div style={styles.collapseSubtitle}>{subtitle}</div>
          ) : null}
        </div>
        {rightAction ? (
          <div onClick={(e) => e.stopPropagation()}>{rightAction}</div>
        ) : null}
      </button>

      {isOpen ? <div style={styles.collapseBody}>{children}</div> : null}
    </div>
  );
};

const TestCaseDetailPage = () => {
  const { testCaseId } = useParams<{ testCaseId: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [testCaseMeta, setTestCaseMeta] = useState<TestCaseMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordingSuccess, setRecordingSuccess] = useState("");
  const [baseScript, setBaseScript] = useState("");
  const [finalScript, setFinalScript] = useState("");
  const baseScriptRef = useRef("");
  const lastSavedScriptRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const [activeRecordingTab, setActiveRecordingTab] = useState<
    "steps" | "variables" | "selenium" | "video"
  >("steps");
  const [runtimePathRequired, setRuntimePathRequired] = useState(false);

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

  const hasInitialPendingRuntimePath = useMemo(() => {
    if (!recording) return false;

    const steps = recording.structuredSteps?.length
      ? recording.structuredSteps
      : recording.steps || [];

    return steps.some((step: any, index: number) => {
      const stepKey = step.stepId || String(index);
      const targetTag = (step.targetTag || "").toLowerCase();
      const inputType = (
        step.inputType ||
        step.contextMeta?.inputType ||
        step.context?.inputType ||
        ""
      ).toLowerCase();

      const isFileStep =
        step.contextMeta?.requiresRuntimePath === true ||
        step.context?.requiresRuntimePath === true ||
        inputType === "file" ||
        (targetTag === "input" && inputType === "file");

      if (!isFileStep) return false;

      const runtimePath =
        step.contextMeta?.runtimePath ?? step.context?.runtimePath ?? "";

      return !String(runtimePath).trim();
    });
  }, [recording]);

  const {
    status: extensionStatus,
    recordingState,
    startRecording,
    stopRecording,
    checkExtension,
  } = useExtension();

  const fetchTestCaseMeta = async () => {
    if (!testCaseId) return;
    try {
      const data = await testCaseService.getMeta(testCaseId);
      setTestCaseMeta(data || null);
    } catch {
      setTestCaseMeta(null);
    }
  };

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
    setRuntimePathRequired(hasInitialPendingRuntimePath);
  }, [hasInitialPendingRuntimePath]);

  useEffect(() => {
    fetchTestCaseMeta();
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
        <h2 style={styles.title}>
          {(testCaseMeta?.module?.project?.name || "Project") +
            " > " +
            (testCaseMeta?.module?.name || "Module") +
            " > " +
            (testCaseMeta?.name || "Testcase")}
        </h2>
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
        <CollapsibleSection
          title={
            <span style={styles.recordingTitleRow}>
              <span>{new Date(recording.createdAt).toLocaleString()}</span>
              {runtimePathRequired ? (
                <span style={styles.pathRequiredBadge}>
                  Original file path required
                </span>
              ) : null}
            </span>
          }
          subtitle={
            (recording.structuredSteps || recording.steps || []).length +
            " steps" +
            ((recording.structuredVars || recording.variables || []).length > 0
              ? " · " +
                (recording.structuredVars || recording.variables || []).length +
                " variables"
              : "") +
            (recording.videoUrl ? " · Video" : "")
          }
          defaultOpen={false}
        >
          <RecordingDetailsTabs
            recording={recordingDisplay}
            onPythonScriptGenerated={handlePythonScriptGenerated}
            onTabChange={setActiveRecordingTab}
            onRuntimePathRequiredChange={setRuntimePathRequired}
          />
        </CollapsibleSection>
      )}

      {finalScript ? (
        <CollapsibleSection
          title="Final Script With Assertions"
          subtitle="Generated script ready for execution"
          defaultOpen={false}
          titleColor="#a6e3a1"
          rightAction={
            <button
              type="button"
              style={styles.copyBtn}
              onClick={() => navigator.clipboard.writeText(finalScript)}
            >
              Copy
            </button>
          }
        >
          <pre style={styles.finalScriptCode}>{finalScript}</pre>
        </CollapsibleSection>
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
  collapseCard: {
    backgroundColor: "#313244",
    borderRadius: "10px",
    border: "1px solid #45475a",
    overflow: "hidden",
    marginBottom: 12,
  },
  collapseHeader: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#cdd6f4",
    cursor: "pointer",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #45475a",
  },
  collapseTitle: {
    fontSize: 14,
    fontWeight: 700,
  },
  collapseSubtitle: {
    fontSize: 12,
    color: "#6c7086",
    marginTop: 4,
  },
  collapseBody: {
    padding: "0 16px 16px",
  },
  recordingTitleRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pathRequiredBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#f9e2af",
    border: "1px solid #f9e2af55",
    backgroundColor: "#f9e2af1a",
    borderRadius: 999,
    padding: "2px 8px",
    lineHeight: 1.4,
  },
};

export default TestCaseDetailPage;
