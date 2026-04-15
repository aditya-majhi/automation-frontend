import { useEffect, useMemo, useState } from "react";
import {
  executionService,
  moduleService,
  projectService,
  testCaseService,
} from "../api/services";

type Project = { id: string; name: string };
type Module = { id: string; name: string; projectId?: string };
type TestCase = {
  id: string;
  name: string;
  moduleId?: string;
  assertions?: unknown;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#a6e3a1",
  failed: "#f38ba8",
  error: "#f38ba8",
  running: "#fab387",
  queued: "#89dceb",
  pending: "#89dceb",
};

// helper to render the assertions in the test case cards
function renderAssertions(assertionsJson: unknown) {
  if (!assertionsJson || typeof assertionsJson !== "object") return null;
  const a = assertionsJson as { logic?: string; rules?: any[] };
  const rules = Array.isArray(a.rules) ? a.rules : [];
  if (!rules.length) return null;

  const rightText = (r: any) => {
    if (r.operator === "is_empty" || r.operator === "is_not_empty") return "";
    if (r.right_type === "variable") {
      if (Array.isArray(r.right_value)) return r.right_value.join(", ");
      return String(r.right_value ?? "");
    }
    if (Array.isArray(r.right_value))
      return r.right_value.map(String).join(", ");
    return JSON.stringify(r.right_value ?? "");
  };

  return (
    <div
      style={{ marginTop: 8, marginBottom: 10, fontSize: 12, color: "#a6adc8" }}
    >
      <strong>Assertions:</strong>
      <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
        {rules.map((r: any, idx: number) => {
          const left = String(r.left ?? "");
          const op = String(r.operator ?? "");
          const right = rightText(r);
          return (
            <li key={r.id ?? idx}>
              {right ? `${left} ${op} ${right}` : `${left} ${op}`}
            </li>
          );
        })}
      </ol>
      {a.logic && (
        <div style={{ marginTop: 2 }}>
          <em>Logic: {a.logic}</em>
        </div>
      )}
    </div>
  );
}

const uniqueById = <T extends { id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
};

