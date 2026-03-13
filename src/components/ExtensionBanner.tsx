const EXTENSION_STORE_URL =
  "https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID";

interface ExtensionBannerProps {
  onRetry: () => void;
}

const ExtensionBanner = ({ onRetry }: ExtensionBannerProps) => {
  return (
    <div style={styles.banner}>
      <div style={styles.left}>
        <span style={styles.icon}>⚠️</span>
        <div>
          <div style={styles.title}>Extension Not Detected</div>
          <div style={styles.subtitle}>
            Install the Automation Recorder Chrome extension to start recording.
          </div>
        </div>
      </div>
      <div style={styles.right}>
        <a
          href={EXTENSION_STORE_URL}
          target="_blank"
          rel="noreferrer"
          style={styles.installBtn}
        >
          Install Extension
        </a>
        <button style={styles.retryBtn} onClick={onRetry}>
          I've Installed It
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fab3872a",
    border: "1px solid #fab387",
    borderRadius: "10px",
    padding: "14px 18px",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  icon: {
    fontSize: "22px",
  },
  title: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#fab387",
  },
  subtitle: {
    fontSize: "12px",
    color: "#a6adc8",
    marginTop: "2px",
  },
  right: {
    display: "flex",
    gap: "10px",
  },
  installBtn: {
    padding: "8px 16px",
    backgroundColor: "#fab387",
    color: "#1e1e2e",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "13px",
    textDecoration: "none",
    display: "inline-block",
  },
  retryBtn: {
    padding: "8px 16px",
    backgroundColor: "transparent",
    color: "#fab387",
    border: "1px solid #fab387",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "13px",
    cursor: "pointer",
  },
};

export default ExtensionBanner;
