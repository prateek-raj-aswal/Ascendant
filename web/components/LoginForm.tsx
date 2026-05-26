"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineErrorMessage } from "./InlineErrorMessage";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error ?? "Login failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="email" style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="password" style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <InlineErrorMessage message={error} />

      <button type="submit" disabled={loading} style={{ marginTop: "4px" }}>
        {loading ? "Signing in…" : "Log In"}
      </button>
    </form>
  );
}
