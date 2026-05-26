interface ClassBadgeProps {
  className: string;
}

/** Maps internal class key to display label. */
function formatClassName(cls: string): string {
  return cls
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ClassBadge({ className }: ClassBadgeProps) {
  return (
    <span
      data-testid="class-badge"
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "var(--radius, 6px)",
        fontSize: "12px",
        fontWeight: "600",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--accent, #a0a0c0)",
        border: "1px solid var(--accent, #a0a0c0)",
        background: "transparent",
      }}
    >
      {formatClassName(className)}
    </span>
  );
}
