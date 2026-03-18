import { useState } from "react";

type Step = {
  type?: string;
  action?: string;
  selector?: { css?: string; xpath?: string; relativeXPath?: string };
  selectorCss?: string;
  selectorXpath?: string;
  selectorRelativeXpath?: string;
  value?: any;
  targetTag?: string;
  timestamp?: number | string;
  createdAt?: string;
  pageUrl?: string;
  pageTitle?: string;
  pageName?: string;
  context?: any;
  contextMeta?: any;
  inputType?: string;
  checked?: boolean;
  fieldName?: string;
  [key: string]: any;
};

type Variable = {
  id?: string;
  kind?: "input" | "output" | string;
  name?: string;
  context?: string;
  contextMeta?: any;
  dataType?: string;
  selector?: { css?: string; xpath?: string; relativeXPath?: string };
  selectorCss?: string;
  selectorXpath?: string;
  selectorRelativeXpath?: string;
  value?: any;
  targetTag?: string;
  inputType?: string;
  enumValues?: Array<{ value: string; label: string }> | null;
  tableRowIndex?: number | null;
  tableColumnIndex?: number | null;
  tableColumnHeader?: string | null;
  pageUrl?: string;
  pageTitle?: string;
  pageName?: string;
  createdAt?: string | number;
  [key: string]: any;
};

interface RecordingDetailsTabsProps {
  recording: {
    steps: Step[];
    variables?: Variable[];
    videoUrl?: string | null;
  };
}

type TabKey = "steps" | "variables" | "selenium" | "video";
type LocatorPref = "relativeXPath" | "css" | "xpath";

const LOCATOR_OPTIONS: { key: LocatorPref; label: string }[] = [
  { key: "relativeXPath", label: "Relative XPath" },
  { key: "css", label: "CSS" },
  { key: "xpath", label: "XPath" },
];

const DATA_TYPE_LABELS: Record<string, string> = {
  string: "String",
  text: "Text",
  number: "Number",
  boolean: "Boolean",
  email: "Email",
  url: "URL",
  phone: "Phone",
  date: "Date",
  datetime: "DateTime",
  time: "Time",
  password: "Password",
  color: "Color",
  file: "File",
  enum_type: "Enum",
  enum: "Enum",
};

const DATA_TYPE_COLORS: Record<string, string> = {
  string: "#89b4fa",
  text: "#89b4fa",
  number: "#fab387",
  boolean: "#a6e3a1",
  email: "#74c7ec",
  url: "#74c7ec",
  phone: "#cba6f7",
  date: "#f9e2af",
  datetime: "#f9e2af",
  time: "#f9e2af",
  password: "#f38ba8",
  color: "#f5c2e7",
  file: "#94e2d5",
  enum_type: "#eba0ac",
  enum: "#eba0ac",
};

const CONTEXT_ICONS: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  formField: { icon: "📝", label: "Form Field", color: "#cba6f7" },
  table: { icon: "📊", label: "Table", color: "#f9e2af" },
  modal: { icon: "🪟", label: "Modal", color: "#89b4fa" },
  sidebar: { icon: "📑", label: "Sidebar", color: "#94e2d5" },
  navbar: { icon: "🧭", label: "Navbar", color: "#74c7ec" },
  accordion: { icon: "🪗", label: "Accordion", color: "#f5c2e7" },
  card: { icon: "🃏", label: "Card", color: "#a6e3a1" },
  toolbar: { icon: "🔧", label: "Toolbar", color: "#fab387" },
  footer: { icon: "⬇️", label: "Footer", color: "#6c7086" },
  tabPanel: { icon: "📂", label: "Tab Panel", color: "#89dceb" },
  dropdown: { icon: "📋", label: "Dropdown", color: "#eba0ac" },
};

