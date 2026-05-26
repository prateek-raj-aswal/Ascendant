"use client";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent)", letterSpacing: "0.08em" }}>
          ASCENDANT
        </h1>
        <button type="button" onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <section>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          Your journey continues. More features coming in the next phase.
        </p>
      </section>
    </main>
  );
}
