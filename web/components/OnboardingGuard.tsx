"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Renders children (the onboarding form) only if the current user has no profile.
 * If the user already has a profile, redirects to /dashboard.
 * Relies on GET /api/profile: 200 → has profile, 404 → no profile.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/profile")
      .then((res) => {
        if (cancelled) return;
        if (res.status === 200) {
          // Profile exists — redirect away from onboarding
          router.replace("/dashboard");
        } else if (res.status === 404) {
          // No profile — show onboarding
          setReady(true);
        } else if (res.status === 401) {
          // Not authenticated — middleware should handle this, but redirect to login
          router.replace("/login");
        } else {
          // Unexpected — show form anyway
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