export default function ExecutionPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [modulesByProject, setModulesByProject] = useState<
    Record<string, Module[]>
  >({});
  const [testCasesByModule, setTestCasesByModule] = useState<
    Record<string, TestCase[]>
  >({});

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [expandedModuleIds, setExpandedModuleIds] = useState<string[]>([]);

  const [filesByTc, setFilesByTc] = useState<Record<string, File | null>>({});
  const [templatesGenerated, setTemplatesGenerated] = useState(false);

  const [executionId, setExecutionId] = useState("");
  const [statusData, setStatusData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRawJson, setShowRawJson] = useState(false);

  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState("");

  useEffect(() => {
    projectService
      .getAll()
      .then(setProjects)
      .catch(() => setError("Failed to load projects"));
  }, []);

  useEffect(() => {
    const missingProjectIds = expandedProjectIds.filter(
      (projectId) => !modulesByProject[projectId],
    );
    if (!missingProjectIds.length) return;

    Promise.all(
      missingProjectIds.map(async (projectId) => {
        const modules = await moduleService.getByProject(projectId);
        return [
          projectId,
          uniqueById(modules).map((m) => ({ ...m, projectId })),
        ] as const;
      }),
    )
      .then((pairs) => {
        setModulesByProject((prev) => {
          const next = { ...prev };
          pairs.forEach(([projectId, modules]) => {
            next[projectId] = modules;
          });
          return next;
        });
      })
      .catch(() => setError("Failed to load modules"));
  }, [expandedProjectIds, modulesByProject]);

  useEffect(() => {
    const missingModuleIds = expandedModuleIds.filter(
      (moduleId) => !testCasesByModule[moduleId],
    );
    if (!missingModuleIds.length) return;

    Promise.all(
      missingModuleIds.map(async (moduleId) => {
        const testCases = await testCaseService.getByModule(moduleId);
        return [
          moduleId,
          uniqueById(testCases).map((tc) => ({ ...tc, moduleId })),
        ] as const;
      }),
    )
      .then((pairs) => {
        setTestCasesByModule((prev) => {
          const next = { ...prev };
          pairs.forEach(([moduleId, testCases]) => {
            next[moduleId] = testCases;
          });
          return next;
        });
      })
      .catch(() => setError("Failed to load test cases"));
  }, [expandedModuleIds, testCasesByModule]);

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

  const allTestCases = useMemo(
    () => Object.values(testCasesByModule).flat(),
    [testCasesByModule],
  );

  const selectedCases = useMemo(
    () => allTestCases.filter((tc) => selectedIds.includes(tc.id)),
    [allTestCases, selectedIds],
  );

  const uploadedCount = selectedCases.filter((tc) =>
    Boolean(filesByTc[tc.id]),
  ).length;

  const allSelectedFilesReady =
    selectedCases.length > 0 &&
    selectedCases.every((tc) => Boolean(filesByTc[tc.id]));

  const removeFilesForTestCases = (testCaseIds: string[]) => {
    if (!testCaseIds.length) return;
    setFilesByTc((cur) => {
      const next = { ...cur };
      testCaseIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  const ensureModulesLoaded = async (projectId: string): Promise<Module[]> => {
    const existing = modulesByProject[projectId];
    if (existing) return existing;

    const fetched = await moduleService.getByProject(projectId);
    const normalized = uniqueById(fetched).map((m) => ({ ...m, projectId }));
    setModulesByProject((prev) => ({ ...prev, [projectId]: normalized }));
    return normalized;
  };

  const ensureTestCasesLoaded = async (
    moduleId: string,
  ): Promise<TestCase[]> => {
    const existing = testCasesByModule[moduleId];
    if (existing) return existing;

    const fetched = await testCaseService.getByModule(moduleId);
    const normalized = uniqueById(fetched).map((tc) => ({ ...tc, moduleId }));
    setTestCasesByModule((prev) => ({ ...prev, [moduleId]: normalized }));
    return normalized;
  };

  const findProjectIdForModule = (moduleId: string): string | undefined => {
    for (const [projectId, modules] of Object.entries(modulesByProject)) {
      if (modules.some((m) => m.id === moduleId)) return projectId;
    }
    return undefined;
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const toggleModuleExpand = (moduleId: string) => {
    setExpandedModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId],
    );
  };

  const toggleProject = async (projectId: string) => {
    const isSelected = selectedProjectIds.includes(projectId);

    if (!isSelected) {
      try {
        setError("");

        const modules = await ensureModulesLoaded(projectId);
        const moduleIds = modules.map((m) => m.id);

        const tcLists = await Promise.all(
          moduleIds.map((moduleId) => ensureTestCasesLoaded(moduleId)),
        );
        const testCaseIds = tcLists.flatMap((list) => list.map((tc) => tc.id));

        setSelectedProjectIds((prev) =>
          Array.from(new Set([...prev, projectId])),
        );
        setSelectedModuleIds((prev) =>
          Array.from(new Set([...prev, ...moduleIds])),
        );
        setSelectedIds((prev) =>
          Array.from(new Set([...prev, ...testCaseIds])),
        );

        setExpandedProjectIds((prev) =>
          prev.includes(projectId) ? prev : [...prev, projectId],
        );
        setExpandedModuleIds((prev) =>
          Array.from(new Set([...prev, ...moduleIds])),
        );

        setTemplatesGenerated(false);
        return;
      } catch {
        setError("Failed to select full project scope");
        return;
      }
    }

    const modules = modulesByProject[projectId] || [];
    const moduleIds = modules.map((m) => m.id);
    const testCaseIds = moduleIds.flatMap((mId) =>
      (testCasesByModule[mId] || []).map((tc) => tc.id),
    );

    setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId));
    setSelectedModuleIds((prev) =>
      prev.filter((id) => !moduleIds.includes(id)),
    );
    setSelectedIds((prev) => prev.filter((id) => !testCaseIds.includes(id)));
    removeFilesForTestCases(testCaseIds);
    setTemplatesGenerated(false);
  };

  const toggleModule = async (moduleId: string) => {
    const isSelected = selectedModuleIds.includes(moduleId);
    const parentProjectId = findProjectIdForModule(moduleId);

    if (!isSelected) {
      try {
        setError("");

        const moduleCases = await ensureTestCasesLoaded(moduleId);
        const testCaseIds = moduleCases.map((tc) => tc.id);

        setSelectedModuleIds((prev) =>
          Array.from(new Set([...prev, moduleId])),
        );
        setSelectedIds((prev) =>
          Array.from(new Set([...prev, ...testCaseIds])),
        );

        if (parentProjectId) {
          setSelectedProjectIds((prev) =>
            Array.from(new Set([...prev, parentProjectId])),
          );
        }

        setExpandedModuleIds((prev) =>
          prev.includes(moduleId) ? prev : [...prev, moduleId],
        );

        setTemplatesGenerated(false);
        return;
      } catch {
        setError("Failed to select full module scope");
        return;
      }
    }

    const removedTestCaseIds = (testCasesByModule[moduleId] || []).map(
      (tc) => tc.id,
    );

    setSelectedModuleIds((prev) => prev.filter((id) => id !== moduleId));
    setSelectedIds((prev) =>
      prev.filter((id) => !removedTestCaseIds.includes(id)),
    );
    removeFilesForTestCases(removedTestCaseIds);

    if (parentProjectId) {
      const siblingModuleIds = (modulesByProject[parentProjectId] || [])
        .map((m) => m.id)
        .filter((id) => id !== moduleId);

      const hasAnySelectedSibling = siblingModuleIds.some((id) =>
        selectedModuleIds.includes(id),
      );

      if (!hasAnySelectedSibling) {
        setSelectedProjectIds((prev) =>
          prev.filter((id) => id !== parentProjectId),
        );
      }
    }

    setTemplatesGenerated(false);
  };

  const toggleTestCase = (testCaseId: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(testCaseId);
      const next = exists
        ? prev.filter((v) => v !== testCaseId)
        : [...prev, testCaseId];

      if (exists) {
        setFilesByTc((cur) => {
          const updated = { ...cur };
          delete updated[testCaseId];
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
      const { blob, fileName } =
        await executionService.downloadTemplate(testCaseId);

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
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

  const currentExecutionStatus = getNormalizedStatus(statusData) || "queued";
  const statusColor = STATUS_COLORS[currentExecutionStatus] || "#89dceb";
  const isTerminalStatus = ["completed", "failed", "error"].includes(
    currentExecutionStatus,
  );

  const summary = statusData?.summary || statusData?.result?.summary;
  const results: any[] =
    statusData?.results || statusData?.result?.results || [];

  return (
    <div style={styles.page}>
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

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.stepBadge}>1</span>
          <h2 style={styles.sectionTitle}>Choose Scope</h2>
        </div>

        {projects.length === 0 ? (
          <div style={styles.emptyState}>No projects available.</div>
        ) : (
          <div style={styles.treeRoot}>
            {projects.map((project) => {
              const projectSelected = selectedProjectIds.includes(project.id);
              const modules = modulesByProject[project.id] || [];

              const projectExpanded = expandedProjectIds.includes(project.id);

              return (
                <div key={project.id} style={styles.treeNode}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleProjectExpand(project.id);
                      }}
                      style={styles.expandToggle}
                    >
                      {projectExpanded ? "▾" : "▸"}
                    </button>
                    <label style={styles.treeLabel}>
                      <input
                        type="checkbox"
                        checked={projectSelected}
                        onChange={() => toggleProject(project.id)}
                        style={styles.checkbox}
                      />
                      <span style={styles.treeTitle}>
                        Project: {project.name}
                      </span>
                    </label>
                  </div>

                  {projectExpanded && (
                    <div style={styles.treeChildren}>
                      {modules.length === 0 ? (
                        <div style={styles.treeHint}>No modules found.</div>
                      ) : (
                        modules.map((module) => {
                          const moduleExpanded = expandedModuleIds.includes(
                            module.id,
                          );

                          const moduleSelected = selectedModuleIds.includes(
                            module.id,
                          );

                          const moduleCases =
                            testCasesByModule[module.id] || [];

                          return (
                            <div key={module.id} style={styles.treeNode}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleModuleExpand(module.id);
                                  }}
                                  style={styles.expandToggle}
                                >
                                  {moduleExpanded ? "▾" : "▸"}
                                </button>
                                <label style={styles.treeLabel}>
                                  <input
                                    type="checkbox"
                                    checked={moduleSelected}
                                    onChange={() => toggleModule(module.id)}
                                    style={styles.checkbox}
                                  />
                                  <span style={styles.treeSubTitle}>
                                    Module: {module.name}
                                  </span>
                                </label>
                              </div>

                              {moduleExpanded && (
                                <div style={styles.treeChildren}>
                                  {moduleCases.length === 0 ? (
                                    <div style={styles.treeHint}>
                                      No test cases found.
                                    </div>
                                  ) : (
                                    moduleCases.map((tc) => {
                                      const checked = selectedIds.includes(
                                        tc.id,
                                      );
                                      return (
                                        <label
                                          key={tc.id}
                                          style={styles.treeLabel}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              toggleTestCase(tc.id)
                                            }
                                            style={styles.checkbox}
                                          />
                                          <span style={styles.treeLeaf}>
                                            Testcase: {tc.name}
                                          </span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.stepBadge}>2</span>
          <h2 style={styles.sectionTitle}>Selected Test Cases</h2>
          {selectedCases.length > 0 && (
            <span style={styles.countChip}>
              {selectedCases.length} selected
            </span>
          )}
        </div>

        {selectedCases.length === 0 ? (
          <div style={styles.emptyState}>
            Select test cases from the hierarchy above.
          </div>
        ) : (
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
      </div>

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

                  {renderAssertions((tc as any).assertions)}

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

      {executionId && isPolling && (
        <div style={styles.pollBanner}>
          <span style={styles.pulseDot} />
          Polling for results · {pollCount} checks
          {lastPolledAt && <span> · Last: {lastPolledAt}</span>}
        </div>
      )}

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
  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#585b70",
    fontSize: "14px",
    border: "1px dashed #313244",
    borderRadius: "10px",
  },
  treeRoot: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  treeNode: {
    border: "1px solid #313244",
    borderRadius: "8px",
    padding: "8px 10px",
    backgroundColor: "#11111b",
  },
  treeChildren: {
    marginLeft: "22px",
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  treeLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  treeTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#cdd6f4",
  },
  treeSubTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#f5c2e7",
  },
  treeLeaf: {
    fontSize: "13px",
    color: "#a6adc8",
  },
  treeHint: {
    fontSize: "12px",
    color: "#6c7086",
    paddingLeft: "4px",
  },
  checkbox: {
    accentColor: "#cba6f7",
    width: "15px",
    height: "15px",
    flexShrink: 0,
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "6px",
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
  expandToggle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "1px solid #313244",
    background: "#1e1e2e",
    color: "#a6adc8",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: "20px",
    textAlign: "center",
    padding: 0,
    flexShrink: 0,
  },
};
