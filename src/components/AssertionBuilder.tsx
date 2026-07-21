import { useMemo, useState } from "react";

type AssertionVariable = {
  name: string;
  pageName: string | null;
  kind: string;
  dataType: string;
  label: string;
};

type Row = {
  id: number;
  left: string;
  operator: string;
  right_type: "constant" | "variable";
  right_constant: string;
  right_variable: string;
  right_like_prefix: string;
  right_like_suffix: string;
  regex_value: string;
  connector: "AND" | "OR";
};

type AssertionsPanelProps = {
  testCaseId: string;
  baseScript: string;
  variables: any[];
  onFinalScriptGenerated: (script: string) => void;
  setActiveTab?: (tab: string) => void;
  api: {
    getAssertionOperators: () => Promise<any>;
    generateFinalScript: (
      testCaseId: string,
      payload: {
        baseScript: string;
        assertions: {
          logic: string;
          rules: Array<{
            id: number;
            label: string;
            left: string;
            operator: string;
            right_type: "constant" | "variable";
            right_value:
              | string
              | number
              | boolean
              | string[]
              | {
                  variable_name: string;
                  prefix?: string;
                  suffix?: string;
                }
              | null;
            regex_value: string | null;
          }>;
        };
      },
    ) => Promise<any>;
  };
};

const DEFAULT_OPERATORS = [
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "contains",
  "not_contains",
  "like",
  "unlike",
  "starts_with",
  "ends_with",
  "in_list",
  "not_in_list",
  "matches_regex",
  "is_empty",
  "is_not_empty",
];

const OPS_BY_DATATYPE: Record<string, string[]> = {
  string: [
    "==",
    "!=",
    "contains",
    "not_contains",
    "like",
    "unlike",
    "starts_with",
    "ends_with",
    "matches_regex",
    "is_empty",
    "is_not_empty",
  ],
  text: [
    "==",
    "!=",
    "contains",
    "not_contains",
    "like",
    "unlike",
    "starts_with",
    "ends_with",
    "matches_regex",
    "is_empty",
    "is_not_empty",
  ],
  number: [
    "==",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "like",
    "unlike",
    "is_empty",
    "is_not_empty",
  ],
  boolean: ["==", "!=", "is_empty", "is_not_empty"],
  email: [
    "==",
    "!=",
    "contains",
    "not_contains",
    "like",
    "unlike",
    "matches_regex",
    "is_empty",
    "is_not_empty",
  ],
  url: [
    "==",
    "!=",
    "contains",
    "starts_with",
    "ends_with",
    "like",
    "unlike",
    "is_empty",
    "is_not_empty",
  ],
  phone: [
    "==",
    "!=",
    "contains",
    "starts_with",
    "ends_with",
    "like",
    "unlike",
    "is_empty",
    "is_not_empty",
  ],
  date: [
    "==",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "like",
    "unlike",
    "is_empty",
    "is_not_empty",
  ],
  datetime: [
    "==",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "like",
    "unlike",
    "is_empty",
    "is_not_empty",
  ],
  time: [
    "==",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "like",
    "unlike",
    "is_empty",
    "is_not_empty",
  ],
  password: ["==", "!=", "is_empty", "is_not_empty"],
  color: ["==", "!=", "is_empty", "is_not_empty"],
  file: ["is_empty", "is_not_empty"],
  enum: ["==", "!=", "in_list", "not_in_list", "is_empty", "is_not_empty"],
  enum_type: ["==", "!=", "in_list", "not_in_list", "is_empty", "is_not_empty"],
};

const getOpsByDataType = (dataType: string): string[] => {
  return OPS_BY_DATATYPE[dataType] || DEFAULT_OPERATORS;
};

const getDataTypeForEncodedVar = (
  encoded: string,
  vars: AssertionVariable[],
): string => {
  const found = vars.find((v) => encodeVar(v.name, v.pageName) === encoded);
  return found?.dataType || "string";
};

