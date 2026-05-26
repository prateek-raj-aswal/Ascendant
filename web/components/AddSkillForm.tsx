"use client";

import { useState } from "react";

interface AddSkillFormProps {
  categoryId: string;
  onAdd: (skill: { id: string; name: string; description: string | null; current_xp: number; peak_xp: number; last_session_at: string | null }) => void;
  onCancel: () => void;
}

export function AddSkillForm({ categoryId, onAdd, onCancel }: AddSkillFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Skill name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, name: name.trim() }),
      });

      if (res.status === 201) {
        const skill = await res.json();
        onAdd(skill);
        setName("");
      } else if (res.status === 409) {
        setError("A skill with this name already exists in this category.");
      } else if (res.status === 422) {
        const data = await res.json();
        setError(data.error ?? "Skill name is required.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 0" }}
    >
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          name="skill_name"
          data-testid="skill-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Skill name"
          disabled={loading}
          style={{
            flex: 1,
            background: "var(--surface, #1a1a2e)",
            border: "1px solid var(--border, #2a2a4a)",
            borderRadius: "4px",
            color: "var(--text, #e0e0e0)",
            padding: "6px 10px",
            fontSize: "14px",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "var(--accent, #7c3aed)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "6px 14px",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            background: "transparent",
            color: "var(--text-muted, #888)",
            border: "1px solid var(--border, #2a2a4a)",
            borderRadius: "4px",
            padding: "6px 10px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <span
          role="alert"
          style={{ color: "var(--error, #e05555)", fontSize: "13px" }}
        >
          {error}
        </span>
      )}
    </form>
  );
}
