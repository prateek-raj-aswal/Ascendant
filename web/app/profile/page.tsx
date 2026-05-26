import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthHandler } from "@/lib/auth/handler";
import { getProfileHandler } from "@/lib/profile/handler";
import { ProfileCard } from "@/components/ProfileCard";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    redirect("/login");
  }

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) {
    redirect("/login");
  }

  const user_id = authHandler.getUserIdForToken(token);
  if (!user_id) {
    redirect("/login");
  }

  const profileHandler = getProfileHandler();
  let profile;
  try {
    profile = await profileHandler.getProfile(user_id);
  } catch (err) {
    if ((err as any)?.code === "PROFILE_NOT_FOUND") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!profile) {
    redirect("/onboarding");
  }

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
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            color: "var(--accent)",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          ASCENDANT
        </h1>

        <ProfileCard
          display_name={profile.display_name}
          avatar_seed={profile.avatar_seed}
          userClass={profile.class}
          total_xp={profile.total_xp}
        />
      </div>
    </main>
  );
}
