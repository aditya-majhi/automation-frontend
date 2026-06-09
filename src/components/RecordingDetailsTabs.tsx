import { useEffect, useMemo, useState } from "react";

type Step = {
  type?: string;
  stepId?: string;
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
  variableName?: string;
  variableKind?: string;
  variableValue?: any;
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
  selectedValue?: string | null;
  selectedValues?: string[] | null;
  isMultiSelect?: boolean;
  tableRowIndex?: number | null;
  tableColumnIndex?: number | null;
  tableColumnHeader?: string | null;
  pageUrl?: string;
  pageTitle?: string;
  pageName?: string;
  createdAt?: string | number;
  capture?: { text?: string | null; value?: any } | null;
  [key: string]: any;
};

type ActionModel = {
  action:
    | "click"
    | "input"
    | "submit"
    | "hover"
    | "check"
    | "uncheck"
    | "select";
  locatorType: "xpath" | "css";
  locator: string;
  value?: string;
  waitType?: "clickable" | "visible" | "url_or_element";
  targetTag?: string;
  inputType?: string;
  enumValues?: Array<{ value: string; label: string }> | null;
  pageName?: string;
  contextMeta?: any;
  expectsNavigation?: boolean;
};

interface RecordingDetailsTabsProps {
  recording: {
    steps: Step[];
    variables?: Variable[];
    videoUrl?: string | null;
  };
  onPythonScriptGenerated?: (script: string) => void;
  onRuntimePathRequiredChange?: (required: boolean) => void;
  onTabChange?: (tab: TabKey) => void;
}

type TabKey = "steps" | "variables" | "selenium" | "video";
type LocatorPref = "relativeXPath" | "css" | "xpath";
type ScriptLanguage = "python" | "javascript" | "java";

const LOCATOR_OPTIONS: { key: LocatorPref; label: string }[] = [
  { key: "relativeXPath", label: "Relative XPath" },
  { key: "css", label: "CSS" },
  { key: "xpath", label: "XPath" },
];

