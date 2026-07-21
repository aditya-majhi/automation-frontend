import { useCallback, useEffect, useMemo, useState } from "react";
import {
  executionService,
  moduleService,
  projectService,
  testCaseService,
} from "../api/services";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  clearActiveExecution,
  closeBatchModal,
  closeSummaryModal,
  openBatchModal,
  openSummaryModal,
  setActiveBatchStatus,
  setActiveExecution,
  setBatchRows,
  upsertBatchRow,
  setIsPolling,
  setStatusData,
} from "../store/executionSlice";
import * as XLSX from "xlsx";

type Project = { id: string; name: string };
type Module = { id: string; name: string; projectId?: string };
type TestCase = {
  id: string;
  name: string;
  moduleId?: string;
  assertions?: unknown;
  hasSavedExcel?: boolean;
  lastExcelUploadedAt?: string | null;
  lastExcelName?: string | null;
  lastExcelSizeBytes?: number | null;
};

type ExcelPreview = {
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
};

type CaseProgress = {
  testCaseId: string;
  name: string;
  moduleName?: string;
  projectName?: string;
  status: "queued" | "running" | "completed" | "failed";
  currentRow: number;
  totalRows: number;
  passCount: number;
  failCount: number;
  stepCount?: number;
  stepsExecuted?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  latestScreenshotUrl?: string | null;
  screenshotUrl?: string | null;
  screenshotSource?: string | null;
  latestRawError?: unknown;
  screenshots?: Array<{ url?: string | null } | string> | null;
};

type RowArtifact = {
  rowNumber: number;
  status?: string;
  screenshotUrl: string | null;
  errorJson: unknown | null;
};

type BatchDetailRow = {
  key: string;
  testCaseId: string;
  testCaseName: string;
  moduleName: string;
  projectName: string;
  status: string;
  progressText: string;
  screenshotUrl: string | null;
  errorJson: unknown | null;
  rowArtifacts: RowArtifact[];
  screenshotCount: number;
  errorCount: number;
  stepCount?: number;
};

type ExecutionBatchRow = {
  executionId: string;
  batchNumber: string;
  version: number;
  submittedOn: string;
  submittedBy: string;
  aiSummary: string;
  error: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
  displayStatus?:
    | "Running"
    | "Completed"
    | "Batch Executed"
    | "Queued"
    | string;
  projectNames?: string[];
  moduleNames?: string[];
  selectedTestCaseCount?: number;
  totalTestCaseCount?: number;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#a6e3a1",
  failed: "#f38ba8",
  error: "#f38ba8",
  running: "#fab387",
  queued: "#89dceb",
  pending: "#89dceb",
  cancelled: "#f9e2af",
};

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
              {right ? left + " " + op + " " + right : left + " " + op}
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

function formatAiSummary(text: unknown): string {
  const raw = String(text || "");
  return raw
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*-\s*/gm, "• ")
    .trim();
}

function pickScreenshotUrl(raw: any): string | null {
  const direct =
    raw?.latestScreenshotUrl ||
    raw?.screenshotUrl ||
    raw?.latestScreenshot?.url ||
    raw?.screenshot?.url ||
    raw?.imageUrl ||
    raw?.url;

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  if (Array.isArray(raw?.screenshots) && raw.screenshots.length > 0) {
    const last = raw.screenshots[raw.screenshots.length - 1];
    if (typeof last === "string" && last.trim()) return last.trim();
    if (last && typeof last?.url === "string" && last.url.trim())
      return last.url.trim();
  }

  return null;
}

function findCaseResultFromStatus(activeBatchStatus: any, cp: any): any | null {
  const cases = Array.isArray(activeBatchStatus?.result?.cases)
    ? activeBatchStatus.result.cases
    : Array.isArray(activeBatchStatus?.cases)
      ? activeBatchStatus.cases
      : [];

  const matched = cases.find((c: any) => {
    const sameId =
      cp?.testCaseId &&
      String(c?.testCaseId || "").trim() === String(cp.testCaseId).trim();
    const sameName =
      cp?.name &&
      String(c?.name || "")
        .trim()
        .toLowerCase() === String(cp.name).trim().toLowerCase();
    return sameId || sameName;
  });

  return matched || null;
}

function buildRowArtifactsFromResult(
  activeBatchStatus: any,
  cp: any,
): RowArtifact[] {
  const matched = findCaseResultFromStatus(activeBatchStatus, cp);

  if (!matched) {
    const cpShot = pickScreenshotUrl(cp);
    const cpErr = cp?.latestRawError ?? null;
    if (!cpShot && !cpErr) return [];
    return [
      {
        rowNumber: Number(cp?.currentRow || 1) || 1,
        status: String(cp?.status || "").toUpperCase(),
        screenshotUrl: cpShot,
        errorJson: cpErr,
      },
    ];
  }

  const rows = Array.isArray(matched?.rows) ? matched.rows : [];
  if (!rows.length) {
    const caseShot = pickScreenshotUrl(matched) || pickScreenshotUrl(cp);
    const caseErr = matched?.latestRawError ?? cp?.latestRawError ?? null;
    if (!caseShot && !caseErr) return [];
    return [
      {
        rowNumber: Number(cp?.currentRow || 1) || 1,
        status: String(cp?.status || "").toUpperCase(),
        screenshotUrl: caseShot,
        errorJson: caseErr,
      },
    ];
  }

  return rows.map((r: any, idx: number) => ({
    rowNumber: Number(r?.rowNumber || idx + 1),
    status: String(r?.status || "").toUpperCase(),
    screenshotUrl: pickScreenshotUrl(r),
    errorJson: r?.rawError ?? null,
  }));
}