const CONNECTOR_OPTIONS: ("AND" | "OR")[] = ["AND", "OR"];

const NO_RIGHT_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty"]);

const isRegexOperator = (op: string) => op === "matches_regex";
const isNoRightOperator = (op: string) => NO_RIGHT_VALUE_OPERATORS.has(op);
const isRightDisabledOperator = (op: string) =>
  isRegexOperator(op) || isNoRightOperator(op);
const isLikeOperator = (op: string) => op === "like" || op === "unlike";

const unwrap = <T,>(res: any, fallback: T): T => {
  if (res == null) return fallback;
  if (Array.isArray(res)) return res as T;
  if (res.data?.data != null) return res.data.data as T;
  if (res.data != null && !Array.isArray(res.data)) return res.data as T;
  if (res.variables || res.operators || res.final_script) return res as T;
  return fallback;
};

const normalizeIncomingVariables = (input: any[]): AssertionVariable[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      const name = String(v?.name || "").trim();
      return {
        name,
        pageName: v?.pageName || null,
        kind: String(v?.kind || "input"),
        dataType: String(v?.dataType || "string"),
        label: String(v?.label || v?.fieldName || name || ""),
      };
    })
    .filter((v) => v.name.length > 0 && v.kind.toLowerCase() !== "button");
};

function buildLogicFromRows(rows: Row[]): string {
  if (!rows.length) return "1";
  return rows
    .map((r, i) =>
      i < rows.length - 1 ? `${r.id} ${r.connector}` : String(r.id),
    )
    .join(" ");
}

const encodeVar = (name: string, pageName?: string | null) =>
  `${name}__${pageName || "global"}`;

const decodeVarName = (encoded: string) => (encoded || "").split("__")[0] || "";

const parseLikeComposite = (
  raw: unknown,
): { variable: string; suffix: string } => {
  const txt = String(raw ?? "");
  const [variable, suffix] = txt.split(":::");
  return {
    variable: String(variable || "").trim(),
    suffix: String(suffix || "").trim(),
  };
};