const LANGUAGE_OPTIONS: { key: ScriptLanguage; label: string }[] = [
  { key: "python", label: "Python (pytest)" },
  { key: "javascript", label: "JavaScript" },
  { key: "java", label: "Java" },
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
  button: { icon: "🔘", label: "Button", color: "#fab387" },
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
  if (typeof obj?.selector === "string") {
    const s = obj.selector.trim();
    return s.startsWith("/") || s.startsWith("(") ? { xpath: s } : { css: s };
  }
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

function isLikelyDynamicToken(value: string): boolean {
  const v = value.toLowerCase();
  return (
    /(^|[-_])(item|row|col|cell|node|react-select|css|ng|ember|vue)([-_]\d+)+$/.test(
      v,
    ) ||
    /^css-[a-z0-9]+$/.test(v) ||
    /^[a-f0-9]{6,}$/.test(v)
  );
}

function hasPositionalPattern(locator: string): boolean {
  return /nth-of-type|position\(\)|\[\d+\]/i.test(locator);
}

function isVeryGenericLocator(type: "xpath" | "css", locator: string): boolean {
  const l = locator.trim().toLowerCase();
  if (type === "xpath") {
    return (
      l === "//a" ||
      l === "(//a)[1]" ||
      l === "//" ||
      l === "//button" ||
      l === "(//button)[1]" ||
      l === "//div" ||
      l === "(//div)[1]" ||
      l === "//*"
    );
  }
  return (
    l === "" ||
    l === "a" ||
    l === "button" ||
    l === "div" ||
    l === "*" ||
    l === "a.router-link"
  );
}

function locatorQuality(type: "xpath" | "css", locator: string): number {
  const l = locator.trim();
  let score = 0;

  if (isVeryGenericLocator(type, l)) score -= 120;
  if (isDiscardableCandidate(type, l)) score -= 60;
  if (hasPositionalPattern(l)) score -= 20;

  if (/data-testid|data-test|data-qa|data-cy/.test(l)) score += 55;
  if (/aria-label|@aria-label/.test(l)) score += 35;
  if (type === "css" && /#[-\w]+/.test(l)) score += 30;
  if (type === "xpath" && /@id=/.test(l)) score += 30;
  if (type === "css" && /\[name=/.test(l)) score += 20;
  if (type === "xpath" && /@name=/.test(l)) score += 20;
  if (/href|@href/.test(l)) score += 18;
  if (type === "xpath" && /normalize-space\(\)=/.test(l)) score += 12;
  if (
    type === "xpath" &&
    /normalize-space\(@class\)/.test(l) &&
    !/@id=|@name=|data-testid|data-test|data-qa|normalize-space\(\)=/.test(l)
  ) {
    score -= 35;
  }
  if (type === "xpath" && /normalize-space\(\)\s*=/.test(l)) score += 35;

  if (l.length > 8 && l.length < 180) score += 6;
  return score;
}

function escapeXPathLiteral(text: string): string {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return `concat('${text.replace(/'/g, `', "'", '`)}')`;
}

function getClickTextHints(step: Step): string[] {
  const raw = [
    step.buttonValue != null ? String(step.buttonValue) : "",
    step.fieldName != null ? String(step.fieldName) : "",
    step.contextMeta?.label != null ? String(step.contextMeta.label) : "",
    step.contextMeta?.text != null ? String(step.contextMeta.text) : "",
    step.text != null ? String(step.text) : "",
  ];

  return Array.from(
    new Set(
      raw
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && x.length < 120)
        .filter(
          (x) => !/^(home|homepage|page|form|forms|menu|section)$/i.test(x),
        ),
    ),
  );
}

function buildTextClickCandidates(
  step: Step,
): Array<{ locatorType: "xpath"; locator: string }> {
  const texts = getClickTextHints(step);
  const candidates: Array<{ locatorType: "xpath"; locator: string }> = [];

  for (const text of texts) {
    const escaped = escapeXPathLiteral(text);

    candidates.push({
      locatorType: "xpath",
      locator: `//a[normalize-space()=${escaped}] | //button[normalize-space()=${escaped}]`,
    });

    candidates.push({
      locatorType: "xpath",
      locator:
        `//a[contains(normalize-space(), ${escaped})] | ` +
        `//button[contains(normalize-space(), ${escaped})] | ` +
        `//*[@role='button' and contains(normalize-space(), ${escaped})]`,
    });
  }

  return candidates;
}

function buildIdAnchoredTextCandidates(
  step: Step,
): Array<{ locatorType: "xpath"; locator: string }> {
  const s = normalizeSelector(step);

  const rel = sanitizePythonXPath(s?.relativeXPath || undefined);
  const xp = sanitizePythonXPath(s?.xpath || undefined);
  const css = s?.css?.trim();

  const idToken =
    (rel ? extractIdFromLocator("xpath", rel) : null) ||
    (xp ? extractIdFromLocator("xpath", xp) : null) ||
    (css ? extractIdFromLocator("css", css) : null);

  if (!idToken) return [];

  const idLit = escapeXPathLiteral(idToken);
  const texts = getClickTextHints(step);
  const out: Array<{ locatorType: "xpath"; locator: string }> = [];

  for (const text of texts) {
    const tx = escapeXPathLiteral(text);

    out.push({
      locatorType: "xpath",
      locator:
        "//*[@id=" +
        idLit +
        "]//*[self::a or self::button or @role='button'][normalize-space()=" +
        tx +
        "]",
    });

    out.push({
      locatorType: "xpath",
      locator:
        "//*[@id=" +
        idLit +
        "]//*[self::a or self::button or @role='button'][contains(normalize-space(), " +
        tx +
        ")]",
    });

    out.push({
      locatorType: "xpath",
      locator:
        "//*[self::a or self::button or @role='button'][@id=" +
        idLit +
        " and normalize-space()=" +
        tx +
        "]",
    });
  }

  return out;
}

function isDiscardableCandidate(
  type: "xpath" | "css",
  locator: string,
): boolean {
  const l = locator.trim().toLowerCase();

  if (isVeryGenericLocator(type, l)) return true;

  if (
    hasPositionalPattern(l) &&
    !/@id=|#|data-testid|data-test|data-qa|@name=|\[name=/.test(l)
  ) {
    return true;
  }

  if (/router-link|css-\w+|ng-\w+|ember-\w+/.test(l)) return true;

  // Do not hard-discard dynamic-looking ids globally.
  // They may still be the only usable anchor on some sites.
  return false;
}

function prefOrder(pref: LocatorPref): Array<"xpath" | "css"> {
  if (pref === "css") return ["css", "xpath"];
  return ["xpath", "css"];
}

function prefRank(locatorType: "xpath" | "css", pref: LocatorPref): number {
  const order = prefOrder(pref);
  const idx = order.indexOf(locatorType);
  return idx === -1 ? 99 : idx;
}

function mapRecorderKindToLocatorType(
  kind: string,
): { locatorType: "xpath" | "css"; normalizedKind: LocatorPref } | null {
  const k = String(kind || "").toLowerCase();
  if (k === "css") return { locatorType: "css", normalizedKind: "css" };
  if (k === "relativexpath")
    return { locatorType: "xpath", normalizedKind: "relativeXPath" };
  if (k === "xpath") return { locatorType: "xpath", normalizedKind: "xpath" };
  return null;
}

function getRecorderLocatorCandidates(
  step: Step,
  pref: LocatorPref,
): Array<{
  locatorType: "xpath" | "css";
  locator: string;
  confidence: number;
}> {
  const raw =
    (Array.isArray(step?.selectorCandidates)
      ? step.selectorCandidates
      : null) ||
    (Array.isArray(step?.contextMeta?.selectorCandidates)
      ? step.contextMeta.selectorCandidates
      : null) ||
    (Array.isArray(step?.context?.selectorCandidates)
      ? step.context.selectorCandidates
      : null) ||
    [];

  const mapped = raw
    .map((c: any) => {
      const mappedKind = mapRecorderKindToLocatorType(c?.kind);
      if (!mappedKind) return null;
      const rawValue = String(c?.value || "").trim();
      if (!rawValue) return null;

      const locator =
        mappedKind.locatorType === "xpath"
          ? sanitizePythonXPath(rawValue) || ""
          : rawValue;

      if (!locator) return null;

      return {
        locatorType: mappedKind.locatorType,
        locator,
        confidence: Number(c?.confidence ?? 0),
        kind: mappedKind.normalizedKind,
      };
    })
    .filter(Boolean) as Array<{
    locatorType: "xpath" | "css";
    locator: string;
    confidence: number;
    kind: LocatorPref;
  }>;

  const dedup = Array.from(
    new Map(mapped.map((m) => [`${m.locatorType}:${m.locator}`, m])).values(),
  );

  return dedup
    .filter((c) => !isDiscardableCandidate(c.locatorType, c.locator))
    .sort((a, b) => {
      const aRank = a.kind === pref ? 0 : 1;
      const bRank = b.kind === pref ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return 0;
    });
}

function getLocatorCandidates(
  step: Step,
  pref: LocatorPref = "relativeXPath",
): Array<{ locatorType: "xpath" | "css"; locator: string }> {
  const s = normalizeSelector(step);
  const raw: Array<{ locatorType: "xpath" | "css"; locator: string }> = [];

  // 1) Include recorder candidates, but do NOT return early.
  const recorder = getRecorderLocatorCandidates(step, pref);
  raw.push(
    ...recorder.map((r) => ({
      locatorType: r.locatorType,
      locator: r.locator,
    })),
  );

  // 2) Include direct selector fields.
  const rel = sanitizePythonXPath(s?.relativeXPath || undefined);
  const xp = sanitizePythonXPath(s?.xpath || undefined);
  const css = s?.css?.trim();

  if (rel) raw.push({ locatorType: "xpath", locator: rel });
  if (xp && xp !== rel) raw.push({ locatorType: "xpath", locator: xp });
  if (css) raw.push({ locatorType: "css", locator: css });

  // 3) Include text candidates for click/submit/select.
  const action = (step.action || step.type || "").toLowerCase();
  if (action === "click" || action === "submit" || action === "select") {
    raw.push(...buildTextClickCandidates(step));
    raw.push(...buildIdAnchoredTextCandidates(step));
  }

  const dedupRaw = Array.from(
    new Map(raw.map((r) => [r.locatorType + ":" + r.locator, r])).values(),
  );

  const filtered = dedupRaw.filter(
    (c) => !isDiscardableCandidate(c.locatorType, c.locator),
  );

  const pool = filtered.length > 0 ? filtered : dedupRaw;

  return pool.sort((a, b) => {
    const rankDiff =
      prefRank(a.locatorType, pref) - prefRank(b.locatorType, pref);
    if (rankDiff !== 0) return rankDiff;

    return (
      locatorQuality(b.locatorType, b.locator) -
      locatorQuality(a.locatorType, a.locator)
    );
  });
}

function getBestXPathLocatorForModel(
  step: Step,
  pref: LocatorPref = "relativeXPath",
): { locatorType: "xpath"; locator: string } | null {
  const ranked = getLocatorCandidates(step, pref);
  const xpathOnly = ranked.filter((c) => c.locatorType === "xpath");

  if (!xpathOnly.length) return null;

  // Quality floor to avoid brittle selectors in single-selector mode.
  const best = xpathOnly[0];
  const score = locatorQuality("xpath", best.locator);
  if (score < -10) return null;

  return { locatorType: "xpath", locator: best.locator };
}

function getLocatorForModel(
  step: Step,
  pref: LocatorPref = "relativeXPath",
): { locatorType: "xpath" | "css"; locator: string } | null {
  const candidates = getLocatorCandidates(step, pref);
  return candidates.length ? candidates[0] : null;
}

function shouldSkipDuplicateStoreVariableStep(
  step: Step,
  index: number,
  steps: Step[],
): boolean {
  const action = (step.action || step.type || "").toLowerCase();
  if (action !== "store_variable" || index === 0) return false;

  const prev = steps[index - 1];
  const prevAction = (prev?.action || prev?.type || "").toLowerCase();

  // Only dedupe store_variable against another store_variable
  if (prevAction !== "store_variable") return false;

  const prevKey = getStepLocatorKey(prev);
  const curKey = getStepLocatorKey(step);
  if (!prevKey || !curKey || prevKey !== curKey) return false;

  const prevVar = String(
    prev?.variableName ?? prev?.contextMeta?.variableName ?? "",
  ).trim();

  const curVar = String(
    step?.variableName ?? step?.contextMeta?.variableName ?? "",
  ).trim();
  if (prevVar && curVar) return prevVar === curVar;

  const prevVal = String(prev?.variableValue ?? prev?.value ?? "").trim();
  const curVal = String(step?.variableValue ?? step?.value ?? "").trim();
  if (prevVal && curVal) return prevVal === curVal;

  return false;
}

function extractIdFromLocator(
  locatorType: "xpath" | "css",
  locator: string,
): string | null {
  if (locatorType === "css") {
    const m = locator.match(/#([A-Za-z0-9\-_]+)/);
    return m?.[1] || null;
  }
  const m1 = locator.match(/@id\s*=\s*['"]([^'"]+)['"]/);
  if (m1?.[1]) return m1[1];
  const m2 = locator.match(/id\(['"]([^'"]+)['"]\)/);
  return m2?.[1] || null;
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

// ── Capture resolution ────────────────────────────────────────────────────────

function getCapture(v: Variable): { text?: string | null; value?: any } | null {
  if (v.capture) return v.capture;
  const meta = getContextMeta(v);
  if (meta?.capture) return meta.capture;
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

const RecordingDetailsTabs: React.FC<RecordingDetailsTabsProps> = ({
  recording,
  onPythonScriptGenerated,
  onTabChange,
  onRuntimePathRequiredChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("steps");
  const [locatorPref, setLocatorPref] = useState<LocatorPref>("relativeXPath");
  const [scriptLang, setScriptLang] = useState<ScriptLanguage>("python");
  const [runtimePaths, setRuntimePaths] = useState<Record<string, string>>({});

  const steps = recording.steps || [];
  const variables = recording.variables || [];
  const inputVars = variables.filter((v) => v.kind === "input");
  const outputVars = variables.filter((v) => v.kind === "output");
  const buttonVars = variables.filter((v) => v.kind === "button");

  const stepsWithRuntimePaths = useMemo(
    () =>
      steps.map((step, index) => {
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

        if (!isFileStep) return step;

        const runtimePath =
          runtimePaths[stepKey] ??
          step.contextMeta?.runtimePath ??
          step.context?.runtimePath ??
          "";

        if (!runtimePath) return step;

        return {
          ...step,
          value: runtimePath,
          contextMeta: {
            ...(step.contextMeta || {}),
            runtimePath,
          },
        };
      }),
    [steps, runtimePaths],
  );

  const hasPendingRuntimePath = useMemo(() => {
    return (steps || []).some((step, index) => {
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
        runtimePaths[stepKey] ??
        step.contextMeta?.runtimePath ??
        step.context?.runtimePath ??
        "";

      return !String(runtimePath).trim();
    });
  }, [steps, runtimePaths]);

  useEffect(() => {
    onRuntimePathRequiredChange?.(hasPendingRuntimePath);
  }, [hasPendingRuntimePath, onRuntimePathRequiredChange]);

  const pythonBaseScript = useMemo(
    () =>
      generateFullPythonScriptWithVariables(
        stepsWithRuntimePaths,
        variables,
        locatorPref,
      ),
    [stepsWithRuntimePaths, variables, locatorPref],
  );

  useEffect(() => {
    if (onPythonScriptGenerated) {
      onPythonScriptGenerated(pythonBaseScript || "");
    }
  }, [pythonBaseScript, onPythonScriptGenerated]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

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
          {activeTab === "selenium" && (
            <>
              <span style={{ ...styles.locatorLabel, marginLeft: 16 }}>
                Language:
              </span>
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setScriptLang(opt.key)}
                  style={{
                    ...styles.locatorChip,
                    ...(scriptLang === opt.key ? styles.langChipActive : {}),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <div style={styles.tabBody}>
        {activeTab === "steps" && (
          <StepsTable
            steps={steps}
            locatorPref={locatorPref}
            runtimePaths={runtimePaths}
            onRuntimePathChange={(index, path) =>
              setRuntimePaths((prev) => ({ ...prev, [index]: path }))
            }
          />
        )}

        {activeTab === "variables" && (
          <VariablesPanel
            variables={variables}
            inputVars={inputVars}
            outputVars={outputVars}
            buttonVars={buttonVars}
            locatorPref={locatorPref}
          />
        )}

        {activeTab === "selenium" && (
          <SeleniumScriptView
            steps={stepsWithRuntimePaths}
            variables={variables}
            locatorPref={locatorPref}
            language={scriptLang}
          />
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

const StepsTable: React.FC<{
  steps: Step[];
  locatorPref: LocatorPref;
  runtimePaths: Record<string, string>;
  onRuntimePathChange: (stepKey: string, path: string) => void;
}> = ({ steps, locatorPref, runtimePaths, onRuntimePathChange }) => {
  const [editingPaths, setEditingPaths] = useState<Record<string, boolean>>({});
  const [draftPaths, setDraftPaths] = useState<Record<string, string>>({});
  const [savingPaths, setSavingPaths] = useState<Record<string, boolean>>({});

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
            const selenium = generateStepSeleniumPreview(step, locatorPref);
            const actionLower = (step.action || step.type || "").toLowerCase();
            const pageName =
              actionLower === "store_variable" ? resolvePageName(step) : "-";
            const value =
              step.value ?? step.variableValue ?? step.buttonValue ?? null;
            const stepKey = step.stepId || String(index);

            const isFileStep = (() => {
              const t = (step.targetTag || "").toLowerCase();
              const inType = (
                step.inputType ||
                step.contextMeta?.inputType ||
                step.context?.inputType ||
                ""
              ).toLowerCase();

              return (
                step.contextMeta?.requiresRuntimePath === true ||
                step.context?.requiresRuntimePath === true ||
                inType === "file" ||
                (t === "input" && inType === "file")
              );
            })();

            const existingRuntimePath =
              step.contextMeta?.runtimePath ?? step.context?.runtimePath ?? "";
            const contextType = resolveContext(step);
            const ctxInfo =
              CONTEXT_ICONS[contextType] || CONTEXT_ICONS.formField;
            const actionStyle = ACTION_STYLES[action] || {
              bg: "#45475a20",
              fg: "#a6adc8",
            };

            return (
              <tr key={stepKey} style={index % 2 === 0 ? {} : styles.rowAlt}>
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
                    <span style={{ opacity: isFileStep ? 0.5 : 1 }}>
                      {String(value)}
                    </span>
                  ) : (
                    <span style={styles.muted}>-</span>
                  )}

                  {isFileStep &&
                    (() => {
                      const savedPath =
                        runtimePaths[stepKey] ?? existingRuntimePath;
                      const originalName =
                        step.contextMeta?.originalFileName ||
                        (step.value
                          ? String(step.value).split(/[/\\]/).pop()
                          : null) ||
                        "file";
                      const isEditing = editingPaths[stepKey] ?? false;

                      const handleSave = async () => {
                        const path = draftPaths[stepKey] ?? savedPath;
                        setSavingPaths((p) => ({ ...p, [stepKey]: true }));
                        try {
                          if (step.stepId) {
                            const api = (await import("../api/axios")).default;
                            await api.patch(
                              "/recordings/step/" +
                                step.stepId +
                                "/runtime-path",
                              { runtimePath: path },
                            );
                          }
                          onRuntimePathChange(stepKey, path);
                          setEditingPaths((p) => ({ ...p, [stepKey]: false }));
                        } catch {
                          // keep editing open on failure
                        } finally {
                          setSavingPaths((p) => ({ ...p, [stepKey]: false }));
                        }
                      };

                      return (
                        <div style={{ marginTop: 6 }}>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#f9e2af",
                              marginBottom: 4,
                            }}
                          >
                            📁 Runtime file path:
                          </div>

                          {!isEditing ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <code
                                style={{
                                  fontSize: 11,
                                  color: savedPath ? "#a6e3a1" : "#6c7086",
                                  fontFamily: "monospace",
                                  flex: 1,
                                  wordBreak: "break-all",
                                }}
                              >
                                {savedPath || originalName}
                              </code>
                              <button
                                type="button"
                                title="Edit runtime path"
                                onClick={() => {
                                  setDraftPaths((p) => ({
                                    ...p,
                                    [stepKey]: savedPath,
                                  }));
                                  setEditingPaths((p) => ({
                                    ...p,
                                    [stepKey]: true,
                                  }));
                                }}
                                style={{
                                  background: "none",
                                  border: "1px solid #45475a",
                                  borderRadius: 4,
                                  color: "#a6adc8",
                                  cursor: "pointer",
                                  fontSize: 11,
                                  padding: "2px 6px",
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                type="text"
                                value={draftPaths[stepKey] ?? savedPath}
                                onChange={(e) =>
                                  setDraftPaths((p) => ({
                                    ...p,
                                    [stepKey]: e.target.value,
                                  }))
                                }
                                placeholder="C:/path/to/file.ext"
                                style={{
                                  flex: 1,
                                  minWidth: 160,
                                  fontSize: 11,
                                  padding: "4px 6px",
                                  borderRadius: 4,
                                  border: "1px solid #45475a",
                                  background: "#1e1e2e",
                                  color: "#cdd6f4",
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleSave}
                                disabled={savingPaths[stepKey]}
                                style={{
                                  background: "#a6e3a1",
                                  border: "none",
                                  borderRadius: 4,
                                  color: "#1e1e2e",
                                  cursor: "pointer",
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  opacity: savingPaths[stepKey] ? 0.7 : 1,
                                }}
                              >
                                {savingPaths[stepKey] ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingPaths((p) => ({
                                    ...p,
                                    [stepKey]: false,
                                  }))
                                }
                                style={{
                                  background: "none",
                                  border: "1px solid #45475a",
                                  borderRadius: 4,
                                  color: "#a6adc8",
                                  cursor: "pointer",
                                  fontSize: 11,
                                  padding: "2px 8px",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
  variables: Variable[];
  inputVars: Variable[];
  outputVars: Variable[];
  buttonVars: Variable[];
  locatorPref: LocatorPref;
}> = ({ variables, inputVars, outputVars, buttonVars, locatorPref }) => {
  const [varTab, setVarTab] = useState<"all" | "input" | "output" | "button">(
    "all",
  );
  // const allVars = [...inputVars, ...outputVars, ...buttonVars];
  const displayVars =
    varTab === "input"
      ? inputVars
      : varTab === "output"
        ? outputVars
        : varTab === "button"
          ? buttonVars
          : variables;

  if (!variables.length)
    return <div style={styles.empty}>No variables recorded yet.</div>;

  return (
    <div>
      <div style={styles.varSubTabs}>
        {(["all", "input", "output", "button"] as const).map((t) => {
          const count =
            t === "all"
              ? variables.length
              : t === "input"
                ? inputVars.length
                : t === "output"
                  ? outputVars.length
                  : buttonVars.length;
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
              {t === "all"
                ? "All"
                : t === "input"
                  ? "📥 Input"
                  : t === "output"
                    ? "📤 Output"
                    : "🔘 Button"}
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
              <th style={styles.th}>Value / Capture</th>
              <th style={styles.th}>Locator</th>
              <th style={styles.th}>Page</th>
              <th style={styles.th}>Actions</th>
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
  const [copied, setCopied] = useState(false);

  const kind = v.kind || "input";
  const name = v.name || `var_${index + 1}`;
  const dataType = v.dataType || "string";
  const dtLabel = DATA_TYPE_LABELS[dataType] || dataType;
  const dtColor = DATA_TYPE_COLORS[dataType] || "#cdd6f4";

  const contextType = resolveContext(v);
  const ctxInfo = CONTEXT_ICONS[contextType] || CONTEXT_ICONS.formField;
  const ctxMeta = getContextMeta(v);
  const capture = getCapture(v);
  const displayValue =
    Array.isArray(v.selectedValues) && v.selectedValues.length
      ? v.selectedValues.join(", ")
      : (v.selectedValue ?? capture?.value ?? v.value ?? "");

  const selector = normalizeSelector(v);
  const locator = getPreferredLocator(selector, locatorPref);
  const pageName = resolvePageName(v);
  const value =
    v.value !== null && v.value !== undefined && String(v.value) !== ""
      ? v.value
      : (capture?.value ?? "");

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

  const copyVarRef = () => {
    const ref = `\${${name}}`;
    navigator.clipboard.writeText(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
            backgroundColor:
              kind === "input"
                ? "#89b4fa20"
                : kind === "output"
                  ? "#a6e3a120"
                  : "#f5c2e720",
            color:
              kind === "input"
                ? "#89b4fa"
                : kind === "output"
                  ? "#a6e3a1"
                  : "#f5c2e7",
          }}
        >
          {kind === "input"
            ? "📥 Input"
            : kind === "output"
              ? "📤 Output"
              : "🔘 Button"}
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
        {v.enumValues && Array.isArray(v.enumValues) ? (
          <div style={{ marginTop: 8, fontSize: 11, color: "#a6adc8" }}>
            <strong>Selected:</strong>{" "}
            {Array.isArray(v.selectedValues) && v.selectedValues.length
              ? v.selectedValues.join(", ")
              : v.selectedValue || "(none)"}
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: "#6c7086",
                maxHeight: 80,
                overflow: "auto",
              }}
            >
              <em>Options:</em> {v.enumValues.map((e) => e.label).join(", ")}
            </div>
          </div>
        ) : null}
      </td>
      <td style={styles.td}>
        <td style={styles.td}>
          {displayValue != null && String(displayValue) !== "" ? (
            <div>{String(displayValue)}</div>
          ) : (
            <span style={{ color: "#6c7086" }}>—</span>
          )}
        </td>
        {capture && (capture.text || capture.value != null) && (
          <div style={styles.captureBlock}>
            {capture.text && (
              <div style={styles.captureRow}>
                <span style={styles.captureLabel}>text:</span>{" "}
                <span style={styles.captureValue}>
                  {capture.text.length > 60
                    ? capture.text.slice(0, 60) + "…"
                    : capture.text}
                </span>
              </div>
            )}
            {capture.value != null && (
              <div style={styles.captureRow}>
                <span style={styles.captureLabel}>value:</span>{" "}
                <span style={styles.captureValue}>{String(capture.value)}</span>
              </div>
            )}
          </div>
        )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            onClick={copyVarRef}
            style={styles.opsButton}
            title={`Copy \${${name}}`}
          >
            {copied ? "Copied!" : "Copy ${}"}
          </button>
          <button
            type="button"
            onClick={fetchOperators}
            style={styles.opsButton}
            disabled={loadingOps}
          >
            {loadingOps ? "…" : showOps ? "Hide Ops" : "Operators"}
          </button>
        </div>
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

// ── Selenium Script View (Multi-Language) ─────────────────────────────────────

const SeleniumScriptView: React.FC<{
  steps: Step[];
  variables: Variable[]; // ADD THIS
  locatorPref: LocatorPref;
  language: ScriptLanguage;
}> = ({ steps, variables, locatorPref, language }) => {
  let script = "";
  if (language === "python") {
    script = generateFullPythonScriptWithVariables(
      steps,
      variables,
      locatorPref,
    );
  } else if (language === "javascript") {
    script = generateFullJavaScriptScriptWithVariables(
      steps,
      variables,
      locatorPref,
    );
  } else {
    script = generateFullJavaWithVariables(steps, variables, locatorPref);
  }

  if (!script.trim())
    return <div style={styles.empty}>No script generated</div>;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={styles.copyBtn}
        onClick={() => navigator.clipboard.writeText(script)}
      >
        📋 Copy
      </button>
      <pre style={styles.codeBlock}>{script}</pre>
    </div>
  );
};

function isLikelyNavigationStep(step: Step): boolean {
  const action = (step.action || step.type || "").toLowerCase();
  const tag = (step.targetTag || "").toLowerCase();
  if (action === "submit") return true;
  if (action === "click" && tag === "a") return true;
  if (step.contextMeta?.navigation === true) return true;
  return false;
}

function isNativeSelectStep(step: Step): boolean {
  const tag = (step.targetTag || "").toLowerCase();
  if (tag === "select") return true;
  if (step.inputType === "select-one" || step.inputType === "select-multiple")
    return true;
  return false;
}

function compressConsecutiveInputSteps(steps: Step[]): Step[] {
  const out: Step[] = [];
  for (const step of steps) {
    const action = (step.action || step.type || "").toLowerCase();
    if (action !== "input") {
      out.push(step);
      continue;
    }

    const prev = out[out.length - 1];
    if (!prev) {
      out.push(step);
      continue;
    }

    const prevAction = (prev.action || prev.type || "").toLowerCase();
    if (prevAction !== "input") {
      out.push(step);
      continue;
    }

    const prevKey = getStepLocatorKey(prev);
    const curKey = getStepLocatorKey(step);
    const prevVal = String(prev.value ?? "");
    const curVal = String(step.value ?? "");

    // Remove only duplicate consecutive values on same locator.
    if (prevKey && curKey && prevKey === curKey && prevVal === curVal) {
      continue;
    }

    out.push(step);
  }
  return out;
}

function toActionModel(
  step: Step,
  pref: LocatorPref = "relativeXPath",
): ActionModel | null {
  const loc = getLocatorForModel(step, pref);
  if (!loc) return null;

  const action = (step.action || step.type || "").toLowerCase();
  const value = step.value != null ? String(step.value) : undefined;

  if (
    action !== "click" &&
    action !== "input" &&
    action !== "submit" &&
    action !== "hover" &&
    action !== "check" &&
    action !== "select" &&
    action !== "store_variable"
  ) {
    return null;
  }

  // Map store_variable to input-like model action for extraction phase, not interaction.
  const mappedAction: ActionModel["action"] =
    action === "store_variable" ? "input" : (action as ActionModel["action"]);

  const waitType: ActionModel["waitType"] =
    mappedAction === "input"
      ? "visible"
      : mappedAction === "click" ||
          mappedAction === "check" ||
          mappedAction === "select" ||
          mappedAction === "submit"
        ? "clickable"
        : "visible";

  return {
    action: mappedAction,
    locatorType: loc.locatorType,
    locator: loc.locator,
    value,
    waitType,
    targetTag: step.targetTag,
    inputType: step.inputType,
    enumValues: step.enumValues || null,
    pageName: step.pageName,
    contextMeta: step.contextMeta,
    expectsNavigation: isLikelyNavigationStep(step),
  };
}

// ── Python (pytest) Generator ─────────────────────────────────────────────────

function sanitizePythonXPath(raw?: string): string | null {
  if (!raw) return null;
  let x = raw.trim();
  if (x.startsWith("///*")) x = x.replace(/^\/\/\*/, "//*");
  if (x.startsWith("///")) x = x.replace(/^\/\/\//, "//");
  return x;
}

function pythonVarKey(step: Step, index: number): string {
  const tag = (step.targetTag || "el").toLowerCase();
  const page = (step.pageName || "page").replace(/[^a-zA-Z0-9]+/g, "_");
  const val = String(step.buttonValue ?? step.value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = val ? `${tag}_${val}` : `${tag}_${index + 1}`;
  return `${base}_${page}`.slice(0, 60);
}

function getPythonXPath(step: Step): string | null {
  const s = normalizeSelector(step);
  return sanitizePythonXPath(s?.relativeXPath || s?.xpath || null);
}

// ── Helper: Variable Matching Logic ───────────────────────────────────────────

function normalize(str?: string | null) {
  return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function pickSelector(obj: any) {
  return (
    obj?.selector?.relativeXPath ||
    obj?.selector?.xpath ||
    obj?.selector?.css ||
    obj?.selectorRelativeXpath ||
    obj?.selectorXpath ||
    obj?.selectorCss ||
    ""
  );
}

/**
 * Find user-named variable matching step by selector + pageName
 */
function findNamedVariable(
  step: Step,
  variables: Variable[],
): Variable | undefined {
  const stepSel = normalize(pickSelector(step));
  const stepPage = normalize(step.pageName || step.pageUrl);

  return variables.find((v) => {
    if (!v.name) return false;
    const varSel = normalize(pickSelector(v));
    const varPage = normalize(v.pageName || v.pageUrl);
    const selectorMatch = stepSel && varSel && stepSel === varSel;
    const pageMatch = !stepPage || !varPage || stepPage === varPage;
    return selectorMatch && pageMatch;
  });
}

function getStepLocatorKey(step?: Step): string {
  if (!step) return "";
  const s = normalizeSelector(step);
  return s?.relativeXPath || s?.xpath || s?.css || "";
}

function inferUrlFragment(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/^\d+$/.test(p));
    if (!parts.length) return null;
    return parts[parts.length - 1].toLowerCase();
  } catch {
    return null;
  }
}

function buildPageContextVisibilityCandidates(
  step: Step,
): Array<{ locatorType: "xpath" | "css"; locator: string }> {
  const s = normalizeSelector(step);
  const raw: Array<{ locatorType: "xpath" | "css"; locator: string }> = [];

  const rel = sanitizePythonXPath(s?.relativeXPath || undefined);
  const xp = sanitizePythonXPath(s?.xpath || undefined);
  const css = s?.css?.trim();

  if (css) raw.push({ locatorType: "css", locator: css });
  if (rel) raw.push({ locatorType: "xpath", locator: rel });
  if (xp && xp !== rel) raw.push({ locatorType: "xpath", locator: xp });

  const fieldName = (step.fieldName || "").trim();
  if (fieldName) {
    const lbl = escapeXPathLiteral(fieldName);
    raw.push({
      locatorType: "xpath",
      locator:
        `//label[contains(normalize-space(), ${lbl})]` +
        `/following::input[1] | //label[contains(normalize-space(), ${lbl})]/following::textarea[1]`,
    });
  }

  const dedup = Array.from(
    new Map(raw.map((r) => [`${r.locatorType}:${r.locator}`, r])).values(),
  );

  return dedup
    .filter((c) => !isDiscardableCandidate(c.locatorType, c.locator))
    .sort(
      (a, b) =>
        locatorQuality(b.locatorType, b.locator) -
        locatorQuality(a.locatorType, a.locator),
    )
    .slice(0, 5);
}

function toPyCandidateLiteral(
  candidates: Array<{ locatorType: "xpath" | "css"; locator: string }>,
): string {
  return `[${candidates
    .map((c) => `("${c.locatorType}", "${escapePy(c.locator)}")`)
    .join(", ")}]`;
}

function buildNextStepVisibilityCandidates(
  step?: Step,
): Array<{ locatorType: "xpath" | "css"; locator: string }> {
  if (!step) return [];

  const raw: Array<{ locatorType: "xpath" | "css"; locator: string }> = [];

  // Include full ranked candidates from the normal locator strategy.
  const ranked = getLocatorCandidates(step);
  raw.push(...ranked.slice(0, 6));

  // Include direct selector fields as backup.
  const s = normalizeSelector(step);
  const rel = sanitizePythonXPath(s?.relativeXPath || undefined);
  const xp = sanitizePythonXPath(s?.xpath || undefined);
  const css = s?.css?.trim();

  if (css) raw.push({ locatorType: "css", locator: css });
  if (rel) raw.push({ locatorType: "xpath", locator: rel });
  if (xp && xp !== rel) raw.push({ locatorType: "xpath", locator: xp });

  // Include label-based fallback when available.
  const fieldName = (step.fieldName || "").trim();
  if (fieldName) {
    const lbl = escapeXPathLiteral(fieldName);
    raw.push({
      locatorType: "xpath",
      locator:
        `//label[contains(normalize-space(), ${lbl})]/following::input[1] | ` +
        `//label[contains(normalize-space(), ${lbl})]/following::textarea[1] | ` +
        `//label[contains(normalize-space(), ${lbl})]/following::select[1]`,
    });
  }

  const dedup = Array.from(
    new Map(raw.map((r) => [`${r.locatorType}:${r.locator}`, r])).values(),
  );

  return dedup
    .filter((c) => !isDiscardableCandidate(c.locatorType, c.locator))
    .sort(
      (a, b) =>
        locatorQuality(b.locatorType, b.locator) -
        locatorQuality(a.locatorType, a.locator),
    )
    .slice(0, 8);
}

// ── PYTHON GENERATOR ──────────────────────────────────────────────────────────

function generateFullPythonScriptWithVariables(
  rawSteps: Step[],
  variables: Variable[],
  pref: LocatorPref = "relativeXPath",
): string {
  if (!rawSteps.length) return "";

  const steps = rawSteps;
  const pageUrl = steps[0]?.pageUrl || "https://example.com";

  const lines: string[] = [
    "# Generated by Automation Recorder",
    "import pytest",
    "from selenium import webdriver",
    "from selenium.webdriver.common.by import By",
    "from selenium.webdriver.common.action_chains import ActionChains",
    "from selenium.webdriver.support.ui import WebDriverWait, Select",
    "from selenium.webdriver.support import expected_conditions as EC",
    "from selenium.webdriver.firefox.service import Service",
    "from selenium.webdriver.firefox.options import Options as FirefoxOptions",
    "from webdriver_manager.firefox import GeckoDriverManager",
    "",
    "class TestRecording():",
    "  def setup_method(self, method):",
    "    options = FirefoxOptions()",
    "    options.add_argument('--headless')",
    "    options.add_argument('--width=1366')",
    "    options.add_argument('--height=768')",
    "    service = Service(GeckoDriverManager().install())",
    "    self.driver = webdriver.Firefox(service=service, options=options)",
    "    self.vars = {}",
    "",
    "  def teardown_method(self, method):",
    "    self.driver.quit()",
    "",
    "  def test_recording(self):",
    `    self.driver.get("${escapePy(pageUrl)}")`,
    "    self.driver.set_window_size(1366, 768)",
  ];

  steps.forEach((step, index) => {
    if (shouldSkipDuplicateStoreVariableStep(step, index, steps)) return;

    const prev = index > 0 ? steps[index - 1] : undefined;
    const next = index < steps.length - 1 ? steps[index + 1] : undefined;

    const stepLines = generatePythonStepWithVariable(
      step,
      index,
      variables,
      pref,
      prev,
      next,
    );

    if (stepLines?.length) lines.push(...stepLines);
  });

  return lines.join("\n");
}

function generatePythonStepWithVariable(
  step: Step,
  index: number,
  variables: Variable[],
  pref: LocatorPref = "relativeXPath",
  _prevStep?: Step,
  _nextStep?: Step,
): string[] | null {
  const action = (step.action || step.type || "").toLowerCase();
  const lines: string[] = [];

  lines.push(
    "# Step " +
      (index + 1) +
      ": " +
      action +
      " [" +
      (step.pageName || "page") +
      "]",
  );

  const model = toActionModel(step, pref);
  if (!model) {
    lines.push("    # Preserved step: no actionable locator/model generated");
    return lines;
  }

  const namedVar = findNamedVariable(step, variables);
  const stepVarName = String(
    step.variableName ?? step.contextMeta?.variableName ?? "",
  ).trim();

  const varName =
    stepVarName || (namedVar && namedVar.name) || "auto_" + (index + 1);

  const best = getBestXPathLocatorForModel(step, pref);

  const fallbackSelector = normalizeSelector(step);
  const fallbackXPath =
    sanitizePythonXPath(fallbackSelector?.relativeXPath || undefined) ||
    sanitizePythonXPath(fallbackSelector?.xpath || undefined);

  if (!best && !fallbackXPath) {
    lines.push("    # Preserved step but no selector was available");
    lines.push("    # TODO: provide locator for this step");
    return lines;
  }

  const chosenXPath = best?.locator || fallbackXPath!;
  const pyBy = "By.XPATH";
  const pyLocator = '"' + escapePy(chosenXPath) + '"';

  if (action === "click") {
    const nextAction = (
      _nextStep?.action ||
      _nextStep?.type ||
      ""
    ).toLowerCase();
    const nextVar = String(
      _nextStep?.variableName ?? _nextStep?.contextMeta?.variableName ?? "",
    ).trim();

    const canDriveDropdownOption =
      nextAction === "store_variable" && /^in_/i.test(nextVar);

    if (canDriveDropdownOption) {
      lines.push('    _expected = str(Row["' + escapePy(nextVar) + '"])');
      lines.push("    if _expected.strip():");
      lines.push(
        '      dynamic_option_xpath = f"//*[@role=\\"listbox\\"]//div[normalize-space(.)=\\"{_expected}\\" and @role=\\"option\\"]"',
      );
      lines.push(
        "      WebDriverWait(self.driver, 12).until(EC.element_to_be_clickable((By.XPATH, dynamic_option_xpath))).click()",
      );
      lines.push("    else:");
      lines.push(
        "      WebDriverWait(self.driver, 12).until(EC.element_to_be_clickable((" +
          pyBy +
          ", " +
          pyLocator +
          "))).click()",
      );
      return lines;
    }

    lines.push(
      "    WebDriverWait(self.driver, 12).until(EC.element_to_be_clickable((" +
        pyBy +
        ", " +
        pyLocator +
        "))).click()",
    );
    return lines;
  }

  if (action === "submit") {
    lines.push(
      "    el = WebDriverWait(self.driver, 12).until(EC.presence_of_element_located((" +
        pyBy +
        ", " +
        pyLocator +
        ")))",
    );
    lines.push("    el.submit()");
    return lines;
  }

  if (action === "input") {
    lines.push('    _val = str(Row["' + escapePy(varName) + '"])');
    lines.push(
      "    el = WebDriverWait(self.driver, 12).until(EC.visibility_of_element_located((" +
        pyBy +
        ", " +
        pyLocator +
        ")))",
    );

    if (isNativeSelectStep(step)) {
      lines.push("    Select(el).select_by_visible_text(_val)");
    } else {
      lines.push("    el.click()");
      lines.push("    el.clear()");
      lines.push("    el.send_keys(_val)");
    }

    return lines;
  }

  if (action === "store_variable") {
    const tag = (step.targetTag || "").toLowerCase();
    const type = (step.inputType || "").toLowerCase();
    const isInputLike =
      tag === "input" || tag === "textarea" || tag === "select";
    const isChoice = type === "checkbox" || type === "radio";

    lines.push("    try:");
    lines.push(
      "      el = WebDriverWait(self.driver, 6).until(EC.visibility_of_element_located((" +
        pyBy +
        ", " +
        pyLocator +
        ")))",
    );
    lines.push("    except Exception:");
    lines.push(
      "      el = self.driver.find_element(" + pyBy + ", " + pyLocator + ")",
    );

    if (isChoice) {
      lines.push(
        '    self.vars["' + varName + '"] = str(el.is_selected()).strip()',
      );
    } else if (isInputLike) {
      lines.push('    _v = str(el.get_attribute("value") or "").strip()');
      lines.push("    if not _v:");
      lines.push(
        '      _v = str(el.get_attribute("aria-valuetext") or "").strip()',
      );
      lines.push("    if not _v:");
      lines.push('      _v = str(el.text or "").strip()');
      lines.push('    self.vars["' + varName + '"] = _v');
    } else {
      lines.push(
        '    _v = str(el.get_attribute("aria-valuetext") or "").strip()',
      );
      lines.push("    if not _v:");
      lines.push('      _v = str(el.text or "").strip()');
      lines.push('    self.vars["' + varName + '"] = _v');
    }

    return lines;
  }

  if (action === "check") {
    lines.push(
      "    el = WebDriverWait(self.driver, 12).until(EC.presence_of_element_located((" +
        pyBy +
        ", " +
        pyLocator +
        ")))",
    );
    lines.push("    if not el.is_selected():");
    lines.push(
      "      WebDriverWait(self.driver, 12).until(EC.element_to_be_clickable((" +
        pyBy +
        ", " +
        pyLocator +
        "))).click()",
    );
    return lines;
  }

  if (action === "select") {
    if (isNativeSelectStep(step) && step.value != null) {
      lines.push(
        "    el = WebDriverWait(self.driver, 12).until(EC.visibility_of_element_located((" +
          pyBy +
          ", " +
          pyLocator +
          ")))",
      );
      lines.push(
        '    Select(el).select_by_visible_text("' +
          escapePy(String(step.value)) +
          '")',
      );
    } else {
      lines.push(
        "    WebDriverWait(self.driver, 12).until(EC.element_to_be_clickable((" +
          pyBy +
          ", " +
          pyLocator +
          "))).click()",
      );
    }
    return lines;
  }

  if (action === "hover") {
    lines.push(
      "    el = WebDriverWait(self.driver, 12).until(EC.visibility_of_element_located((" +
        pyBy +
        ", " +
        pyLocator +
        ")))",
    );
    lines.push("    ActionChains(self.driver).move_to_element(el).perform()");
    return lines;
  }

  lines.push("    # Unsupported action preserved: " + action);
  return lines;
}

// ── JAVASCRIPT GENERATOR ──────────────────────────────────────────────────────

function generateFullJavaScriptScriptWithVariables(
  steps: Step[],
  variables: Variable[],
  pref: LocatorPref = "relativeXPath",
): string {
  if (!steps.length) return "";
  const pageUrl = steps[0]?.pageUrl || "https://example.com";

  const lines: string[] = [
    "// Generated by Automation Recorder",
    "const { Builder, By, Key, until, Actions } = require('selenium-webdriver');",
    "",
    "(async function testRecording() {",
    "  let driver = await new Builder().forBrowser('chrome').build();",
    "  let vars = {};",
    "  try {",
    `    await driver.get("${escapeJS(pageUrl)}");`,
    "    await driver.manage().window().setRect({ width: 1366, height: 768 });",
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepLine = generateJavaScriptStepWithVariable(
      step,
      i,
      variables,
      pref,
    );
    if (stepLine) {
      lines.push(stepLine);
    }
  }

  lines.push("  } finally {", "    await driver.quit();", "  }", "})();");
  return lines.join("\n");
}

function generateJavaScriptStepWithVariable(
  step: Step,
  index: number,
  variables: Variable[],
  pref: LocatorPref,
): string | null {
  const selector = normalizeSelector(step);
  const preferred = getPreferredLocator(selector, pref);

  if (!preferred) return null;

  const byMethod =
    preferred.type === "css"
      ? `By.css("${escapeJS(preferred.value)}")`
      : `By.xpath("${escapeJS(preferred.value)}")`;

  const action = (step.action || step.type || "").toString().toLowerCase();

  // Try to find user-named variable for this step
  const namedVar = findNamedVariable(step, variables);
  const varName = namedVar?.name || `auto${index + 1}`;

  let line = `    // Step ${index + 1}: ${action} [${step.pageName || "page"}]\n`;

  if (action === "click" || action === "select" || action === "check") {
    line += `    await driver.findElement(${byMethod}).click();`;
    if (namedVar) {
      line += `\n    vars["${varName}"] = await driver.findElement(${byMethod}).getText();`;
    }
  } else if (action === "input") {
    const value = step.value != null ? String(step.value) : "";
    line += `    await driver.findElement(${byMethod}).click();\n`;
    line += `    await driver.findElement(${byMethod}).sendKeys("${escapeJS(value)}");\n`;
    line += `    vars["${varName}"] = await driver.findElement(${byMethod}).getAttribute("value");`;
  } else if (action === "store_variable") {
    line += `    vars["${varName}"] = await driver.findElement(${byMethod}).getAttribute("value");`;
  } else if (action === "submit") {
    line += `    await driver.findElement(${byMethod}).submit();`;
  } else if (action === "hover") {
    line += `    await driver.actions({ async: true }).move({ origin: await driver.findElement(${byMethod}) }).perform();`;
  } else {
    line += `    // TODO: handle action "${action}"\n    await driver.findElement(${byMethod});`;
  }

  return line;
}

// ── JAVA GENERATOR ────────────────────────────────────────────────────────────

function generateFullJavaWithVariables(
  steps: Step[],
  variables: Variable[],
  pref: LocatorPref = "relativeXPath",
): string {
  if (!steps.length) return "";
  const pageUrl = steps[0]?.pageUrl || "https://example.com";

  const lines: string[] = [
    "// Generated by Automation Recorder",
    "import org.openqa.selenium.*;",
    "import org.openqa.selenium.chrome.ChromeDriver;",
    "import org.openqa.selenium.interactions.Actions;",
    "import org.junit.*;",
    "import java.util.*;",
    "",
    "public class RecordingTest {",
    "  private WebDriver driver;",
    "  private Map<String, String> vars = new HashMap<>();",
    "",
    "  @Before",
    "  public void setUp() {",
    "    driver = new ChromeDriver();",
    "  }",
    "",
    "  @After",
    "  public void tearDown() {",
    "    driver.quit();",
    "  }",
    "",
    "  @Test",
    "  public void testRecording() {",
    `    driver.get("${escapeJava(pageUrl)}");`,
    "    driver.manage().window().setSize(new Dimension(1366, 768));",
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepLine = generateJavaStepWithVariable(step, i, variables, pref);
    if (stepLine) {
      lines.push(stepLine);
    }
  }

  lines.push("  }", "}");
  return lines.join("\n");
}

function generateJavaStepWithVariable(
  step: Step,
  index: number,
  variables: Variable[],
  pref: LocatorPref,
): string | null {
  const selector = normalizeSelector(step);
  const preferred = getPreferredLocator(selector, pref);

  if (!preferred) return null;

  const byMethod =
    preferred.type === "css"
      ? `By.cssSelector("${escapeJava(preferred.value)}")`
      : `By.xpath("${escapeJava(preferred.value)}")`;

  const action = (step.action || step.type || "").toString().toLowerCase();

  // Try to find user-named variable for this step
  const namedVar = findNamedVariable(step, variables);
  const varName = namedVar?.name || `auto${index + 1}`;

  let line = `    // Step ${index + 1}: ${action} [${step.pageName || "page"}]\n`;

  if (action === "click" || action === "select" || action === "check") {
    line += `    driver.findElement(${byMethod}).click();`;
    if (namedVar) {
      line += `\n    vars.put("${varName}", driver.findElement(${byMethod}).getText());`;
    }
  } else if (action === "input") {
    const value = step.value != null ? String(step.value) : "";
    line += `    driver.findElement(${byMethod}).click();\n`;
    line += `    driver.findElement(${byMethod}).sendKeys("${escapeJava(value)}");\n`;
    line += `    vars.put("${varName}", driver.findElement(${byMethod}).getAttribute("value"));`;
  } else if (action === "store_variable") {
    line += `    vars.put("${varName}", driver.findElement(${byMethod}).getAttribute("value"));`;
  } else if (action === "submit") {
    line += `    driver.findElement(${byMethod}).submit();`;
  } else if (action === "hover") {
    line += `    new Actions(driver).moveToElement(driver.findElement(${byMethod})).perform();`;
  } else {
    line += `    // TODO: handle action "${action}"\n    driver.findElement(${byMethod});`;
  }

  return line;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateStepSeleniumPreview(
  step: Step,
  pref: LocatorPref,
): string | null {
  const selector = normalizeSelector(step);
  const preferred = getPreferredLocator(selector, pref);
  if (!preferred) return null;

  const byMethod =
    preferred.type === "css"
      ? `By.cssSelector("${escapeJava(preferred.value)}")`
      : `By.xpath("${escapeJava(preferred.value)}")`;

  const action = (step.action || step.type || "").toString().toLowerCase();
  const rawValue = step.value != null ? String(step.value) : "";

  if (action === "click" || action === "select" || action === "check") {
    return `driver.findElement(${byMethod}).click();`;
  }
  if (action === "input") {
    return `driver.findElement(${byMethod}).sendKeys("${escapeJava(rawValue)}");`;
  }
  if (action === "submit") {
    return `driver.findElement(${byMethod}).submit();`;
  }
  if (action === "store_variable") {
    return `vars.put("...", driver.findElement(${byMethod}).getAttribute("value"));`;
  }

  return `// TODO: ${action}`;
}

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

function escapeJava(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function escapePy(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function escapeJS(text: string): string {
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
    flexWrap: "wrap" as const,
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
  langChipActive: {
    backgroundColor: "#89b4fa20",
    borderColor: "#89b4fa",
    color: "#89b4fa",
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
  captureBlock: {
    marginTop: 4,
    padding: "3px 6px",
    backgroundColor: "#1e1e2e",
    borderRadius: 4,
    border: "1px solid #45475a",
  },
  captureRow: { fontSize: 10, lineHeight: "16px" },
  captureLabel: { color: "#6c7086", fontWeight: 600 },
  captureValue: { color: "#94e2d5", fontFamily: "monospace" },
};

export default RecordingDetailsTabs;
