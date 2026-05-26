"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarSeedPicker } from "./AvatarSeedPicker";
import { InlineErrorMessage } from "./InlineErrorMessage";

export function OnboardingForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("dawn");
  const [nameError, setNameError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError("");
    setServerError("");

    // Client-side validation: display_name must not be blank or whitespace-only
    if (!displayName || displayName.trim().length === 0) {
      setNameError("Name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim(), avatar_seed: avatarSeed }),
      });

      if (res.status === 201) {
        router.push("/dashboard");
      } else if (res.status === 409) {
        // Profile already exists — guard should have caught this, but redirect anyway
        router.push("/dashboard");
      } else {
        const data = await res.json();
        if (data.field === "display_name") {
          setNameError(data.error ?? "Name is required.");
        } else {
          setServerError(data.error ?? "Something went wrong. Please try again.");
        }
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label
          htmlFor="display_name"
          style={{ fontSize: "14px", color: "var(--text-muted)" }}
        >
          Display Name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your display name"
          aria-invalid={nameError ? "true" : undefined}
          aria-describedby={nameError ? "name-error-msg" : undefined}
          style={{ fontSize: "14px" }}
        />
        {nameError && (
          <div
            id="name-error-msg"
            data-testid="name-error"
            role="alert"
            style={{
              color: "var(--error, #e05555)",
              fontSize: "13px",
              marginTop: "4px",
            }}
          >
            {nameError}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Choose Avatar
        </span>
        <AvatarSeedPicker value={avatarSeed} onChange={setAvatarSeed} />
      </div>

      <InlineErrorMessage message={serverError} />

      <button type="submit" disabled={loading} style={{ marginTop: "4px" }}>
        {loading ? "Creating profile…" : "Start Your Journey"}
      </button>
    </form>
  );
}
