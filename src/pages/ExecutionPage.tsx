import { useEffect, useMemo, useState } from "react";
import {
  executionService,
  moduleService,
  projectService,
  testCaseService,
} from "../api/services";

type Project = { id: string; name: string };
type Module = { id: string; name: string };
type TestCase = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  completed: "#a6e3a1",
  failed: "#f38ba8",
  error: "#f38ba8",
  running: "#fab387",
  queued: "#89dceb",
  pending: "#89dceb",
};

export default function ExecutionPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filesByTc, setFilesByTc] = useState<Record<string, File | null>>({});
  const [templatesGenerated, setTemplatesGenerated] = useState(false);
  const [executionId, setExecutionId] = useState("");
  const [statusData, setStatusData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRawJson, setShowRawJson] = useState(false);

  // Polling state
  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState<string>("");

  useEffect(() => {
    projectService
      .getAll()
      .then(setProjects)
      .catch(() => setError("Failed to load projects"));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setModules([]);
      setTestCases([]);
      setSelectedModuleId("");
      setSelectedIds([]);
      setFilesByTc({});
      return;
    }
    moduleService
      .getByProject(selectedProjectId)
      .then(setModules)
      .catch(() => setError("Failed to load modules"));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setTestCases([]);
      setSelectedIds([]);
      setFilesByTc({});
      return;
    }
    testCaseService
      .getByModule(selectedModuleId)
      .then(setTestCases)
      .catch(() => setError("Failed to load test cases"));
  }, [selectedModuleId]);

  const getNormalizedStatus = (raw: any): string => {
    const value =
      raw?.status || raw?.data?.status || raw?.data?.data?.status || "";
    return String(value).toLowerCase();
  };

  useEffect(() => {
    if (!executionId) return;

    let attempts = 0;
    const maxAttempts = 120;
    setIsPolling(true);
    setPollCount(0);

    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const raw = await executionService.getExecutionStatus(executionId);
        setStatusData(raw);
        setPollCount(attempts);
        setLastPolledAt(new Date().toLocaleTimeString());

        const currentStatus = String(
          raw?.status || raw?.data?.status || "",
        ).toLowerCase();

        const isTerminal =
          currentStatus === "completed" ||
          currentStatus === "failed" ||
          currentStatus === "error";

        if (isTerminal || attempts >= maxAttempts) {
          clearInterval(timer);
          setIsPolling(false);
        }
      } catch {
        clearInterval(timer);
        setIsPolling(false);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [executionId]);

  const currentExecutionStatus = getNormalizedStatus(statusData) || "queued";

  const selectedCases = useMemo(
    () => testCases.filter((tc) => selectedIds.includes(tc.id)),
    [testCases, selectedIds],
  );

  const uploadedCount = selectedCases.filter((tc) =>
    Boolean(filesByTc[tc.id]),
  ).length;

  const allSelectedFilesReady =
    selectedCases.length > 0 &&
    selectedCases.every((tc) => Boolean(filesByTc[tc.id]));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((v) => v !== id) : [...prev, id];
      if (exists) {
        setFilesByTc((cur) => {
          const updated = { ...cur };
          delete updated[id];
          return updated;
        });
      }
      return next;
    });
    setTemplatesGenerated(false);
  };

  const downloadTemplate = async (testCaseId: string, testCaseName: string) => {
    try {
      setError("");
      const blob = await executionService.downloadTemplate(testCaseId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = testCaseName.replace(/[^a-z0-9\-_]/gi, "_");
      link.href = url;
      link.download = `${safeName || testCaseId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to download template for ${testCaseName}`);
    }
  };

  const onUpload = (testCaseId: string, file?: File) => {
    if (!file) return;
    setFilesByTc((prev) => ({ ...prev, [testCaseId]: file }));
  };

  const filesByTestCaseId = selectedCases.reduce<Record<string, File>>(
    (acc, tc) => {
      const file = filesByTc[tc.id];
      if (file) acc[tc.id] = file;
      return acc;
    },
    {},
  );

  const startRun = async () => {
    if (!selectedCases.length) {
      setError("Select at least one test case");
      return;
    }
    if (!allSelectedFilesReady) {
      setError("Upload one Excel file for each selected test case");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const started = await executionService.startExecution({
        testCaseIds: selectedCases.map((tc) => tc.id),
        filesByTestCaseId,
        runConfig: { timeoutSec: 300 },
      });
      setExecutionId(started.executionId);
      setStatusData(started);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to start execution");
    } finally {
      setBusy(false);
    }
  };

  const statusColor = STATUS_COLORS[currentExecutionStatus] || "#89dceb";
  const isTerminalStatus = ["completed", "failed", "error"].includes(
    currentExecutionStatus,
  );
  const summary = statusData?.summary || statusData?.result?.summary;
  const results: any[] =
    statusData?.results || statusData?.result?.results || [];

  return (
    <div style={styles.page}>
      {/* Hero */}
      <div style={styles.hero}>
        <div>
          <h1 style={styles.heroTitle}>Execution Center</h1>
          <p style={styles.heroSubtitle}>
            Select test cases, download data templates, upload filled sheets,
            then run batch execution.
          </p>
        </div>
        {executionId && (
          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: statusColor + "20",
              color: statusColor,
              borderColor: statusColor + "50",
            }}
          >
            {isPolling && <span style={styles.pulseDot} />}
            {currentExecutionStatus.toUpperCase()}
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Section 1 — Scope */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.stepBadge}>1</span>
          <h2 style={styles.sectionTitle}>Choose Scope</h2>
        </div>
        <div style={styles.filterGrid}>
          <div>
            <label style={styles.label}>Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={styles.select}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Module</label>
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              style={styles.select}
              disabled={!selectedProjectId}
            >
              <option value="">Select Module</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2 — Test Cases */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.stepBadge}>2</span>
          <h2 style={styles.sectionTitle}>Select Test Cases</h2>
          {testCases.length > 0 && (
            <span style={styles.countChip}>{testCases.length} available</span>
          )}
        </div>

        {testCases.length === 0 ? (
          <div style={styles.emptyState}>
            Select a project and module to load test cases.
          </div>
        ) : (
          <>
            <div style={styles.caseGrid}>
              {testCases.map((tc) => {
                const selected = selectedIds.includes(tc.id);
                return (
                  <label
                    key={tc.id}
                    style={{
                      ...styles.caseCard,
                      ...(selected ? styles.caseCardSelected : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(tc.id)}
                      style={styles.checkbox}
                    />
                    <span style={styles.caseName}>{tc.name}</span>
                    {selected && <span style={styles.selectedPip} />}
                  </label>
                );
              })}
            </div>

            {selectedCases.length > 0 && (
              <div style={styles.statsRow}>
                <div style={styles.statChip}>
                  <span style={styles.statVal}>{selectedCases.length}</span>
                  <span style={styles.statLabel}>Selected</span>
                </div>
                <div style={styles.statChip}>
                  <span
                    style={{
                      ...styles.statVal,
                      color:
                        uploadedCount === selectedCases.length
                          ? "#a6e3a1"
                          : "#fab387",
                    }}
                  >
                    {uploadedCount}/{selectedCases.length}
                  </span>
                  <span style={styles.statLabel}>Uploaded</span>
                </div>
                {!templatesGenerated && (
                  <button
                    type="button"
                    onClick={() => setTemplatesGenerated(true)}
                    disabled={busy}
                    style={styles.genButton}
                  >
                    Generate Templates
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 3 — Templates & Upload */}
      {templatesGenerated && selectedCases.length > 0 && (
        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <span style={styles.stepBadge}>3</span>
            <h2 style={styles.sectionTitle}>
              Download Templates & Upload Data
            </h2>
          </div>
          <div style={styles.uploadGrid}>
            {selectedCases.map((tc) => {
              const uploaded = filesByTc[tc.id];
              return (
                <div
                  key={tc.id}
                  style={{
                    ...styles.uploadCard,
                    ...(uploaded ? styles.uploadCardDone : {}),
                  }}
                >
                  <div style={styles.uploadCardName}>{tc.name}</div>
                  <div style={styles.uploadActions}>
                    <button
                      type="button"
                      onClick={() => downloadTemplate(tc.id, tc.name)}
                      style={styles.downloadBtn}
                    >
                      Download .xlsx
                    </button>
                    <label style={styles.uploadLabel}>
                      {uploaded ? "Re-upload" : "Upload filled sheet"}
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={(e) => onUpload(tc.id, e.target.files?.[0])}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                  {uploaded && (
                    <div style={styles.uploadedName}>✓ {uploaded.name}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Poll banner */}
      {executionId && isPolling && (
        <div style={styles.pollBanner}>
          <span style={styles.pulseDot} />
          Polling for results &nbsp;·&nbsp; {pollCount} checks
          {lastPolledAt && <span> · Last: {lastPolledAt}</span>}
        </div>
      )}

      {/* Done banner */}
      {isTerminalStatus && !isPolling && executionId && (
        <div
          style={{
            ...styles.pollBanner,
            backgroundColor:
              currentExecutionStatus === "completed"
                ? "#a6e3a120"
                : "#f38ba820",
            borderColor:
              currentExecutionStatus === "completed"
                ? "#a6e3a150"
                : "#f38ba850",
            color:
              currentExecutionStatus === "completed" ? "#a6e3a1" : "#f38ba8",
          }}
        >
          Execution {currentExecutionStatus} · {pollCount} checks
          {lastPolledAt && ` · Last: ${lastPolledAt}`}
        </div>
      )}

      {/* Results */}
      {executionId && statusData && (
        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Execution Results</h2>
            <span style={styles.idChip}>{executionId}</span>
          </div>

          {summary && (
            <div style={styles.summaryCard}>
              <div style={styles.summaryTitle}>AI Summary</div>
              <p style={styles.summaryText}>{summary}</p>
            </div>
          )}

          {results.length > 0 && (
            <div style={styles.resultsTable}>
              {results.map((r: any, i: number) => {
                const passed = r.status === "passed";
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.resultRow,
                      borderLeftColor: passed ? "#a6e3a1" : "#f38ba8",
                    }}
                  >
                    <span
                      style={{
                        color: passed ? "#a6e3a1" : "#f38ba8",
                        fontWeight: 700,
                        minWidth: "40px",
                      }}
                    >
                      {passed ? "PASS" : "FAIL"}
                    </span>
                    <span style={styles.resultName}>
                      {r.testCaseName || r.testCaseId}
                    </span>
                    {r.error && (
                      <span style={styles.resultError}>{r.error}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowRawJson((v) => !v)}
            style={styles.toggleRaw}
          >
            {showRawJson ? "Hide" : "Show"} raw JSON
          </button>
          {showRawJson && (
            <pre style={styles.pre}>{JSON.stringify(statusData, null, 2)}</pre>
          )}
        </div>
      )}

      {/* Sticky action bar */}
      <div style={styles.actionBar}>
        <div style={styles.actionBarInner}>
          {selectedCases.length > 0 && !allSelectedFilesReady && (
            <span style={styles.actionHint}>
              {!templatesGenerated
                ? "Generate templates first"
                : `${selectedCases.length - uploadedCount} file(s) still needed`}
            </span>
          )}
          <button
            type="button"
            onClick={startRun}
            disabled={busy || isPolling || !allSelectedFilesReady}
            style={{
              ...styles.primaryButton,
              opacity: busy || isPolling || !allSelectedFilesReady ? 0.45 : 1,
              cursor:
                busy || isPolling || !allSelectedFilesReady
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {busy
              ? "Starting..."
              : isPolling
                ? "Running..."
                : "Start Batch Execution"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#181825",
    color: "#cdd6f4",
    padding: "24px 28px 100px",
    fontFamily: "inherit",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
    padding: "24px",
    background: "linear-gradient(135deg, #1e1e2e 60%, #2a1a3e)",
    borderRadius: "16px",
    border: "1px solid #313244",
  },
  heroTitle: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 700,
    color: "#cba6f7",
    letterSpacing: "-0.4px",
  },
  heroSubtitle: {
    marginTop: "6px",
    marginBottom: 0,
    color: "#a6adc8",
    fontSize: "14px",
    maxWidth: "500px",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderRadius: "24px",
    border: "1px solid",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.6px",
  },
  pulseDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "currentColor",
  },
  errorBanner: {
    marginBottom: "16px",
    padding: "12px 16px",
    backgroundColor: "#f38ba820",
    color: "#f38ba8",
    border: "1px solid #f38ba840",
    borderRadius: "10px",
    fontSize: "14px",
  },
  sectionCard: {
    backgroundColor: "#1e1e2e",
    border: "1px solid #313244",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "14px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  stepBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "#cba6f720",
    color: "#cba6f7",
    fontSize: "12px",
    fontWeight: 700,
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#f5c2e7",
    flex: 1,
  },
  countChip: {
    fontSize: "12px",
    color: "#a6adc8",
    backgroundColor: "#31324450",
    padding: "2px 10px",
    borderRadius: "12px",
  },
  idChip: {
    fontSize: "11px",
    color: "#a6adc8",
    backgroundColor: "#31324460",
    padding: "3px 10px",
    borderRadius: "8px",
    fontFamily: "monospace",
    maxWidth: "260px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#6c7086",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #45475a",
    backgroundColor: "#11111b",
    color: "#cdd6f4",
    outline: "none",
    fontSize: "14px",
  },
  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#585b70",
    fontSize: "14px",
    border: "1px dashed #313244",
    borderRadius: "10px",
  },
  caseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "8px",
  },
  caseCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 14px",
    borderRadius: "10px",
    border: "1px solid #313244",
    backgroundColor: "#11111b",
    cursor: "pointer",
    position: "relative",
  },
  caseCardSelected: {
    borderColor: "#cba6f750",
    backgroundColor: "#cba6f710",
  },
  checkbox: {
    accentColor: "#cba6f7",
    width: "15px",
    height: "15px",
    flexShrink: 0,
  },
  caseName: {
    fontSize: "14px",
    color: "#cdd6f4",
    flex: 1,
    lineHeight: 1.4,
  },
  selectedPip: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#cba6f7",
    flexShrink: 0,
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid #313244",
    flexWrap: "wrap",
  },
  statChip: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    padding: "6px 14px",
    borderRadius: "20px",
    backgroundColor: "#11111b",
    border: "1px solid #313244",
  },
  statVal: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#cba6f7",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "12px",
    color: "#6c7086",
  },
  genButton: {
    marginLeft: "auto",
    padding: "8px 18px",
    backgroundColor: "#cba6f720",
    color: "#cba6f7",
    border: "1px solid #cba6f740",
    borderRadius: "8px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
  },
  uploadGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
  },
  uploadCard: {
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid #313244",
    backgroundColor: "#11111b",
  },
  uploadCardDone: {
    borderColor: "#a6e3a140",
    backgroundColor: "#a6e3a108",
  },
  uploadCardName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#cdd6f4",
    marginBottom: "10px",
  },
  uploadActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  downloadBtn: {
    padding: "6px 12px",
    backgroundColor: "transparent",
    color: "#89dceb",
    border: "1px solid #89dceb50",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
  },
  uploadLabel: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    backgroundColor: "transparent",
    color: "#a6e3a1",
    border: "1px solid #a6e3a150",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
  },
  uploadedName: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#a6e3a1",
  },
  pollBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #89b4fa50",
    backgroundColor: "#89b4fa15",
    color: "#89b4fa",
    fontSize: "13px",
  },
  summaryCard: {
    padding: "16px",
    borderRadius: "10px",
    backgroundColor: "#cba6f710",
    border: "1px solid #cba6f730",
    marginBottom: "14px",
  },
  summaryTitle: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#cba6f7",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "8px",
  },
  summaryText: {
    margin: 0,
    fontSize: "14px",
    color: "#cdd6f4",
    lineHeight: 1.7,
  },
  resultsTable: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "14px",
  },
  resultRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "#11111b",
    borderLeft: "3px solid",
    fontSize: "14px",
    flexWrap: "wrap",
  },
  resultName: {
    flex: 1,
    color: "#cdd6f4",
  },
  resultError: {
    fontSize: "12px",
    color: "#f38ba8",
    fontFamily: "monospace",
  },
  toggleRaw: {
    padding: "5px 12px",
    backgroundColor: "transparent",
    color: "#585b70",
    border: "1px solid #313244",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    marginBottom: "10px",
  },
  pre: {
    margin: 0,
    padding: "14px",
    backgroundColor: "#11111b",
    color: "#cdd6f4",
    borderRadius: "8px",
    overflow: "auto",
    fontSize: "11px",
    lineHeight: 1.6,
  },
  actionBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "14px 28px",
    backgroundColor: "#181825ee",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid #313244",
    zIndex: 100,
  },
  actionBarInner: {
    maxWidth: "1200px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "14px",
  },
  actionHint: {
    fontSize: "13px",
    color: "#6c7086",
  },
  primaryButton: {
    padding: "10px 28px",
    backgroundColor: "#89b4fa",
    color: "#11111b",
    border: "none",
    borderRadius: "8px",
    fontWeight: 700,
    fontSize: "14px",
  },
};
