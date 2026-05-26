"use client";

import { useState, useEffect } from "react";

interface SessionEntry {
  id: string;
  skill_id: string;
  skill_name: string;
  duration_minutes: number;
  difficulty_multiplier: number;
  xp_earned: number;
  notes: string | null;
  logged_at: string;
}

interface SessionHistoryListProps {
  skillId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function difficultyLabel(multiplier: number): string {
  switch (multiplier) {
    case 0.5: return "Easy";
    case 1.0: return "Normal";
    case 1.5: return "Hard";
    case 2.0: return "Extreme";
    default: return String(multiplier);
  }
}

export function SessionHistoryList({ skillId }: SessionHistoryListProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/sessions?skill_id=${skillId}&limit=10`);
        if (!res.ok) {
          setError("Could not load session history.");
          return;
        }
        const data = (await res.json()) as { sessions: SessionEntry[] };
        if (!cancelled) setSessions(data.sessions);
      } catch {
        if (!cancelled) setError("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSessions();
    return () => { cancelled = true; };
  }, [skillId]);

  if (loading) {
    return (
      <p style={{ fontSize: "12px", color: "var(--text-muted, #888)", padding: "8px 0" }}>
        Loading history…
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" style={{ fontSize: "12px", color: "var(--error, #e05555)", padding: "8px 0" }}>
        {error}
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p style={{ fontSize: "12px", color: "var(--text-muted, #888)", padding: "8px 0" }}>
        No sessions logged yet.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        padding: "8px 0 4px",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {sessions.map((s) => (
        <li
          key={s.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "12px",
            color: "var(--text-muted, #888)",
          }}
        >
          <span style={{ flex: 1 }}>
            {s.duration_minutes} min · {difficultyLabel(s.difficulty_multiplier)}
          </span>
          <span
            style={{
              color: "var(--accent, #7c3aed)",
              fontWeight: "600",
            }}
          >
            +{s.xp_earned} XP
          </span>
          <span style={{ minWidth: "70px", textAlign: "right" }}>
            {formatDate(s.logged_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