export default function AssertionsPanel({
  testCaseId,
  baseScript,
  variables,
  onFinalScriptGenerated,
  setActiveTab,
  api,
}: AssertionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [operators, setOperators] = useState<string[]>(DEFAULT_OPERATORS);
  const [rows, setRows] = useState<Row[]>([
    {
      id: 1,
      left: "",
      operator: "==",
      right_type: "constant",
      right_constant: "",
      right_variable: "",
      right_like_suffix: "",
      right_like_prefix: "",
      connector: "AND",
      regex_value: "",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const normalizedVars = useMemo(
    () => normalizeIncomingVariables(variables),
    [variables],
  );

  const variableOptions = useMemo(
    () =>
      normalizedVars.map((v) => ({
        value: encodeVar(v.name, v.pageName),
        label: v.pageName ? v.name + " (" + v.pageName + ")" : v.name,
      })),
    [normalizedVars],
  );

  const openModal = async () => {
    setErrorText("");
    setIsOpen(true);
    try {
      const opsRes = await api.getAssertionOperators();
      const opsPayload = unwrap<{ operators?: string[] }>(opsRes, {});
      const fetched = opsPayload.operators;
      if (fetched && fetched.length > 0) {
        setOperators(fetched);
      }
    } catch {
      //
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setErrorText("");
  };

  const updateRow = (id: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((p) => p.id)) + 1 : 1;
      return [
        ...prev,
        {
          id: nextId,
          left: "",
          operator: operators[0] || "==",
          right_type: "constant",
          right_constant: "",
          right_variable: "",
          right_like_suffix: "",
          right_like_prefix: "",
          connector: "AND",
          regex_value: "",
        },
      ];
    });
  };

  const removeRow = (id: number) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : prev;
    });
  };

  const applyAssertions = async () => {
    setErrorText("");

    if (!baseScript?.trim()) {
      setErrorText(
        "Base script is empty. Save/generate a Selenium script first, then apply assertions.",
      );
      return;
    }

    const validRows = rows.filter((r) => {
      if (!r.left || !r.operator) return false;
      if (isRegexOperator(r.operator)) return r.regex_value.trim().length > 0;
      if (isNoRightOperator(r.operator)) return true;
      if (isLikeOperator(r.operator) && r.right_type === "variable") {
        return r.right_variable.trim().length > 0;
      }

      return r.right_type === "constant"
        ? r.right_constant.trim().length > 0
        : r.right_variable.trim().length > 0;
    });

    if (!validRows.length) {
      setErrorText(
        "Add at least one valid assertion row with all fields filled.",
      );
      return;
    }

    const logic = buildLogicFromRows(validRows);

    const rules = validRows.map((r) => {
      if (isRegexOperator(r.operator)) {
        return {
          id: r.id,
          label: "R" + r.id,
          left: decodeVarName(r.left),
          operator: r.operator,
          right_type: null,
          right_value: null,
          regex_value: r.regex_value,
        };
      }

      if (isNoRightOperator(r.operator)) {
        return {
          id: r.id,
          label: "R" + r.id,
          left: decodeVarName(r.left),
          operator: r.operator,
          right_type: null,
          right_value: null,
          regex_value: null,
        };
      }

      return {
        id: r.id,
        label: "R" + r.id,
        left: decodeVarName(r.left),
        operator: r.operator,
        right_type: r.right_type,
        right_value:
          r.right_type === "variable"
            ? isLikeOperator(r.operator)
              ? {
                  variable_name: decodeVarName(r.right_variable),
                  prefix: r.right_like_prefix || "",
                  suffix: r.right_like_suffix || "",
                }
              : decodeVarName(r.right_variable)
            : r.right_constant,
        regex_value: null,
      };
    });

    setLoading(true);
    try {
      const res = await api.generateFinalScript(testCaseId, {
        baseScript,
        assertions: { logic, rules },
      });
      const generated = unwrap<any>(res, {});
      const finalScript = generated?.final_script || "";
      onFinalScriptGenerated(finalScript);
      setIsOpen(false);
      setActiveTab?.("final-script");
    } catch {
      setErrorText("Failed to generate final script. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={openModal} style={styles.openButton}>
        + Add Assertions
      </button>

      {isOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.title}>Add Assertions</h3>
            </div>

            <div style={styles.body}>
              <div style={styles.headRow}>
                <div style={styles.headNum} />
                <div style={styles.headCell}>Variable</div>
                <div style={styles.headCellSm}>Op</div>
                <div style={styles.headCellSm}>Type</div>
                <div style={styles.headCell}>Value</div>
                <div style={styles.headDel} />
              </div>

              {rows.map((row, idx) => {
                const rowDataType = getDataTypeForEncodedVar(
                  row.left,
                  normalizedVars,
                );
                const rowOperators = getOpsByDataType(rowDataType);

                return (
                  <div key={row.id}>
                    <div style={styles.row}>
                      <div style={styles.rowNum}>{row.id}.</div>

                      <select
                        value={row.left}
                        onChange={(e) => {
                          const nextLeft = e.target.value;
                          const nextDataType = getDataTypeForEncodedVar(
                            nextLeft,
                            normalizedVars,
                          );
                          const nextOps = getOpsByDataType(nextDataType);
                          const nextOperator = nextOps.includes(row.operator)
                            ? row.operator
                            : nextOps[0] || "==";

                          updateRow(row.id, {
                            left: nextLeft,
                            operator: nextOperator,
                            right_type: "constant",
                            right_constant: "",
                            right_variable: "",
                            right_like_suffix: "",
                            right_like_prefix: "",
                            regex_value: "",
                          });
                        }}
                        style={styles.input}
                      >
                        <option value="">No options to select</option>
                        {variableOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={row.operator}
                        onChange={(e) => {
                          const nextOp = e.target.value;

                          if (isRegexOperator(nextOp)) {
                            const entered = window.prompt(
                              "Enter regex pattern",
                              row.regex_value || "",
                            );
                            if (entered === null) return;

                            updateRow(row.id, {
                              operator: nextOp,
                              regex_value: entered.trim(),
                              right_type: "constant",
                              right_constant: "",
                              right_variable: "",
                              right_like_suffix: "",
                              right_like_prefix: "",
                            });
                            return;
                          }

                          if (isNoRightOperator(nextOp)) {
                            updateRow(row.id, {
                              operator: nextOp,
                              regex_value: "",
                              right_constant: "",
                              right_variable: "",
                              right_like_suffix: "",
                              right_like_prefix: "",
                            });
                            return;
                          }

                          updateRow(row.id, {
                            operator: nextOp,
                            regex_value: "",
                            right_like_suffix: "",
                            right_like_prefix: "",
                          });
                        }}
                        style={styles.inputSm}
                      >
                        {rowOperators.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>

                      <select
                        value={row.right_type}
                        onChange={(e) =>
                          updateRow(row.id, {
                            right_type: e.target.value as
                              | "constant"
                              | "variable",
                            right_constant: "",
                            right_variable: "",
                            right_like_suffix: "",
                            right_like_prefix: "",
                          })
                        }
                        style={styles.inputSm}
                        disabled={isRightDisabledOperator(row.operator)}
                      >
                        <option value="constant">constant</option>
                        <option value="variable">variable</option>
                      </select>

                      {isRegexOperator(row.operator) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const entered = window.prompt(
                              "Enter regex pattern",
                              row.regex_value || "",
                            );
                            if (entered === null) return;
                            updateRow(row.id, { regex_value: entered.trim() });
                          }}
                          style={styles.regexBtn}
                        >
                          {row.regex_value
                            ? `Regex: ${row.regex_value}`
                            : "Set regex pattern"}
                        </button>
                      ) : isNoRightOperator(row.operator) ? (
                        <input
                          value=""
                          disabled
                          placeholder="No value required"
                          style={{ ...styles.input, ...styles.disabledInput }}
                        />
                      ) : isLikeOperator(row.operator) &&
                        row.right_type === "variable" ? (
                        <div style={styles.likeCompositeWrap}>
                          <input
                            value={row.right_like_prefix}
                            onChange={(e) =>
                              updateRow(row.id, {
                                right_like_prefix: e.target.value,
                              })
                            }
                            placeholder="Type prefix"
                            style={styles.input}
                          />
                          <select
                            value={row.right_variable}
                            onChange={(e) =>
                              updateRow(row.id, {
                                right_variable: e.target.value,
                              })
                            }
                            style={styles.input}
                          >
                            <option value="">Select variable</option>
                            {variableOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            value={row.right_like_suffix}
                            onChange={(e) =>
                              updateRow(row.id, {
                                right_like_suffix: e.target.value,
                              })
                            }
                            placeholder="Type suffix"
                            style={styles.input}
                          />
                        </div>
                      ) : row.right_type === "constant" ? (
                        <input
                          value={row.right_constant}
                          onChange={(e) =>
                            updateRow(row.id, {
                              right_constant: e.target.value,
                            })
                          }
                          placeholder="Enter value"
                          style={styles.input}
                        />
                      ) : (
                        <select
                          value={row.right_variable}
                          onChange={(e) =>
                            updateRow(row.id, {
                              right_variable: e.target.value,
                            })
                          }
                          style={styles.input}
                        >
                          <option value="">Select variable</option>
                          {variableOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        style={styles.deleteBtn}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </div>

                    {idx < rows.length - 1 && (
                      <div style={styles.connectorRow}>
                        <select
                          value={row.connector}
                          onChange={(e) =>
                            updateRow(row.id, {
                              connector: e.target.value as "AND" | "OR",
                            })
                          }
                          style={styles.connectorSelect}
                        >
                          {CONNECTOR_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}

              <button type="button" onClick={addRow} style={styles.addRowBtn}>
                + Add Next Assertion
              </button>

              {errorText ? <div style={styles.error}>{errorText}</div> : null}
            </div>

            <div style={styles.footer}>
              <button
                type="button"
                onClick={closeModal}
                style={styles.secondaryBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={applyAssertions}
                style={{
                  ...styles.primaryBtn,
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Applying..." : "Apply Assertions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  openButton: {
    background: "#cba6f720",
    border: "1px solid #cba6f7",
    color: "#cba6f7",
    padding: "7px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#00000099",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    width: "min(900px, 96vw)",
    maxHeight: "88vh",
    overflow: "hidden",
    backgroundColor: "#1e1e2e",
    border: "1px solid #45475a",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    padding: "14px 20px",
    borderBottom: "1px solid #45475a",
  },
  title: {
    margin: 0,
    color: "#cdd6f4",
    fontSize: 16,
    fontWeight: 700,
  },
  body: {
    padding: "16px 20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    flex: 1,
  },
  headRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr 120px 110px 1fr 36px",
    gap: 8,
    marginBottom: 6,
  },
  headNum: { fontSize: 11, color: "#6c7086" },
  headCell: { fontSize: 11, color: "#6c7086", fontWeight: 600 },
  headCellSm: { fontSize: 11, color: "#6c7086", fontWeight: 600 },
  headDel: { width: 36 },
  row: {
    display: "grid",
    gridTemplateColumns: "28px 1fr 120px 110px 1fr 36px",
    gap: 8,
    alignItems: "start",
    paddingBottom: 0,
    overflow: "visible",
  },
  rowNum: {
    fontSize: 13,
    color: "#a6adc8",
    fontWeight: 600,
    textAlign: "right" as const,
    paddingRight: 4,
    paddingTop: 9,
  },
  input: {
    width: "100%",
    backgroundColor: "#11111b",
    border: "1px solid #45475a",
    color: "#cdd6f4",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
  },
  inputSm: {
    width: "100%",
    backgroundColor: "#11111b",
    border: "1px solid #45475a",
    color: "#cdd6f4",
    borderRadius: 8,
    padding: "8px 8px",
    fontSize: 12,
  },
  deleteBtn: {
    background: "#f38ba820",
    border: "1px solid #f38ba8",
    color: "#f38ba8",
    borderRadius: 8,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: 0,
    marginTop: 1,
  },
  connectorRow: {
    display: "flex",
    justifyContent: "center",
    margin: "8px 0",
  },
  connectorSelect: {
    backgroundColor: "#313244",
    border: "1px solid #45475a",
    color: "#cdd6f4",
    borderRadius: 8,
    padding: "5px 18px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 90,
    textAlign: "center" as const,
  },
  addRowBtn: {
    background: "transparent",
    border: "1px solid #cba6f7",
    color: "#cba6f7",
    borderRadius: 8,
    padding: "7px 14px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    marginTop: 12,
    alignSelf: "flex-start" as const,
  },
  error: {
    backgroundColor: "#f38ba820",
    border: "1px solid #f38ba8",
    color: "#f38ba8",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
    marginTop: 10,
  },
  footer: {
    borderTop: "1px solid #45475a",
    padding: "12px 20px",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryBtn: {
    background: "#45475a",
    border: "1px solid #45475a",
    color: "#cdd6f4",
    padding: "7px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
  },
  primaryBtn: {
    background: "#89b4fa20",
    border: "1px solid #89b4fa",
    color: "#89b4fa",
    padding: "7px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  regexBtn: {
    width: "100%",
    backgroundColor: "#11111b",
    border: "1px solid #89b4fa",
    color: "#89b4fa",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
    textAlign: "left" as const,
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  disabledInput: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  likeCompositeWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
};