function buildBatchDetailRows(activeBatchStatus: any): BatchDetailRow[] {
  const caseProgress = Array.isArray(activeBatchStatus?.caseProgress)
    ? activeBatchStatus.caseProgress
    : [];

  return caseProgress.map((cp: any) => {
    const rowArtifacts = buildRowArtifactsFromResult(activeBatchStatus, cp);

    const latestWithScreenshot = [...rowArtifacts]
      .reverse()
      .find((r) => Boolean(r.screenshotUrl));
    const latestWithError = [...rowArtifacts]
      .reverse()
      .find((r) => Boolean(r.errorJson));

    const screenshotCount = rowArtifacts.filter((r) =>
      Boolean(r.screenshotUrl),
    ).length;
    const errorCount = rowArtifacts.filter((r) => Boolean(r.errorJson)).length;

    return {
      key: cp.testCaseId || cp.name,
      testCaseId: cp.testCaseId,
      testCaseName: cp.name || "-",
      moduleName: cp.moduleName || "-",
      projectName: cp.projectName || "-",
      status: String(cp.status || "queued"),
      progressText: `${Number(cp.currentRow || 0)}/${Number(cp.totalRows || 0)} rows`,
      screenshotUrl: latestWithScreenshot?.screenshotUrl || null,
      errorJson: latestWithError?.errorJson ?? null,
      rowArtifacts,
      screenshotCount,
      errorCount,
      stepCount: Number(cp.stepCount || 0),
    };
  });
}

const uniqueById = <T extends { id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
};

