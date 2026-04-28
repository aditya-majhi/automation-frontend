import { type ReactNode } from "react";

interface CardProps {
  title: string;
  subtitle?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  onClick?: () => void;
  children?: ReactNode;
}

const Card = ({
  title,
  subtitle,
  onDelete,
  onEdit,
  onClick,
  children,
}: CardProps) => {
  return (
    <div style={styles.card}>
      <div style={styles.header} onClick={onClick}>
        <div>
          <div style={styles.title}>{title}</div>
          {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
        </div>

        {(onEdit || onDelete) && (
          <div style={styles.actions}>
            {onEdit && (
              <button
                style={styles.editBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                ✎
              </button>
            )}
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
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  editBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    color: "#cba6f7",
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
