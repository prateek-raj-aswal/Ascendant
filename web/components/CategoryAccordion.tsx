"use client";

import { useState } from "react";
import { SkillRow, type SkillData } from "./SkillRow";
import { AddSkillForm } from "./AddSkillForm";

interface CategoryAccordionProps {
  id: string;
  name: string;
  initialSkills: SkillData[];
}

export function CategoryAccordion({ id, name, initialSkills }: CategoryAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const [skills, setSkills] = useState<SkillData[]>(initialSkills);
  const [showAddForm, setShowAddForm] = useState(false);

  const testId = `category-${name.toLowerCase()}`;

  function handleSkillAdded(skill: SkillData) {
    setSkills((prev) => [...prev, skill]);
    setShowAddForm(false);
  }

  function handleSkillRenamed(skillId: string, newName: string) {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, name: newName } : s))
    );
  }

  function handleSkillDeleted(skillId: string) {
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
  }

  function handleXPUpdated(skillId: string, newCurrentXP: number) {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, current_xp: newCurrentXP } : s))
    );
  }

  return (
    <div
      data-testid={testId}
      style={{
        border: "1px solid var(--border, #2a2a4a)",
        borderRadius: "6px",
        overflow: "hidden",
        marginBottom: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${name} category`}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "var(--surface, #1a1a2e)",
          border: "none",
          color: "var(--text, #e0e0e0)",
          fontSize: "16px",
          fontWeight: "600",
          cursor: "pointer",
          textAlign: "left",
          letterSpacing: "0.04em",
        }}
      >
        <span>{name}</span>
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted, #888)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            display: "inline-block",
          }}
          aria-hidden="true"
        >
          &#9660;
        </span>
      </button>

      {expanded && (
        <div
          data-testid={`skill-list-${name.toLowerCase()}`}
          style={{
            padding: "8px 16px 16px",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {skills.length > 0 ? (
            <ul style={{ margin: 0, padding: 0 }}>
              {skills.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  onRenamed={handleSkillRenamed}
                  onDeleted={handleSkillDeleted}
                  onXPUpdated={handleXPUpdated}
                />
              ))}
            </ul>
          ) : (
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted, #888)",
                padding: "8px 0",
                margin: 0,
              }}
            >
              No sub-skills yet.
            </p>
          )}

          {showAddForm ? (
            <AddSkillForm
              categoryId={id}
              onAdd={handleSkillAdded}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              style={{
                marginTop: "12px",
                background: "transparent",
                color: "var(--accent, #7c3aed)",
                border: "1px solid var(--accent, #7c3aed)",
                borderRadius: "4px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Add Sub-skill
            </button>
          )}
        </div>
      )}
    </div>
  );
}