const ACTION_STYLES: Record<string, { bg: string; fg: string }> = {
  click: { bg: "#89b4fa20", fg: "#89b4fa" },
  input: { bg: "#a6e3a120", fg: "#a6e3a1" },
  select: { bg: "#cba6f720", fg: "#cba6f7" },
  check: { bg: "#f9e2af20", fg: "#f9e2af" },
  submit: { bg: "#f38ba820", fg: "#f38ba8" },
};

// ── Selector normalization ────────────────────────────────────────────────────

function normalizeSelector(
  obj: any,
): { css?: string; xpath?: string; relativeXPath?: string } | undefined {
  if (obj?.selector && typeof obj.selector === "object") return obj.selector;
  if (obj?.selectorCss || obj?.selectorXpath || obj?.selectorRelativeXpath) {
    return {
      css: obj.selectorCss || undefined,
      xpath: obj.selectorXpath || undefined,
      relativeXPath: obj.selectorRelativeXpath || undefined,
    };
  }
  return undefined;
}

function getPreferredLocator(
  selector: ReturnType<typeof normalizeSelector>,
  pref: LocatorPref,
): { type: string; value: string } | null {
  if (!selector) return null;
  const order: LocatorPref[] =
    pref === "relativeXPath"
      ? ["relativeXPath", "css", "xpath"]
      : pref === "css"
        ? ["css", "relativeXPath", "xpath"]
        : ["xpath", "relativeXPath", "css"];
  for (const key of order) {
    const val = selector[key];
    if (val) return { type: key, value: val };
  }
  return null;
}

function getLocatorLabel(type: string): string {
  if (type === "relativeXPath") return "rel-xpath";
  return type;
}

// ── Page name resolution ──────────────────────────────────────────────────────

function resolvePageName(obj: {
  pageName?: string;
  pageTitle?: string;
  pageUrl?: string;
}): string {
  if (obj.pageName) return obj.pageName;
  if (obj.pageTitle) {
    const cleaned = obj.pageTitle.split(/\s*[\-\|·»::]\s*/)[0].trim();
    return cleaned || obj.pageTitle;
  }
  if (obj.pageUrl) {
    try {
      const u = new URL(obj.pageUrl);
      const path = u.pathname;
      if (path && path !== "/") {
        const segments = path
          .split("/")
          .filter(Boolean)
          .filter((s) => !/^[0-9a-f\-]{8,}$/i.test(s))
          .filter((s) => !/^\d+$/.test(s));
        if (segments.length) {
          return segments
            .map((s) =>
              s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            )
            .join(" › ");
        }
      }
      return u.hostname;
    } catch {
      return obj.pageUrl.length > 40
        ? obj.pageUrl.slice(0, 40) + "…"
        : obj.pageUrl;
    }
  }
  return "-";
}

// ── Context resolution ────────────────────────────────────────────────────────

function resolveContext(obj: any): string {
  if (obj.context && typeof obj.context === "string") return obj.context;
  if (obj.context && typeof obj.context === "object" && obj.context.type)
    return obj.context.type;
  if (
    obj.contextMeta &&
    typeof obj.contextMeta === "object" &&
    obj.contextMeta.type
  )
    return obj.contextMeta.type;
  return "formField";
}

