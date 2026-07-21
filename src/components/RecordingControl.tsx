import { useState } from "react";

interface RecordingControlsProps {
  testCaseId: string;
  isRecording: boolean;
  stepCount: number;
  isExtensionInstalled: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}

const RecordingControls = ({
  testCaseId,
  isRecording,
  stepCount,
  isExtensionInstalled,
  onStart,
  onStop,
}: RecordingControlsProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    setError("");
    setLoading(true);
    try {
      await onStart();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await onStop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop recording");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>Record Test Case</span>
        {isRecording && (
          <div style={styles.liveIndicator}>
            <span style={styles.dot} />
            Recording - {stepCount} steps
          </div>
        )}
      </div>

      <div style={styles.idBox}>
        <span style={styles.idLabel}>Test Case ID:</span>
        <code style={styles.idValue}>{testCaseId}</code>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!isRecording ? (
        <button
          style={{
            ...styles.startBtn,
            opacity: !isExtensionInstalled || loading ? 0.5 : 1,
            cursor:
              !isExtensionInstalled || loading ? "not-allowed" : "pointer",
          }}
          onClick={handleStart}
          disabled={!isExtensionInstalled || loading}
        >
          {loading ? "Starting..." : "Start Recording"}
        </button>
      ) : (
        <button
          style={{
            ...styles.stopBtn,
            opacity: loading ? 0.5 : 1,
          }}
          onClick={handleStop}
          disabled={loading}
        >
          {loading ? "Stopping..." : "Stop Recording"}
        </button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    backgroundColor: "#313244",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #45475a",
    marginBottom: "24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  title: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#cdd6f4",
  },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#a6e3a1",
    fontWeight: "600",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#a6e3a1",
    boxShadow: "0 0 6px #a6e3a1",
    animation: "pulse 1.2s infinite",
    display: "inline-block",
  },
  idBox: {
    backgroundColor: "#1e1e2e",
    borderRadius: "8px",
    padding: "8px 12px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  idLabel: {
    fontSize: "12px",
    color: "#6c7086",
  },
  idValue: {
    fontSize: "12px",
    color: "#89dceb",
    wordBreak: "break-all",
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
  startBtn: {
    width: "100%",
    padding: "10px 20px",
    backgroundColor: "#a6e3a1",
    color: "#1e1e2e",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "13px",
    cursor: "pointer",
  },
  stopBtn: {
    padding: "10px 24px",
    backgroundColor: "#f38ba8",
    color: "#1e1e2e",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: "pointer",
    width: "100%",
  },
};

export default RecordingControls;
