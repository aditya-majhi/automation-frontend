import { type ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const Modal = ({ title, onClose, children }: ModalProps) => {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#1e1e2e",
    borderRadius: "12px",
    padding: "24px",
    width: "420px",
    border: "1px solid #313244",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    color: "#cdd6f4",
    fontSize: "16px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#6c7086",
    cursor: "pointer",
    fontSize: "18px",
  },
  body: {
    color: "#cdd6f4",
  },
};

export default Modal;
