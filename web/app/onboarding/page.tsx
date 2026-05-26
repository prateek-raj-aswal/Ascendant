import { OnboardingForm } from "@/components/OnboardingForm";
import { OnboardingGuard } from "@/components/OnboardingGuard";

export default function OnboardingPage() {
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
      <div style={{ width: "100%", maxWidth: "440px" }}>
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
          Set up your profile to begin
        </p>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "28px",
          }}
        >
          <OnboardingGuard>
            <OnboardingForm />
          </OnboardingGuard>
        </div>
      </div>
    </main>
  );
}
