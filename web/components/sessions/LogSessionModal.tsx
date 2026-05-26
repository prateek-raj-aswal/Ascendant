"use client";

import { useState } from "react";

interface LogSessionModalProps {
  skillName: string;
  skillId: string;
  open: boolean;
  onClose: () => void;
  onLogged: (xpEarned: number, newSkillXP: number) => void;
}

const DIFFICULTY_OPTIONS = [
  { label: "Easy (0.5×)", value: 0.5 },
  { label: "Normal (1×)", value: 1.0 },
  { label: "Hard (1.5×)", value: 1.5 },
  { label: "Extreme (2×)", value: 2.0 },
];

export function LogSessionModal({
  skillName,
  skillId,
  open,
  onClose,
  onLogged,
}: LogSessionModalProps) {
  const [duration, setDuration] = useState("");
  const [difficulty, setDifficulty] = useState("1.0");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const durationMinutes = parseInt(duration, 10);
    if (!duration || isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
      setError("Duration must be between 1 and 480 minutes.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_id: skillId,
          duration_minutes: durationMinutes,
          difficulty_multiplier: parseFloat(difficulty),
          notes: notes.trim() || undefined,
        }),
      });

      if (res.status === 201) {
        const data = (await res.json()) as {
          xp_earned: number;
          new_skill_xp: number;
        };
        onLogged(data.xp_earned, data.new_skill_xp);
        setDuration("");
        setDifficulty("1.0");
        setNotes("");
      } else {
        const body = (await res.json()) as { error?: string };
        setError(body.error === "INVALID_DURATION"
          ? "Duration must be between 1 and 480 minutes."
          : body.error === "INVALID_DIFFICULTY"
          ? "Invalid difficulty selected."
          : "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  };

  const dialogStyle: React.CSSProperties = {
    background: "var(--bg-card, #1a1a2e)",
    border: "1px solid var(--border, #2a2a4a)",
    borderRadius: "12px",
    padding: "28px 24px",
    width: "100%",
    maxWidth: "440px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "var(--bg-input, #0f0f1e)",
    border: "1px solid var(--border, #2a2a4a)",
    borderRadius: "6px",
    color: "var(--text, #e0e0e0)",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Log session for ${skillName}`}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "var(--accent, #7c3aed)",
            margin: 0,
          }}
        >
          Log Session
        </h2>

        <p style={{ fontSize: "14px", color: "var(--text-muted, #888)", margin: 0 }}>
          Skill: <strong style={{ color: "var(--text, #e0e0e0)" }}>{skillName}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="log-duration"
              style={{ fontSize: "13px", color: "var(--text-muted, #888)" }}
            >
              Duration (minutes)
            </label>
            <input
              id="log-duration"
              type="number"
              min={1}
              max={480}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="30"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="log-difficulty"
              style={{ fontSize: "13px", color: "var(--text-muted, #888)" }}
            >
              Difficulty
            </label>
            <select
              id="log-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              style={inputStyle}
            >
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="log-notes"
              style={{ fontSize: "13px", color: "var(--text-muted, #888)" }}
            >
              Notes <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <textarea
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go?"
              rows={2}
              maxLength={500}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {error && (
            <span role="alert" style={{ fontSize: "13px", color: "var(--error, #e05555)" }}>
              {error}
            </span>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 18px",
                background: "transparent",
                border: "1px solid var(--border, #2a2a4a)",
                borderRadius: "6px",
                color: "var(--text-muted, #888)",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 20px",
                background: "var(--accent, #7c3aed)",
                border: "none",
                borderRadius: "6px",
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Logging…" : "Log Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
