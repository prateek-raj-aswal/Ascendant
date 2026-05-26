export function InlineErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      data-testid="auth-error"
      style={{
        color: "var(--error)",
        fontSize: "14px",
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--error)",
        marginTop: "8px",
      }}
    >
      {message}
    </div>
  );
}
