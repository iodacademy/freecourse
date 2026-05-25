

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export default function Spinner({ size = "md", label }: SpinnerProps) {
  const sizeClass =
    size === "sm" ? "spinner-sm" : size === "lg" ? "spinner-lg" : "";

  return (
    <div className="sp-wrapper">
      <div className={`spinner ${sizeClass}`} role="status" />
      {label && <p className="sp-label">{label}</p>}
    </div>
  );
}
