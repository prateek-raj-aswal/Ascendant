import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthHandler } from "@/lib/auth/handler";
import { getSkillsHandler } from "@/lib/skills/handler";
import { CategoryAccordion } from "@/components/CategoryAccordion";

export default async function SkillsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    redirect("/login");
  }

  const authHandler = getAuthHandler();
  if (!authHandler.isValidToken(token)) {
    redirect("/login");
  }

  const userId = authHandler.getUserIdForToken(token);
  if (!userId) {
    redirect("/login");
  }

  const skillsHandler = getSkillsHandler();
  const categories = skillsHandler.getCategories(userId);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 24px",
        maxWidth: "720px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: "26px",
          fontWeight: "700",
          letterSpacing: "0.06em",
          color: "var(--accent, #7c3aed)",
          marginBottom: "8px",
        }}
      >
        Skill Tree
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-muted, #888)",
          marginBottom: "28px",
        }}
      >
        Manage your sub-skills across four disciplines.
      </p>

      <div>
        {categories.map((cat) => (
          <CategoryAccordion
            key={cat.id}
            id={cat.id}
            name={cat.name}
            initialSkills={cat.skills}
          />
        ))}
      </div>
    </main>
  );
}
