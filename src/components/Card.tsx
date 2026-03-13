import { type ReactNode } from "react";

interface CardProps {
  title: string;
  subtitle?: string;
  onDelete?: () => void;
  onClick?: () => void;
  children?: ReactNode;
}

const Card = ({ title, subtitle, onDelete, onClick, children }: CardProps) => {
  return (
    <div style={styles.card}>
      <div style={styles.header} onClick={onClick}>
        <div>
          <div style={styles.title}>{title}</div>
          {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
        </div>
        {onDelete && (
          <button
            style={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            🗑
          </button>
        )}
      </div>
      {children && <div style={styles.body}>{children}</div>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: "#313244",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    border: "1px solid #45475a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  title: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#cdd6f4",
  },
  subtitle: {
    fontSize: "12px",
    color: "#6c7086",
    marginTop: "4px",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    color: "#f38ba8",
  },
  body: {
    marginTop: "12px",
  },
};

export default Card;