export default function ExecutionPage() {
  const dispatch = useAppDispatch();
  const {
    activeExecutionId,
    statusData,
    isPolling,
    batchRows,
    isBatchModalOpen,
    activeBatchId,
    activeBatchStatus,
    isSummaryModalOpen,
    summaryModalTitle,
    summaryModalText,
  } = useAppSelector((state: any) => state.execution);

  // table row values
  const detailRows = buildBatchDetailRows(activeBatchStatus);

  //Batch Status values
  const activeBatchStatusText = String(
    activeBatchStatus?.status || "",
  ).toLowerCase();
  const isActiveBatchFailed =
    activeBatchStatusText === "failed" || activeBatchStatusText === "error";

  const latestScreenshotUrl =
    activeBatchStatus?.latestScreenshotUrl ||
    activeBatchStatus?.screenshotUrl ||
    activeBatchStatus?.latestScreenshot?.url ||
    (Array.isArray(activeBatchStatus?.screenshots) &&
    activeBatchStatus.screenshots.length
      ? activeBatchStatus.screenshots[activeBatchStatus.screenshots.length - 1]
          ?.url
      : null);

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

  const [batchModalTab, setBatchModalTab] = useState<
    "progress" | "screenshots" | "error"
  >("progress");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  //For previews
  const [detailPreview, setDetailPreview] = useState<{
    type: "screenshot" | "error";
    title: string;
    rows: RowArtifact[];
  } | null>(null);

  //State for rerun
  const [isRerunModalOpen, setIsRerunModalOpen] = useState(false);
  const [rerunSourceExecutionId, setRerunSourceExecutionId] =
    useState<string>("");
  const [rerunBatchLabel, setRerunBatchLabel] = useState<string>("");
  const [rerunVersionLabel, setRerunVersionLabel] = useState<number>(1);
  const [rerunOptions, setRerunOptions] = useState<any[]>([]);
  const [rerunSelectedIds, setRerunSelectedIds] = useState<string[]>([]);
  const [rerunFilesByTc, setRerunFilesByTc] = useState<
    Record<string, File | null>
  >({});
  const [rerunBusy, setRerunBusy] = useState(false);

  //For Excel Preview
  const [excelPreviewByTc, setExcelPreviewByTc] = useState<
    Record<string, ExcelPreview>
  >({});
  const [savedExcelPreviewByTc, setSavedExcelPreviewByTc] = useState<
    Record<string, ExcelPreview>
  >({});
  const [attemptedSavedPreviewByTc, setAttemptedSavedPreviewByTc] = useState<
    Record<string, boolean>
  >({});
  const [expandedExcelPreviewByTc, setExpandedExcelPreviewByTc] = useState<
    Record<string, boolean>
  >({});

  //To check if the batch is running for button disable
  const isBatchRunning = (row: ExecutionBatchRow) => {
    const s = String(row.status || "").toLowerCase();
    const d = String(row.displayStatus || "").toLowerCase();
    return s === "running" || d === "running";
  };

  //Functions for Rerun
  const openRerunModal = async (row: ExecutionBatchRow) => {
    if (isBatchRunning(row)) {
      setError("Cannot rerun while this batch is running");
      return;
    }
    try {
      setError("");
      const data = await executionService.getRerunOptions(row.executionId);
      const options = Array.isArray(data?.testCases) ? data.testCases : [];
      setRerunSourceExecutionId(row.executionId);
      setRerunBatchLabel(
        String(data?.batchNumber || row.batchNumber || row.executionId),
      );
      setRerunVersionLabel(Number(data?.sourceVersion || row.version || 1));
      setRerunOptions(options);
      setRerunSelectedIds(options.map((o: any) => o.testCaseId));
      setRerunFilesByTc({});
      setIsRerunModalOpen(true);
    } catch {
      setError("Failed to load rerun options");
    }
  };

  //To get the status of the batch
  const getBatchPopupStatus = (
    activeBatchStatus: any,
  ): "Running" | "Completed" | "Batch Executed" | "Queued" => {
    const cps = Array.isArray(activeBatchStatus?.caseProgress)
      ? activeBatchStatus.caseProgress
      : [];

    const jobStatus = String(activeBatchStatus?.status || "").toLowerCase();
    const hasRunning = cps.some(
      (c: any) => String(c?.status || "").toLowerCase() === "running",
    );
    const allTerminal =
      cps.length > 0 &&
      cps.every((c: any) =>
        ["completed", "failed", "cancelled"].includes(
          String(c?.status || "").toLowerCase(),
        ),
      );

    const hasCompletedAt = Boolean(
      activeBatchStatus?.executionDetails?.completedAt,
    );

    if (
      (jobStatus === "completed" ||
        jobStatus === "failed" ||
        jobStatus === "cancelled") &&
      hasCompletedAt
    ) {
      return "Batch Executed";
    }
    if (hasRunning || jobStatus === "running") return "Running";
    if (allTerminal) return "Completed";
    return "Queued";
  };

  //Batch status
  const popupLiveStatus = getBatchPopupStatus(activeBatchStatus);

  const startRerun = async () => {
    if (!rerunSourceExecutionId) return;
    if (!rerunSelectedIds.length) {
      setError("Select at least one testcase for rerun");
      return;
    }

    setRerunBusy(true);
    setError("");
    try {
      const filesByTestCaseId = rerunSelectedIds.reduce<Record<string, File>>(
        (acc, id) => {
          const f = rerunFilesByTc[id];
          if (f) acc[id] = f;
          return acc;
        },
        {},
      );

      const started = await executionService.startRerunExecution({
        sourceExecutionId: rerunSourceExecutionId,
        selectedTestCaseIds: rerunSelectedIds,
        filesByTestCaseId,
        runConfig: { timeoutSec: 300 },
      });

      setIsRerunModalOpen(false);
      await refreshBatchRows();
      setBatchModalTab("progress");
      dispatch(openBatchModal(started.executionId));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to start rerun");
    } finally {
      setRerunBusy(false);
    }
  };

  const hasDataSource = (tc: TestCase) =>
    Boolean(filesByTc[tc.id]) || Boolean(tc.hasSavedExcel);

  const getNormalizedStatus = (raw: any): string => {
    const value =
      raw?.status || raw?.data?.status || raw?.data?.data?.status || "";
    return String(value).toLowerCase();
  };

  //To Delete a batch execution
  const handleDeleteBatch = async (row: ExecutionBatchRow) => {
    if (isBatchRunning(row)) {
      setError("Cannot delete while this batch is running");
      return;
    }
    if (!window.confirm("Delete this execution batch?")) return;
    try {
      setError("");
      await executionService.deleteExecutionJob(row.executionId);
      if (activeBatchId === row.executionId) {
        dispatch(closeBatchModal());
      }
      await refreshBatchRows();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Failed to delete execution batch",
      );
    }
  };

  const mapStatusToBatchRow = (raw: any): ExecutionBatchRow | null => {
    const b = raw?.batch || {};
    const executionId = String(b?.executionId || raw?.executionId || "").trim();
    if (!executionId) return null;

    return {
      executionId,
      batchNumber: String(b?.batchNumber || raw?.batchNumber || executionId),
      version: Number(b?.version || raw?.version || 1),
      submittedOn: String(
        b?.submittedOn ||
          raw?.executionDetails?.submittedOn ||
          raw?.executionDetails?.requestedAt ||
          "",
      ),
      submittedBy: String(b?.submittedBy || "-"),
      aiSummary: String(
        b?.aiSummary || raw?.result?.summary || raw?.summary || "",
      ),
      error: String(b?.error || raw?.error || ""),
      status: String(raw?.status || b?.status || "queued"),
      displayStatus: b?.displayStatus,
      projectNames: Array.isArray(b?.projectNames) ? b.projectNames : [],
      moduleNames: Array.isArray(b?.moduleNames) ? b.moduleNames : [],
      selectedTestCaseCount: Number(b?.selectedTestCaseCount || 0),
      totalTestCaseCount: Number(b?.totalTestCaseCount || 0),
    };
  };

  const refreshBatchRows = useCallback(async () => {
    const rows = await executionService.listExecutionJobs();
    dispatch(setBatchRows(Array.isArray(rows) ? rows : []));
  }, [dispatch]);

  useEffect(() => {
    projectService
      .getAll()
      .then(setProjects)
      .catch(() => setError("Failed to load projects"));
    refreshBatchRows().catch(() => setError("Failed to load batch executions"));
  }, [refreshBatchRows]);

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

  useEffect(() => {
    if (!activeExecutionId) return;

    let attempts = 0;
    const maxAttempts = 120;
    dispatch(setIsPolling(true));

    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const raw =
          await executionService.getExecutionStatus(activeExecutionId);
        dispatch(setStatusData(raw));

        const rowFromStatus = mapStatusToBatchRow(raw);
        if (rowFromStatus) {
          dispatch(upsertBatchRow(rowFromStatus));
        }

        const currentStatus = String(
          raw?.status || raw?.data?.status || "",
        ).toLowerCase();
        const isTerminal =
          currentStatus === "completed" ||
          currentStatus === "failed" ||
          currentStatus === "error";

        if (isTerminal || attempts >= maxAttempts) {
          clearInterval(timer);
          dispatch(setIsPolling(false));
          dispatch(clearActiveExecution());
          refreshBatchRows().catch(() => {});
        }
      } catch {
        clearInterval(timer);
        dispatch(setIsPolling(false));
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [activeExecutionId, dispatch, refreshBatchRows]);

  useEffect(() => {
    if (!isBatchModalOpen || !activeBatchId) return;

    let alive = true;
    let timer: any = null;

    const tick = async () => {
      try {
        const live = await executionService.getExecutionStatus(activeBatchId);
        if (!alive) return;

        dispatch(
          setActiveBatchStatus({
            ...(live || {}),
            _source: "live",
            _capturedAt: new Date().toISOString(),
          }),
        );

        const rowFromLive = mapStatusToBatchRow(live);
        if (rowFromLive) {
          dispatch(upsertBatchRow(rowFromLive));
        }

        const st = String(live?.status || "").toLowerCase();
        const terminal =
          st === "completed" || st === "failed" || st === "error";
        if (!terminal) {
          timer = setTimeout(tick, 3000);
        } else {
          refreshBatchRows().catch(() => {});
        }
      } catch {
        if (!alive) return;

        if (!activeBatchStatus) {
          const row = (batchRows as ExecutionBatchRow[]).find(
            (r) => r.executionId === activeBatchId,
          );
          if (row) {
            dispatch(
              setActiveBatchStatus({
                status: row.status || "queued",
                caseProgress: [],
                _source: "redux-fallback",
                _capturedAt: new Date().toISOString(),
              }),
            );
          }
        }

        timer = setTimeout(tick, 4000);
      }
    };

    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [isBatchModalOpen, activeBatchId, dispatch, refreshBatchRows]);

  const allTestCases = useMemo(
    () => Object.values(testCasesByModule).flat(),
    [testCasesByModule],
  );

  const selectedCases = useMemo(
    () => allTestCases.filter((tc) => selectedIds.includes(tc.id)),
    [allTestCases, selectedIds],
  );

  useEffect(() => {
    const toLoad = selectedCases.filter(
      (tc) =>
        tc.hasSavedExcel &&
        !excelPreviewByTc[tc.id] &&
        !savedExcelPreviewByTc[tc.id] &&
        !attemptedSavedPreviewByTc[tc.id],
    );

    if (!toLoad.length) return;

    toLoad.forEach((tc) => {
      void loadSavedExcelPreview(tc.id);
    });
  }, [
    selectedCases,
    excelPreviewByTc,
    savedExcelPreviewByTc,
    attemptedSavedPreviewByTc,
  ]);

  const uploadedCount = selectedCases.filter((tc) =>
    Boolean(filesByTc[tc.id]),
  ).length;

  const allSelectedFilesReady =
    selectedCases.length > 0 && selectedCases.every((tc) => hasDataSource(tc));

  const removeFilesForTestCases = (testCaseIds: string[]) => {
    if (!testCaseIds.length) return;

    setFilesByTc((cur) => {
      const next = { ...cur };
      testCaseIds.forEach((id) => delete next[id]);
      return next;
    });

    setExcelPreviewByTc((cur) => {
      const next = { ...cur };
      testCaseIds.forEach((id) => delete next[id]);
      return next;
    });

    setExpandedExcelPreviewByTc((cur) => {
      const next = { ...cur };
      testCaseIds.forEach((id) => delete next[id]);
      return next;
    });

    setSavedExcelPreviewByTc((cur) => {
      const next = { ...cur };
      testCaseIds.forEach((id) => delete next[id]);
      return next;
    });

    setAttemptedSavedPreviewByTc((cur) => {
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
          const allModulesForProject = (
            modulesByProject[parentProjectId] || []
          ).map((m) => m.id);
          const newSelectedModuleIds = new Set([
            ...selectedModuleIds,
            moduleId,
          ]);
          const allModulesSelected = allModulesForProject.every((mId) =>
            newSelectedModuleIds.has(mId),
          );

          if (allModulesSelected) {
            setSelectedProjectIds((prev) =>
              Array.from(new Set([...prev, parentProjectId])),
            );
          }
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

      console.log({ exists });

      if (exists) {
        setFilesByTc((cur) => {
          const updated = { ...cur };
          delete updated[testCaseId];
          return updated;
        });

        setExcelPreviewByTc((cur) => {
          const updated = { ...cur };
          delete updated[testCaseId];
          return updated;
        });

        setExpandedExcelPreviewByTc((cur) => {
          const updated = { ...cur };
          delete updated[testCaseId];
          return updated;
        });
      }

      if (!exists) {
        const tc = allTestCases.find((item) => item.id === testCaseId);
        if (tc?.hasSavedExcel && !savedExcelPreviewByTc[testCaseId]) {
          loadSavedExcelPreview(testCaseId);
        }
      }
      return next;
    });
    setTemplatesGenerated(false);
  };

  const downloadTemplate = async (testCaseId: string, testCaseName: string) => {
    try {
      setError("");
      const res = await executionService.downloadTemplate(testCaseId);

      const url = URL.createObjectURL(res.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download template for " + testCaseName);
    }
  };

  //Helper for excel preview
  const parseExcelBlobPreview = async (blob: Blob): Promise<ExcelPreview> => {
    const buffer = await blob.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const rows = rawRows.map((r) => {
      const rowObj: Record<string, string> = {};
      for (const k of headers) rowObj[k] = String(r[k] ?? "");
      return rowObj;
    });

    return {
      headers,
      rows,
      totalRows: rows.length,
    };
  };

  const loadSavedExcelPreview = async (testCaseId: string) => {
    try {
      const res = await testCaseService.getSavedExcel(testCaseId);
      const preview = await parseExcelBlobPreview(res.blob);

      setSavedExcelPreviewByTc((prev) => ({
        ...prev,
        [testCaseId]: preview,
      }));
    } catch {
      setSavedExcelPreviewByTc((prev) => {
        const next = { ...prev };
        delete next[testCaseId];
        return next;
      });
    } finally {
      setAttemptedSavedPreviewByTc((prev) => ({
        ...prev,
        [testCaseId]: true,
      }));
    }
  };

  const onUpload = async (testCaseId: string, file?: File) => {
    if (!file) return;

    setFilesByTc((prev) => ({ ...prev, [testCaseId]: file }));
    setTemplatesGenerated(true);

    try {
      const preview = await parseExcelBlobPreview(file);
      setExcelPreviewByTc((prev) => ({ ...prev, [testCaseId]: preview }));
      setExpandedExcelPreviewByTc((prev) => ({
        ...prev,
        [testCaseId]: true,
      }));

      setSavedExcelPreviewByTc((prev) => {
        const next = { ...prev };
        delete next[testCaseId];
        return next;
      });
    } catch {
      setExcelPreviewByTc((prev) => {
        const next = { ...prev };
        delete next[testCaseId];
        return next;
      });
      setError(
        "Uploaded file accepted, but Excel row preview could not be generated.",
      );
    }
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

      dispatch(setActiveExecution(started.executionId));
      dispatch(setStatusData(started));

      await refreshBatchRows();

      setBatchModalTab("progress");
      dispatch(openBatchModal(started.executionId));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to start execution");
    } finally {
      setBusy(false);
    }
  };

  const currentExecutionStatus = getNormalizedStatus(statusData) || "queued";

  const topStatus = String(
    (batchRows?.[0] as ExecutionBatchRow | undefined)?.status ||
      currentExecutionStatus ||
      "queued",
  ).toLowerCase();
  const topStatusColor = STATUS_COLORS[topStatus] || "#89dceb";

  const activeBatchLabel = useMemo(() => {
    const fromLive =
      activeBatchStatus?.batch?.batchNumber || activeBatchStatus?.batchNumber;
    if (fromLive) return String(fromLive);

    const row = (batchRows as ExecutionBatchRow[]).find(
      (r) => r.executionId === activeBatchId,
    );
    if (row?.batchNumber) return String(row.batchNumber);

    return activeBatchId || "-";
  }, [activeBatchStatus, batchRows, activeBatchId]);

  const resolvedStepCount =
    activeBatchStatus?.executionDetails?.stepCount ??
    activeBatchStatus?.stepCount ??
    activeBatchStatus?.stepsExecuted ??
    activeBatchStatus?.result?.stepCount ??
    activeBatchStatus?.result?.stepsExecuted ??
    "-";

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

        {(activeExecutionId ||
          (batchRows as ExecutionBatchRow[]).length > 0) && (
          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: topStatusColor + "20",
              color: topStatusColor,
              borderColor: topStatusColor + "50",
            }}
          >
            {isPolling && <span style={styles.pulseDot} />}
            {topStatus.toUpperCase()}
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
                {uploadedCount + "/" + selectedCases.length}
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
              Download Templates and Upload Data
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

                    <div
                      style={{ marginTop: 8, fontSize: 12, color: "#a6adc8" }}
                    >
                      {tc.hasSavedExcel ? (
                        <span>
                          Saved Excel available
                          {tc.lastExcelName ? ": " + tc.lastExcelName : ""}
                          {tc.lastExcelUploadedAt
                            ? " (last uploaded " +
                              new Date(
                                tc.lastExcelUploadedAt,
                              ).toLocaleString() +
                              ")"
                            : ""}
                        </span>
                      ) : (
                        <span style={{ color: "#fab387" }}>No saved Excel</span>
                      )}
                    </div>
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

      {templatesGenerated && selectedCases.length > 0 && (
        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Excel Preview</h2>
            <span style={styles.countChip}>
              {
                selectedCases.filter((tc) =>
                  Boolean(
                    excelPreviewByTc[tc.id] || savedExcelPreviewByTc[tc.id],
                  ),
                ).length
              }{" "}
              preview(s)
            </span>
          </div>

          {selectedCases.filter((tc) =>
            Boolean(excelPreviewByTc[tc.id] || savedExcelPreviewByTc[tc.id]),
          ).length === 0 ? (
            <div style={styles.emptyState}>
              Upload an Excel file or use the saved Excel to preview testcase
              data.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedCases.map((tc) => {
                const uploadedPreview = excelPreviewByTc[tc.id];
                const savedPreview = savedExcelPreviewByTc[tc.id];
                const preview = uploadedPreview || savedPreview;

                if (!preview) return null;

                const isUploaded = Boolean(uploadedPreview);
                const isOpen = Boolean(expandedExcelPreviewByTc[tc.id]);

                return (
                  <div
                    key={tc.id}
                    style={{
                      border: "1px solid #313244",
                      borderRadius: 10,
                      backgroundColor: "#11111b",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedExcelPreviewByTc((prev) => ({
                          ...prev,
                          [tc.id]: !isOpen,
                        }))
                      }
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        background: "transparent",
                        border: "none",
                        color: "#cdd6f4",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <span>
                        {tc.name} {isUploaded ? "(Uploaded)" : "(Saved)"}
                      </span>
                      <span style={{ color: "#a6adc8", fontSize: 12 }}>
                        {isOpen ? "Hide" : "Show"} ({preview.totalRows} rows)
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 14px 14px" }}>
                        <div style={{ overflowX: "auto" }}>
                          <div
                            style={{
                              maxHeight: preview.rows.length > 2 ? 110 : "none",
                              overflowY:
                                preview.rows.length > 2 ? "auto" : "visible",
                              border: "1px solid #313244",
                              borderRadius: 8,
                            }}
                          >
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 12,
                              }}
                            >
                              <thead
                                style={{
                                  position: "sticky",
                                  top: 0,
                                  backgroundColor: "#11111b",
                                  zIndex: 1,
                                }}
                              >
                                <tr>
                                  {preview.headers.map((h) => (
                                    <th
                                      key={h}
                                      style={{
                                        textAlign: "left",
                                        padding: "6px 8px",
                                        borderBottom: "1px solid #313244",
                                        color: "#cdd6f4",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {preview.rows.map((row, idx) => (
                                  <tr key={idx}>
                                    {preview.headers.map((h) => (
                                      <td
                                        key={h}
                                        style={{
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #1e1e2e",
                                          color: "#a6adc8",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {row[h]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Batch Executions</h2>
          <span style={styles.countChip}>
            {(batchRows as ExecutionBatchRow[]).length} batches
          </span>
        </div>

        {(batchRows as ExecutionBatchRow[]).length === 0 ? (
          <div style={styles.emptyState}>No batch executions yet.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Batch Number</th>
                  <th style={styles.th}>Version</th>
                  <th style={styles.th}>Submitted On</th>
                  <th style={styles.th}>Submitted By</th>
                  <th style={styles.th}>AI Summary</th>
                  <th style={styles.th}>Error</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(batchRows as ExecutionBatchRow[]).map((row) => {
                  const rowStatus = String(
                    row.status || "queued",
                  ).toLowerCase();
                  const color = STATUS_COLORS[rowStatus] || "#89dceb";
                  const rowRunning = isBatchRunning(row);

                  return (
                    <tr key={row.executionId} style={styles.tr}>
                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.linkBtn}
                          onClick={() => {
                            setBatchModalTab("progress");
                            dispatch(openBatchModal(row.executionId));
                            dispatch(
                              setActiveBatchStatus({
                                status: row.status,
                                caseProgress: [],
                                _source: "table",
                                _capturedAt: new Date().toISOString(),
                              }),
                            );
                          }}
                        >
                          {row.batchNumber}
                        </button>
                      </td>

                      <td style={styles.td}>V{row.version || "1"}</td>

                      <td style={styles.td}>
                        {row.submittedOn
                          ? new Date(row.submittedOn).toLocaleString()
                          : "-"}
                      </td>

                      <td style={styles.td}>{row.submittedBy || "-"}</td>

                      <td style={styles.td}>
                        {row.aiSummary ? (
                          <button
                            type="button"
                            style={styles.linkBtn}
                            onClick={() => {
                              dispatch(
                                openSummaryModal({
                                  title: "AI Summary - " + row.batchNumber,
                                  text: formatAiSummary(row.aiSummary),
                                }),
                              );
                            }}
                          >
                            View Summary
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td style={styles.tdError} title={row.error || ""}>
                        {row.error || "-"}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            color,
                            borderColor: color + "55",
                            backgroundColor: color + "1A",
                          }}
                        >
                          {String(
                            row.displayStatus || row.status || "queued",
                          ).toUpperCase()}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            type="button"
                            style={{
                              ...styles.linkBtn,
                              opacity: rowRunning ? 0.45 : 1,
                              cursor: rowRunning ? "not-allowed" : "pointer",
                            }}
                            onClick={() => openRerunModal(row)}
                            disabled={rowRunning}
                            title={rowRunning ? "Batch is running" : "Rerun"}
                          >
                            Rerun
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.linkBtn,
                              color: "#f38ba8",
                              opacity: rowRunning ? 0.45 : 1,
                              cursor: rowRunning ? "not-allowed" : "pointer",
                            }}
                            onClick={() => handleDeleteBatch(row)}
                            disabled={rowRunning}
                            title={rowRunning ? "Batch is running" : "Delete"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={styles.actionBar}>
        <div style={styles.actionBarInner}>
          {selectedCases.length > 0 && !allSelectedFilesReady && (
            <span style={styles.actionHint}>
              {!templatesGenerated
                ? "Generate templates first"
                : selectedCases.length -
                  uploadedCount +
                  " file(s) still needed"}
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

      {isBatchModalOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => dispatch(closeBatchModal())}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Batch: {activeBatchLabel}</h3>

              {/* {activeBatchStatus?._source && (
                <span style={styles.countChip}>
                  {activeBatchStatus._source === "live"
                    ? "Live status"
                    : "Snapshot"}
                </span>
              )} */}
              <span style={styles.countChip}>{popupLiveStatus}</span>

              <button
                type="button"
                style={styles.modalClose}
                onClick={() => dispatch(closeBatchModal())}
              >
                Close
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(140px, 1fr))",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div style={styles.statChip}>
                <span style={styles.statLabel}>Start Time</span>
                <span style={styles.statVal}>
                  {activeBatchStatus?.executionDetails?.startedAt
                    ? new Date(
                        activeBatchStatus.executionDetails.startedAt,
                      ).toLocaleString()
                    : "-"}
                </span>
              </div>
              <div style={styles.statChip}>
                <span style={styles.statLabel}>End Time</span>
                <span style={styles.statVal}>
                  {activeBatchStatus?.executionDetails?.completedAt
                    ? new Date(
                        activeBatchStatus.executionDetails.completedAt,
                      ).toLocaleString()
                    : "-"}
                </span>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Testcase Name</th>
                    <th style={styles.th}>Module Name</th>
                    <th style={styles.th}>Project Name</th>
                    <th style={styles.th}>Steps</th>
                    <th style={styles.th}>Progress</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Screenshot</th>
                    <th style={styles.th}>Error JSON</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row) => {
                    const statusKey = row.status.toLowerCase();
                    const statusColor = STATUS_COLORS[statusKey] || "#89dceb";

                    return (
                      <tr key={row.key} style={styles.tr}>
                        <td style={styles.td}>{row.testCaseName}</td>
                        <td style={styles.td}>{row.moduleName}</td>
                        <td style={styles.td}>{row.projectName}</td>
                        <td style={styles.td}>{Number(row.stepCount || 0)}</td>
                        <td style={styles.td}>{row.progressText}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusPill,
                              color: statusColor,
                              borderColor: statusColor + "66",
                              backgroundColor: statusColor + "1A",
                            }}
                          >
                            {row.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {row.screenshotCount > 0 ? (
                            <button
                              type="button"
                              style={styles.linkBtn}
                              onClick={() =>
                                setDetailPreview({
                                  type: "screenshot",
                                  title: row.testCaseName,
                                  rows: row.rowArtifacts.filter((x) =>
                                    Boolean(x.screenshotUrl),
                                  ),
                                })
                              }
                            >
                              View Screenshots ({row.screenshotCount})
                            </button>
                          ) : (
                            <span style={styles.treeHint}>Not available</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {row.errorCount > 0 ? (
                            <button
                              type="button"
                              style={styles.linkBtn}
                              onClick={() =>
                                setDetailPreview({
                                  type: "error",
                                  title: row.testCaseName,
                                  rows: row.rowArtifacts.filter((x) =>
                                    Boolean(x.errorJson),
                                  ),
                                })
                              }
                            >
                              View Errors ({row.errorCount})
                            </button>
                          ) : (
                            <span style={styles.treeHint}>No error</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isSummaryModalOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => dispatch(closeSummaryModal())}
        >
          <div
            style={styles.modalCardLarge}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{summaryModalTitle}</h3>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => dispatch(closeSummaryModal())}
              >
                Close
              </button>
            </div>
            <div style={styles.summaryModalBody}>
              {summaryModalText || "No summary available."}
            </div>
          </div>
        </div>
      )}

      {/* Rerun Modal */}
      {isRerunModalOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => setIsRerunModalOpen(false)}
        >
          <div
            style={styles.modalCardLarge}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                Rerun Batch {rerunBatchLabel} (Source V{rerunVersionLabel})
              </h3>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setIsRerunModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Select</th>
                    <th style={styles.th}>Testcase</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Module</th>
                    <th style={styles.th}>Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {rerunOptions.map((tc: any) => {
                    const checked = rerunSelectedIds.includes(tc.testCaseId);
                    return (
                      <tr key={tc.testCaseId} style={styles.tr}>
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setRerunSelectedIds((prev) =>
                                checked
                                  ? prev.filter((id) => id !== tc.testCaseId)
                                  : [...prev, tc.testCaseId],
                              )
                            }
                          />
                        </td>
                        <td style={styles.td}>{tc.name}</td>
                        <td style={styles.td}>{tc.projectName || "-"}</td>
                        <td style={styles.td}>{tc.moduleName || "-"}</td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.linkBtn}
                            onClick={() =>
                              downloadTemplate(tc.testCaseId, tc.name)
                            }
                          >
                            Download Template
                          </button>
                          <label
                            style={{ ...styles.uploadLabel, marginLeft: 8 }}
                          >
                            Upload
                            <input
                              type="file"
                              accept=".xlsx"
                              style={{ display: "none" }}
                              onChange={(e) =>
                                setRerunFilesByTc((p) => ({
                                  ...p,
                                  [tc.testCaseId]: e.target.files?.[0] || null,
                                }))
                              }
                            />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setIsRerunModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={rerunBusy}
                onClick={startRerun}
              >
                {rerunBusy ? "Starting..." : "Rerun Selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot/error modal */}
      {detailPreview && (
        <div
          style={styles.nestedModalOverlay}
          onClick={() => setDetailPreview(null)}
        >
          <div
            style={styles.nestedModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {detailPreview.type === "screenshot"
                  ? "Screenshot"
                  : "Error JSON"}
                : {detailPreview.title}
              </h3>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setDetailPreview(null)}
              >
                Close
              </button>
            </div>

            {detailPreview.type === "screenshot" ? (
              detailPreview.rows.length > 0 ? (
                <div style={styles.rowArtifactList}>
                  {detailPreview.rows.map((r, idx) => (
                    <div
                      key={`${r.rowNumber}-${idx}`}
                      style={styles.rowArtifactCard}
                    >
                      <div style={styles.rowArtifactTitle}>
                        Row {r.rowNumber}
                        {r.status ? (
                          <span style={styles.rowArtifactMeta}>
                            {" "}
                            ({r.status})
                          </span>
                        ) : null}
                      </div>
                      {r.screenshotUrl ? (
                        <img
                          src={r.screenshotUrl}
                          alt={`${detailPreview.title} row ${r.rowNumber}`}
                          style={styles.previewImage}
                        />
                      ) : (
                        <div style={styles.emptyState}>
                          No screenshot available.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyState}>No screenshot available.</div>
              )
            ) : detailPreview.rows.length > 0 ? (
              <div style={styles.rowArtifactList}>
                {detailPreview.rows.map((r, idx) => (
                  <div
                    key={`${r.rowNumber}-${idx}`}
                    style={styles.rowArtifactCard}
                  >
                    <div style={styles.rowArtifactTitle}>
                      Row {r.rowNumber}
                      {r.status ? (
                        <span style={styles.rowArtifactMeta}>
                          {" "}
                          ({r.status})
                        </span>
                      ) : null}
                    </div>
                    <pre style={styles.jsonPreview}>
                      {JSON.stringify(r.errorJson || {}, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>No row errors available.</div>
            )}
          </div>
        </div>
      )}
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
    marginBottom: "10px",
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid #89b4fa50",
    backgroundColor: "#89b4fa15",
    color: "#89b4fa",
    fontSize: "13px",
    flexWrap: "wrap",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #313244",
    borderRadius: "10px",
    backgroundColor: "#11111b",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 980,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#a6adc8",
    borderBottom: "1px solid #313244",
    padding: "12px 10px",
    fontWeight: 700,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
  },
  tr: {
    borderBottom: "1px solid #1e1e2e",
  },
  td: {
    padding: "10px",
    fontSize: 13,
    color: "#cdd6f4",
    verticalAlign: "top",
  },
  tdError: {
    padding: "10px",
    fontSize: 12,
    color: "#f38ba8",
    maxWidth: 280,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "top",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#89dceb",
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
    fontSize: 13,
    fontWeight: 600,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.4px",
  },
  caseResultStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5000,
    padding: 20,
  },
  modalCard: {
    width: "min(900px, 95vw)",
    maxHeight: "85vh",
    overflowY: "auto",
    backgroundColor: "#1e1e2e",
    border: "1px solid #313244",
    borderRadius: 12,
    padding: 16,
  },
  modalCardLarge: {
    width: "min(980px, 96vw)",
    maxHeight: "88vh",
    overflowY: "auto",
    backgroundColor: "#1e1e2e",
    border: "1px solid #313244",
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    color: "#f5c2e7",
  },
  modalClose: {
    border: "1px solid #313244",
    background: "#11111b",
    color: "#cdd6f4",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
  },
  summaryModalBody: {
    whiteSpace: "pre-wrap",
    fontSize: 14,
    lineHeight: 1.65,
    color: "#cdd6f4",
    backgroundColor: "#11111b",
    border: "1px solid #313244",
    borderRadius: 10,
    padding: 14,
  },
  tabButton: {
    padding: "8px 14px",
    backgroundColor: "transparent",
    color: "#89dceb",
    border: "1px solid #89dceb50",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
    marginLeft: 0,
  },
  tabButtonActive: {
    padding: "8px 14px",
    backgroundColor: "#cba6f720",
    color: "#cba6f7",
    border: "1px solid #cba6f740",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
    marginLeft: 0,
  },
  nestedModalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5100,
    padding: 20,
  },
  nestedModalCard: {
    width: "min(1000px, 94vw)",
    maxHeight: "86vh",
    overflowY: "auto",
    backgroundColor: "#11111b",
    border: "1px solid #313244",
    borderRadius: 12,
    padding: 16,
  },
  previewImage: {
    width: "100%",
    maxHeight: "72vh",
    objectFit: "contain",
    borderRadius: 8,
    border: "1px solid #313244",
    backgroundColor: "#0b0b12",
  },
  jsonPreview: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#cdd6f4",
    backgroundColor: "#181825",
    border: "1px solid #313244",
    borderRadius: 10,
    padding: 14,
  },
};
