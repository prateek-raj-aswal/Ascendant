"use client";

import { useState } from "react";
import { RenameSkillForm } from "./RenameSkillForm";
import { DeleteSkillConfirmDialog } from "./DeleteSkillConfirmDialog";
import { LogSessionModal } from "./sessions/LogSessionModal";
import { SessionHistoryList } from "./sessions/SessionHistoryList";

export interface SkillData {
  id: string;
  name: string;
  description: string | null;
  current_xp: number;
  peak_xp: number;
  last_session_at: string | null;
}

interface SkillRowProps {
  skill: SkillData;
  onRenamed: (skillId: string, newName: string) => void;
  onDeleted: (skillId: string) => void;
  onXPUpdated?: (skillId: string, newCurrentXP: number) => void;
}

export function SkillRow({ skill, onRenamed, onDeleted, onXPUpdated }: SkillRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLogSession, setShowLogSession] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [xpToast, setXpToast] = useState<number | null>(null);

  function handleSessionLogged(xpEarned: number, newSkillXP: number) {
    setShowLogSession(false);
    setXpToast(xpEarned);
    onXPUpdated?.(skill.id, newSkillXP);
    setTimeout(() => setXpToast(null), 3000);
  }

  async function handleDelete() {
    setError("");
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });

      if (res.status === 204) {
        onDeleted(skill.id);
      } else if (res.status === 400) {
        // Has history — show confirmation dialog
        setShowDeleteConfirm(true);
      } else if (res.status === 404) {
        setError("Skill not found.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleForceDelete() {
    setError("");
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}?force=true`, { method: "DELETE" });

      if (res.status === 204) {
        setShowDeleteConfirm(false);
        onDeleted(skill.id);
      } else if (res.status === 404) {
        setError("Skill not found.");
        setShowDeleteConfirm(false);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (renaming) {
    return (
      <li
        data-testid={`skill-row-${skill.id}`}
        style={{
          padding: "8px 0",
          listStyle: "none",
          borderBottom: "1px solid var(--border, #2a2a4a)",
        }}
      >
        <RenameSkillForm
          skillId={skill.id}
          currentName={skill.name}
          onRenamed={(newName) => {
            onRenamed(skill.id, newName);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      </li>
    );
  }

  return (
    <>
      <li
        data-testid={`skill-row-${skill.id}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 0",
          listStyle: "none",
          borderBottom: "1px solid var(--border, #2a2a4a)",
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: "14px",
            color: "var(--text, #e0e0e0)",
          }}
        >
          {skill.name}
        </span>
        <span
          data-testid={`xp-badge-${skill.id}`}
          aria-label={`${skill.current_xp} XP`}
          style={{
            fontSize: "12px",
            color: "var(--accent, #7c3aed)",
            background: "rgba(124, 58, 237, 0.1)",
            borderRadius: "4px",
            padding: "2px 8px",
            fontWeight: "600",
          }}
        >
          {skill.current_xp} XP
        </span>
        <button
          type="button"
          onClick={() => setShowLogSession(true)}
          aria-label={`Log Session for ${skill.name}`}
          style={{
            background: "var(--accent, #7c3aed)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "4px 10px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Log Session
        </button>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-label={`History for ${skill.name}`}
          style={{
            background: "transparent",
            color: "var(--text-muted, #888)",
            border: "1px solid var(--border, #2a2a4a)",
            borderRadius: "4px",
            padding: "4px 10px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          History
        </button>
        <button
          type="button"
          onClick={() => setRenaming(true)}
          aria-label={`Rename ${skill.name}`}
          style={{
            background: "transparent",
            color: "var(--text-muted, #888)",
            border: "1px solid var(--border, #2a2a4a)",
            borderRadius: "4px",
            padding: "4px 10px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Rename
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteLoading}
          aria-label={`Delete ${skill.name}`}
          style={{
            background: "transparent",
            color: "var(--error, #e05555)",
            border: "1px solid var(--error, #e05555)",
            borderRadius: "4px",
            padding: "4px 10px",
            fontSize: "12px",
            cursor: deleteLoading ? "not-allowed" : "pointer",
          }}
        >
          {deleteLoading ? "Deleting…" : "Delete"}
        </button>
      </li>
      {error && (
        <li style={{ listStyle: "none", padding: "4px 0" }}>
          <span role="alert" style={{ color: "var(--error, #e05555)", fontSize: "13px" }}>
            {error}
          </span>
        </li>
      )}
      {xpToast !== null && (
        <li style={{ listStyle: "none", padding: "4px 0" }}>
          <span
            role="status"
            style={{
              fontSize: "13px",
              color: "var(--accent, #7c3aed)",
              fontWeight: "600",
            }}
          >
            +{xpToast} XP earned!
          </span>
        </li>
      )}
      {showHistory && (
        <li style={{ listStyle: "none", padding: "0 0 4px 12px" }}>
          <SessionHistoryList skillId={skill.id} />
        </li>
      )}
      {showDeleteConfirm && (
        <DeleteSkillConfirmDialog
          skillName={skill.name}
          loading={deleteLoading}
          onConfirm={handleForceDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showLogSession && (
        <LogSessionModal
          skillName={skill.name}
          skillId={skill.id}
          open={showLogSession}
          onClose={() => setShowLogSession(false)}
          onLogged={handleSessionLogged}
        />
      )}
    </>
  );
}
