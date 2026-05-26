"use client";

interface DeleteSkillConfirmDialogProps {
  skillName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function DeleteSkillConfirmDialog({
  skillName,
  onConfirm,
  onCancel,
  loading,
}: DeleteSkillConfirmDialogProps) {
  return (
    <div
      role="dialog"
      data-testid="delete-confirm-dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.7)",
      }}
    >
      <div
        style={{
          background: "var(--surface, #1a1a2e)",
          border: "1px solid var(--border, #2a2a4a)",
          borderRadius: "8px",
          padding: "28px",
          maxWidth: "400px",
          width: "100%",
          margin: "0 16px",
        }}
      >
        <h2
          id="delete-dialog-title"
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "var(--text, #e0e0e0)",
            marginBottom: "12px",
          }}
        >
          Delete Skill
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted, #888)",
            marginBottom: "8px",
          }}
        >
          Are you sure you want to delete <strong style={{ color: "var(--text, #e0e0e0)" }}>{skillName}</strong>?
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "var(--error, #e05555)",
            marginBottom: "24px",
          }}
        >
          This skill has session history. All associated history will also be deleted and cannot be recovered.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              background: "transparent",
              color: "var(--text-muted, #888)",
              border: "1px solid var(--border, #2a2a4a)",
              borderRadius: "4px",
              padding: "8px 16px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: "var(--error, #e05555)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "8px 16px",
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