function getContextMeta(obj: any): any {
  if (obj.contextMeta && typeof obj.contextMeta === "object")
    return obj.contextMeta;
  if (obj.context && typeof obj.context === "object") return obj.context;
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

const RecordingDetailsTabs: React.FC<RecordingDetailsTabsProps> = ({
  recording,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("steps");
  const [locatorPref, setLocatorPref] = useState<LocatorPref>("relativeXPath");
  const steps = recording.steps || [];
  const variables = recording.variables || [];
  const inputVars = variables.filter((v) => v.kind === "input");
  const outputVars = variables.filter((v) => v.kind === "output");

  return (
    <div>
      <div style={styles.tabHeader}>
        {renderTabButton(
          "Steps & Locators",
          "steps",
          activeTab,
          setActiveTab,
          steps.length,
        )}
        {renderTabButton(
          "Variables",
          "variables",
          activeTab,
          setActiveTab,
          variables.length,
        )}
        {renderTabButton(
          "Selenium Script",
          "selenium",
          activeTab,
          setActiveTab,
        )}
        {recording.videoUrl &&
          renderTabButton("Video", "video", activeTab, setActiveTab)}
      </div>

      {(activeTab === "steps" || activeTab === "selenium") && (
        <div style={styles.locatorBar}>
          <span style={styles.locatorLabel}>Default Locator:</span>
          {LOCATOR_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setLocatorPref(opt.key)}
              style={{
                ...styles.locatorChip,
                ...(locatorPref === opt.key ? styles.locatorChipActive : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div style={styles.tabBody}>
        {activeTab === "steps" && (
          <StepsTable steps={steps} locatorPref={locatorPref} />
        )}
        {activeTab === "variables" && (
          <VariablesPanel
            inputVars={inputVars}
            outputVars={outputVars}
            locatorPref={locatorPref}
          />
        )}
        {activeTab === "selenium" && (
          <SeleniumScriptView steps={steps} locatorPref={locatorPref} />
        )}
        {activeTab === "video" && recording.videoUrl && (
          <video src={recording.videoUrl} controls style={styles.video} />
        )}
      </div>
    </div>
  );
};

function renderTabButton(
  label: string,
  key: TabKey,
  activeTab: TabKey,
  setActiveTab: (k: TabKey) => void,
  count?: number,
) {
  return (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key)}
      style={{
        ...styles.tabButton,
        ...(activeTab === key ? styles.tabButtonActive : {}),
      }}
    >
      {label}
      {count != null && count > 0 && <span style={styles.badge}>{count}</span>}
    </button>
  );
}

// ── Steps Table ───────────────────────────────────────────────────────────────

const StepsTable: React.FC<{ steps: Step[]; locatorPref: LocatorPref }> = ({
  steps,
  locatorPref,
}) => {
  if (!steps.length)
    return <div style={styles.empty}>No steps recorded yet.</div>;

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>Time</th>
            <th style={styles.th}>Action</th>
            <th style={styles.th}>Element</th>
            <th style={styles.th}>Locator</th>
            <th style={styles.th}>Value</th>
            <th style={styles.th}>Page</th>
            <th style={styles.th}>Context</th>
            <th style={styles.th}>Selenium</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => {
            const action = (step.action || step.type || "-").toString();
            const selector = normalizeSelector(step);
            const locator = getPreferredLocator(selector, locatorPref);
            const elementLabel = buildElementLabel(step.targetTag, selector);
            const value = step.value ?? null;
            const selenium = generateSeleniumFromStep(step, locatorPref);
            const pageName = resolvePageName(step);
            const contextType = resolveContext(step);
            const ctxInfo =
              CONTEXT_ICONS[contextType] || CONTEXT_ICONS.formField;
            const actionStyle = ACTION_STYLES[action] || {
              bg: "#45475a20",
              fg: "#a6adc8",
            };

            return (
              <tr key={index} style={index % 2 === 0 ? {} : styles.rowAlt}>
                <td style={styles.td}>{index + 1}</td>
                <td style={styles.td}>
                  {formatTime(step.timestamp ?? step.createdAt)}
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.actionBadge,
                      backgroundColor: actionStyle.bg,
                      color: actionStyle.fg,
                    }}
                  >
                    {action}
                  </span>
                </td>
                <td style={styles.td}>{elementLabel}</td>
                <td style={styles.tdLocators}>
                  {locator ? (
                    <div>
                      <span style={styles.locatorType}>
                        {getLocatorLabel(locator.type)}:
                      </span>{" "}
                      <code style={styles.locatorCode}>{locator.value}</code>
                    </div>
                  ) : (
                    <span style={styles.muted}>-</span>
                  )}
                  <LocatorDetails selector={selector} exclude={locator?.type} />
                </td>
                <td style={styles.td}>
                  {value != null ? (
                    String(value)
                  ) : (
                    <span style={styles.muted}>-</span>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={styles.pageLabel} title={step.pageUrl || ""}>
                    {pageName}
                  </span>
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.contextBadge,
                      backgroundColor: ctxInfo.color + "20",
                      color: ctxInfo.color,
                    }}
                  >
                    {ctxInfo.icon} {ctxInfo.label}
                  </span>
                </td>
                <td style={styles.tdCode}>{selenium || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Locator Details ───────────────────────────────────────────────────────────

const LocatorDetails: React.FC<{
  selector?: ReturnType<typeof normalizeSelector>;
  exclude?: string;
}> = ({ selector, exclude }) => {
  const [expanded, setExpanded] = useState(false);
  if (!selector) return null;
  const others = Object.entries(selector).filter(
    ([key, val]) => val && key !== exclude,
  );
  if (!others.length) return null;
  return (
    <div style={{ marginTop: 2 }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={styles.expandBtn}
      >
        {expanded ? "▾ hide others" : `▸ ${others.length} more`}
      </button>
      {expanded &&
        others.map(([key, val]) => (
          <div key={key} style={{ marginTop: 2, fontSize: 11 }}>
            <span style={styles.locatorType}>{getLocatorLabel(key)}:</span>{" "}
            <code style={styles.locatorCode}>{val}</code>
          </div>
        ))}
    </div>
  );
};

// ── Variables Panel ───────────────────────────────────────────────────────────

const VariablesPanel: React.FC<{
  inputVars: Variable[];
  outputVars: Variable[];
  locatorPref: LocatorPref;
}> = ({ inputVars, outputVars, locatorPref }) => {
  const [varTab, setVarTab] = useState<"all" | "input" | "output">("all");
  const allVars = [...inputVars, ...outputVars];
  const displayVars =
    varTab === "input" ? inputVars : varTab === "output" ? outputVars : allVars;

  if (!allVars.length)
    return <div style={styles.empty}>No variables recorded yet.</div>;

  return (
    <div>
      <div style={styles.varSubTabs}>
        {(["all", "input", "output"] as const).map((t) => {
          const count =
            t === "all"
              ? allVars.length
              : t === "input"
                ? inputVars.length
                : outputVars.length;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setVarTab(t)}
              style={{
                ...styles.varSubTab,
                ...(varTab === t ? styles.varSubTabActive : {}),
              }}
            >
              {t === "all" ? "All" : t === "input" ? "📥 Input" : "📤 Output"}
              <span style={styles.badgeSmall}>{count}</span>
            </button>
          );
        })}
      </div>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Kind</th>
              <th style={styles.th}>Variable Name</th>
              <th style={styles.th}>Data Type</th>
              <th style={styles.th}>Context</th>
              <th style={styles.th}>Value</th>
              <th style={styles.th}>Locator</th>
              <th style={styles.th}>Page</th>
              <th style={styles.th}>Operators</th>
            </tr>
          </thead>
          <tbody>
            {displayVars.map((v, index) => (
              <VariableRow
                key={v.id || index}
                variable={v}
                index={index}
                locatorPref={locatorPref}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Variable Row ──────────────────────────────────────────────────────────────

const VariableRow: React.FC<{
  variable: Variable;
  index: number;
  locatorPref: LocatorPref;
}> = ({ variable: v, index, locatorPref }) => {
  const [showOps, setShowOps] = useState(false);
  const [operators, setOperators] = useState<string[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  const kind = v.kind || "input";
  const name = v.name || `var_${index + 1}`;
  const dataType = v.dataType || "string";
  const dtLabel = DATA_TYPE_LABELS[dataType] || dataType;
  const dtColor = DATA_TYPE_COLORS[dataType] || "#cdd6f4";

  const contextType = resolveContext(v);
  const ctxInfo = CONTEXT_ICONS[contextType] || CONTEXT_ICONS.formField;
  const ctxMeta = getContextMeta(v);

  const selector = normalizeSelector(v);
  const locator = getPreferredLocator(selector, locatorPref);
  const value = v.value ?? "";
  const pageName = resolvePageName(v);

  const fetchOperators = async () => {
    if (operators.length) {
      setShowOps(!showOps);
      return;
    }
    setLoadingOps(true);
    try {
      const token = localStorage.getItem("token") || "";
      const backendUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${backendUrl}/variables/operators/${dataType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setOperators(json?.data?.operators || []);
      setShowOps(true);
    } catch {
      setOperators(["equals", "not_equals"]);
      setShowOps(true);
    } finally {
      setLoadingOps(false);
    }
  };

  // Build context detail text
  let contextDetail: string | null = null;
  if (ctxMeta) {
    if (contextType === "table") {
      const parts: string[] = [];
      if (v.tableColumnHeader || ctxMeta.columnHeader)
        parts.push(`Col: ${v.tableColumnHeader || ctxMeta.columnHeader}`);
      if (v.tableRowIndex != null || ctxMeta.rowIndex != null)
        parts.push(`Row: ${v.tableRowIndex ?? ctxMeta.rowIndex}`);
      contextDetail = parts.join(" · ");
    } else if (ctxMeta.modalTitle) contextDetail = ctxMeta.modalTitle;
    else if (ctxMeta.sidebarTitle) contextDetail = ctxMeta.sidebarTitle;
    else if (ctxMeta.sectionTitle) contextDetail = ctxMeta.sectionTitle;
    else if (ctxMeta.cardTitle) contextDetail = ctxMeta.cardTitle;
    else if (ctxMeta.tabTitle) contextDetail = ctxMeta.tabTitle;
    else if (ctxMeta.formTitle) contextDetail = ctxMeta.formTitle;
    else if (ctxMeta.formName) contextDetail = ctxMeta.formName;
  }

  return (
    <tr style={index % 2 === 0 ? {} : styles.rowAlt}>
      <td style={styles.td}>
        <span
          style={{
            ...styles.kindBadge,
            backgroundColor: kind === "input" ? "#89b4fa20" : "#a6e3a120",
            color: kind === "input" ? "#89b4fa" : "#a6e3a1",
          }}
        >
          {kind === "input" ? "📥 Input" : "📤 Output"}
        </span>
      </td>
      <td style={styles.tdCode}>{name}</td>
      <td style={styles.td}>
        <span
          style={{
            ...styles.dataTypeBadge,
            borderColor: dtColor,
            color: dtColor,
          }}
        >
          {dtLabel}
        </span>
      </td>
      <td style={styles.td}>
        <span
          style={{
            ...styles.contextBadge,
            backgroundColor: ctxInfo.color + "20",
            color: ctxInfo.color,
          }}
        >
          {ctxInfo.icon} {ctxInfo.label}
        </span>
        {contextDetail && (
          <div style={{ fontSize: 10, color: "#6c7086", marginTop: 2 }}>
            {contextDetail}
          </div>
        )}
        {v.enumValues &&
          Array.isArray(v.enumValues) &&
          v.enumValues.length > 0 && (
            <div style={{ fontSize: 10, color: "#6c7086", marginTop: 2 }}>
              Options:{" "}
              {v.enumValues.map((e: any) => e.label || e.value).join(", ")}
            </div>
          )}
      </td>
      <td style={styles.td}>
        {value != null ? String(value) : <span style={styles.muted}>-</span>}
      </td>
      <td style={styles.tdLocators}>
        {locator ? (
          <div>
            <span style={styles.locatorType}>
              {getLocatorLabel(locator.type)}:
            </span>{" "}
            <code style={styles.locatorCode}>{locator.value}</code>
          </div>
        ) : (
          <span style={styles.muted}>-</span>
        )}
        <LocatorDetails selector={selector} exclude={locator?.type} />
      </td>
      <td style={styles.td}>
        <span style={styles.pageLabel} title={v.pageUrl || ""}>
          {pageName}
        </span>
      </td>
      <td style={styles.td}>
        <button
          type="button"
          onClick={fetchOperators}
          style={styles.opsButton}
          disabled={loadingOps}
        >
          {loadingOps ? "…" : showOps ? "Hide" : "Show"}
        </button>
        {showOps && operators.length > 0 && (
          <div style={styles.opsContainer}>
            {operators.map((op) => (
              <span key={op} style={styles.opChip}>
                {op.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
};

// ── Selenium Script ───────────────────────────────────────────────────────────

const SeleniumScriptView: React.FC<{
  steps: Step[];
  locatorPref: LocatorPref;
}> = ({ steps, locatorPref }) => {
  const lines: string[] = [];
  steps.forEach((step, index) => {
    const line = generateSeleniumFromStep(step, locatorPref);
    if (!line) return;
    const action = (step.action || step.type || "step").toString();
    lines.push(
      `// ${index + 1}. ${action}${step.pageName ? ` [${step.pageName}]` : ""}`,
    );
    lines.push(line);
    lines.push("");
  });

  if (!lines.length)
    return <div style={styles.empty}>No Selenium commands available.</div>;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={styles.copyBtn}
        onClick={() => navigator.clipboard.writeText(lines.join("\n"))}
      >
        📋 Copy
      </button>
      <pre style={styles.codeBlock}>{lines.join("\n")}</pre>
    </div>
  );
};

function generateSeleniumFromStep(
  step: Step,
  pref: LocatorPref,
): string | null {
  const selector = normalizeSelector(step);
  const preferred = getPreferredLocator(selector, pref);
  if (!preferred) return null;

  const locator =
    preferred.type === "css"
      ? `By.cssSelector("${escapeForJava(preferred.value)}")`
      : `By.xpath("${escapeForJava(preferred.value)}")`;

  const action = (step.action || step.type || "").toString().toLowerCase();
  const rawValue = step.value;

  if (action === "click") return `driver.findElement(${locator}).click();`;
  if (action === "select" || action === "check")
    return `driver.findElement(${locator}).click();`;
  if (action === "input") {
    const v = rawValue != null ? String(rawValue) : "";
    return `driver.findElement(${locator}).clear();\ndriver.findElement(${locator}).sendKeys("${escapeForJava(v)}");`;
  }
  if (action === "submit") return `driver.findElement(${locator}).submit();`;
  return `// TODO: handle action "${action}"\ndriver.findElement(${locator});`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildElementLabel(
  tag?: string,
  selector?: ReturnType<typeof normalizeSelector>,
): string {
  const t = tag ? tag.toUpperCase() : "";
  const css = selector?.css || "";
  let idPart = "";
  let namePart = "";
  if (css) {
    const idMatch = css.match(/#([^>.\s:\[\]]+)/);
    if (idMatch) idPart = `#${idMatch[1]}`;
    const nameMatch = css.match(/\[name=['"]?([^'"\]]+)['"]?\]/);
    if (nameMatch) namePart = ` [name=${nameMatch[1]}]`;
  }
  const core = (t || "").trim();
  if (!core && !idPart && !namePart) return "-";
  return `${core} ${idPart}${namePart}`.trim();
}

function formatTime(raw: any): string {
  if (!raw) return "-";
  try {
    const d =
      typeof raw === "number" || typeof raw === "bigint"
        ? new Date(Number(raw))
        : new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString();
  } catch {
    return "-";
  }
}

function escapeForJava(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  tabHeader: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #45475a",
    marginBottom: 0,
  },
  tabButton: {
    padding: "8px 14px",
    borderRadius: "6px 6px 0 0",
    border: "1px solid transparent",
    borderBottom: "none",
    background: "transparent",
    color: "#cdd6f4",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  tabButtonActive: { backgroundColor: "#313244", borderColor: "#45475a" },
  badge: {
    backgroundColor: "#45475a",
    color: "#cdd6f4",
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 10,
    fontWeight: 600,
  },
  badgeSmall: {
    backgroundColor: "#45475a",
    color: "#cdd6f4",
    borderRadius: 8,
    padding: "0px 6px",
    fontSize: 10,
    marginLeft: 4,
  },
  locatorBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    backgroundColor: "#1e1e2e",
    borderBottom: "1px solid #45475a",
  },
  locatorLabel: { fontSize: 11, color: "#6c7086", marginRight: 4 },
  locatorChip: {
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 12,
    border: "1px solid #45475a",
    background: "transparent",
    color: "#a6adc8",
    cursor: "pointer",
  },
  locatorChipActive: {
    backgroundColor: "#cba6f720",
    borderColor: "#cba6f7",
    color: "#cba6f7",
  },
  tabBody: { backgroundColor: "#313244", borderRadius: "0 8px 8px 8px" },
  tableWrapper: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #45475a",
    backgroundColor: "#1e1e2e",
    color: "#a6adc8",
    position: "sticky" as const,
    top: 0,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid #45475a",
    verticalAlign: "top" as const,
    color: "#cdd6f4",
  },
  tdLocators: {
    padding: "8px 10px",
    borderBottom: "1px solid #45475a",
    verticalAlign: "top" as const,
    color: "#cdd6f4",
    maxWidth: 300,
  },
  tdCode: {
    padding: "8px 10px",
    borderBottom: "1px solid #45475a",
    fontFamily: "monospace",
    color: "#f9e2af",
    verticalAlign: "top" as const,
  },
  rowAlt: { backgroundColor: "#1e1e2e08" },
  actionBadge: {
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  kindBadge: {
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  dataTypeBadge: {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    border: "1px solid",
  },
  contextBadge: {
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
  },
  locatorType: {
    color: "#6c7086",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  locatorCode: {
    fontSize: 11,
    color: "#94e2d5",
    wordBreak: "break-all" as const,
  },
  expandBtn: {
    background: "none",
    border: "none",
    color: "#6c7086",
    cursor: "pointer",
    fontSize: 10,
    padding: 0,
  },
  muted: { color: "#6c7086" },
  pageLabel: { fontSize: 11, color: "#89dceb", cursor: "help" },
  empty: {
    padding: "20px 12px",
    fontSize: 13,
    color: "#6c7086",
    textAlign: "center" as const,
  },
  codeBlock: {
    padding: 14,
    backgroundColor: "#1e1e2e",
    borderRadius: 6,
    border: "1px solid #45475a",
    fontSize: 11,
    color: "#cdd6f4",
    whiteSpace: "pre-wrap" as const,
    margin: 0,
  },
  copyBtn: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    background: "#45475a",
    border: "none",
    color: "#cdd6f4",
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  },
  video: { width: "100%", borderRadius: 8, backgroundColor: "#000" },
  varSubTabs: {
    display: "flex",
    gap: 4,
    padding: "8px 10px",
    borderBottom: "1px solid #45475a",
  },
  varSubTab: {
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #45475a",
    background: "transparent",
    color: "#a6adc8",
    cursor: "pointer",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  varSubTabActive: {
    backgroundColor: "#cba6f720",
    borderColor: "#cba6f7",
    color: "#cba6f7",
  },
  opsButton: {
    background: "#45475a",
    border: "none",
    color: "#cdd6f4",
    padding: "3px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 10,
  },
  opsContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
    marginTop: 6,
    maxWidth: 200,
  },
  opChip: {
    backgroundColor: "#1e1e2e",
    border: "1px solid #45475a",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 10,
    color: "#a6adc8",
  },
};

export default RecordingDetailsTabs;
