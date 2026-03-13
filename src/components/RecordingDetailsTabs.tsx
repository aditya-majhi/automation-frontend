////typescript
// filepath: d:\AutomationModule\AutomationFrontend\automation-frontend\src\components\RecordingDetailsTabs.tsx
import { useState } from "react";

type Step = {
  type?: string;
  action?: string;
  selector?: { css?: string; xpath?: string };
  value?: any;
  targetTag?: string;
  timestamp?: number | string;
  createdAt?: string;
  // allow any other fields
  [key: string]: any;
};

type Variable = {
  id?: string;
  kind?: "input" | "output" | string;
  name?: string;
  selector?: { css?: string; xpath?: string };
  value?: any;
  targetTag?: string;
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

const RecordingDetailsTabs: React.FC<RecordingDetailsTabsProps> = ({
  recording,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("steps");
  const steps = recording.steps || [];
  const variables = recording.variables || [];

  return (
    <div>
      <div style={styles.tabHeader}>
        {renderTabButton("Steps & Locators", "steps", activeTab, setActiveTab)}
        {renderTabButton("Variables", "variables", activeTab, setActiveTab)}
        {renderTabButton(
          "Selenium Script",
          "selenium",
          activeTab,
          setActiveTab,
        )}
        {recording.videoUrl &&
          renderTabButton("Video", "video", activeTab, setActiveTab)}
      </div>

      <div style={styles.tabBody}>
        {activeTab === "steps" && <StepsTable steps={steps} />}
        {activeTab === "variables" && <VariablesTable variables={variables} />}
        {activeTab === "selenium" && <SeleniumScriptView steps={steps} />}
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
) {
  const isActive = activeTab === key;
  return (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key)}
      style={{
        ...styles.tabButton,
        ...(isActive ? styles.tabButtonActive : {}),
      }}
    >
      {label}
    </button>
  );
}

// ───────────────────────────────── Steps table ────────────────────────────────

const StepsTable: React.FC<{ steps: Step[] }> = ({ steps }) => {
  if (!steps.length) {
    return (
      <div style={styles.empty}>
        No steps recorded yet. Start a recording and interact with the page.
      </div>
    );
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>#</th>
          <th style={styles.th}>Time</th>
          <th style={styles.th}>Action</th>
          <th style={styles.th}>Element</th>
          <th style={styles.th}>Locators</th>
          <th style={styles.th}>Value / Variable</th>
          <th style={styles.th}>Selenium Command</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step, index) => {
          const time = formatTime(step.timestamp ?? step.createdAt);
          const action = (step.action || step.type || "-").toString();
          const selector = step.selector ||
            step.selectors ||
            step.locators || { css: step.css, xpath: step.xpath };

          const css = selector?.css || null;
          const xpath = selector?.xpath || null;

          const elementLabel = buildElementLabel(
            step.targetTag,
            selector as any,
          );

          const value = step.value ?? step.text ?? step.input ?? null;
          const selenium = generateSeleniumFromStep(step);

          return (
            <tr key={index}>
              <td style={styles.td}>{index + 1}</td>
              <td style={styles.td}>{time}</td>
              <td style={styles.td}>{action}</td>
              <td style={styles.td}>{elementLabel}</td>
              <td style={styles.tdLocators}>
                {css && (
                  <div>
                    <strong>css:</strong> {css}
                  </div>
                )}
                {xpath && (
                  <div>
                    <strong>xpath:</strong> {xpath}
                  </div>
                )}
                {!css && !xpath && <span>-</span>}
              </td>
              <td style={styles.td}>{value != null ? String(value) : "-"}</td>
              <td style={styles.tdCode}>{selenium || "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ──────────────────────────────── Variables table ─────────────────────────────

const VariablesTable: React.FC<{ variables: Variable[] }> = ({ variables }) => {
  if (!variables.length) {
    return (
      <div style={styles.empty}>
        No variables recorded yet. Use the context menu to create variables.
      </div>
    );
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Variable Name</th>
          <th style={styles.th}>Value</th>
          <th style={styles.th}>Source Element</th>
          <th style={styles.th}>Stored At</th>
        </tr>
      </thead>
      <tbody>
        {variables.map((v, index) => {
          const name = v.name || v.id || `var_${index + 1}`;
          const value = v.value ?? v.text ?? "";
          const selector = v.selector ||
            v.selectors ||
            v.locators || { css: (v as any).css };
          const css = selector?.css || null;
          const xpath = selector?.xpath || null;
          const elementLabel = buildElementLabel(v.targetTag, selector as any);
          const storedAt = formatTime(v.createdAt);

          return (
            <tr key={index}>
              <td style={styles.tdCode}>{name}</td>
              <td style={styles.td}>{String(value)}</td>
              <td style={styles.tdLocators}>
                {elementLabel && <div>{elementLabel}</div>}
                {css && (
                  <div>
                    <strong>css:</strong> {css}
                  </div>
                )}
                {xpath && (
                  <div>
                    <strong>xpath:</strong> {xpath}
                  </div>
                )}
              </td>
              <td style={styles.td}>{storedAt}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ───────────────────────────── Selenium script generation ─────────────────────

const SeleniumScriptView: React.FC<{ steps: Step[] }> = ({ steps }) => {
  const lines: string[] = [];

  steps.forEach((step, index) => {
    const line = generateSeleniumFromStep(step);
    if (!line) return;
    const comment = `// ${index + 1}. ${(
      step.action ||
      step.type ||
      "step"
    ).toString()}`;
    lines.push(comment);
    lines.push(line);
    lines.push(""); // blank line between commands
  });

  if (!lines.length) {
    return (
      <div style={styles.empty}>
        No Selenium commands available for this recording.
      </div>
    );
  }

  return <pre style={styles.codeBlock}>{lines.join("\n")}</pre>;
};

function generateSeleniumFromStep(step: Step): string | null {
  const selector = step.selector ||
    step.selectors ||
    step.locators || { css: step.css, xpath: step.xpath };

  const css = selector?.css;
  const xpath = selector?.xpath;

  let locator: string | null = null;
  if (css) {
    locator = `By.cssSelector("${escapeForJava(css)}")`;
  } else if (xpath) {
    locator = `By.xpath("${escapeForJava(xpath)}")`;
  }
  if (!locator) return null;

  const action = (step.action || step.type || "").toString().toLowerCase();
  const rawValue = step.value ?? step.text ?? step.input;

  if (action === "click") {
    return `driver.findElement(${locator}).click();`;
  }

  if (action === "input") {
    const v = rawValue != null ? String(rawValue) : "";
    return `driver.findElement(${locator}).sendKeys("${escapeForJava(v)}");`;
  }

  if (action === "submit") {
    return `driver.findElement(${locator}).submit();`;
  }

  // Unknown action – still return a generic findElement so user can customize.
  return (
    `// TODO: handle action "${action}"\n` + `driver.findElement(${locator});`
  );
}

// ─────────────────────────────── helpers ──────────────────────────────────────

function buildElementLabel(
  tag?: string,
  selector?: { css?: string; xpath?: string },
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

// ─────────────────────────────── styles ───────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  tabHeader: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #45475a",
    marginBottom: 10,
  },
  tabButton: {
    padding: "6px 12px",
    borderRadius: "6px 6px 0 0",
    border: "1px solid transparent",
    borderBottom: "none",
    background: "transparent",
    color: "#cdd6f4",
    fontSize: 12,
    cursor: "pointer",
  },
  tabButtonActive: {
    backgroundColor: "#313244",
    borderColor: "#45475a",
  },
  tabBody: {
    backgroundColor: "#313244",
    borderRadius: "0 8px 8px 8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    textAlign: "left",
    padding: "6px 8px",
    borderBottom: "1px solid #45475a",
    backgroundColor: "#fdf3dc",
    color: "#000",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "6px 8px",
    borderBottom: "1px solid #45475a",
    verticalAlign: "top",
    color: "#cdd6f4",
  },
  tdLocators: {
    padding: "6px 8px",
    borderBottom: "1px solid #45475a",
    verticalAlign: "top",
    color: "#cdd6f4",
    whiteSpace: "pre-wrap",
  },
  tdCode: {
    padding: "6px 8px",
    borderBottom: "1px solid #45475a",
    fontFamily: "monospace",
    color: "#f9e2af",
  },
  empty: {
    padding: "12px 8px",
    fontSize: 12,
    color: "#6c7086",
  },
  codeBlock: {
    padding: 10,
    backgroundColor: "#1e1e2e",
    borderRadius: 6,
    border: "1px solid #45475a",
    fontSize: 11,
    color: "#cdd6f4",
    whiteSpace: "pre-wrap",
  },
  video: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#000",
  },
};

export default RecordingDetailsTabs;
