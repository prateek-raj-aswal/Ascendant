import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            color: "var(--accent)",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          ASCENDANT
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          Sign in to continue your journey
        </p>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "28px",
          }}
        >
          <LoginForm />
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "var(--text-muted)" }}>
          No account?{" "}
          <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
