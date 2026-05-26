"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineErrorMessage } from "./InlineErrorMessage";

export function SignupForm() {
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 201) {
        // Auto-login after signup
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (loginRes.ok) {
          router.push("/dashboard");
          return;
        }
      }

      const data = await res.json();
      setError(data.error ?? "Sign up failed. Please try again.");
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <InlineErrorMessage message={error} />

      <button type="submit" disabled={loading} style={{ marginTop: "4px" }}>
        {loading ? "Creating account…" : "Sign Up"}
      </button>
    </form>
  );
}
