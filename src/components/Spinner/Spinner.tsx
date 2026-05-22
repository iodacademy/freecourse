import styles from "./Spinner.module.css";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export default function Spinner({ size = "md", label }: SpinnerProps) {
  const sizeClass =
    size === "sm" ? "spinner-sm" : size === "lg" ? "spinner-lg" : "";

  return (
    <div className={styles.wrapper}>
      <div className={`spinner ${sizeClass}`} role="status" />
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
}
