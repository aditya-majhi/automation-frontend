interface FormInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const FormInput = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: FormInputProps) => {
  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#a6adc8",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    backgroundColor: "#313244",
    border: "1px solid #45475a",
    borderRadius: "8px",
    color: "#cdd6f4",
    fontSize: "14px",
    boxSizing: "border-box",
  },
};

export default FormInput;
