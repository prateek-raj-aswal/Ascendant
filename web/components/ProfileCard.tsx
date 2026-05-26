import { AvatarPreview } from "./AvatarSeedPicker";
import { ClassBadge } from "./ClassBadge";

interface ProfileCardProps {
  display_name: string;
  avatar_seed: string;
  userClass: string;
  total_xp: number;
}

export function ProfileCard({ display_name, avatar_seed, userClass, total_xp }: ProfileCardProps) {
  return (
    <div
      data-testid="profile-card"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <AvatarPreview seed={avatar_seed} size={80} />

      <h2
        data-testid="profile-name"
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: "var(--text, #e0e0e0)",
          margin: 0,
        }}
      >
        {display_name}
      </h2>

      <ClassBadge className={userClass} />

      <p
        data-testid="profile-xp"
        style={{
          fontSize: "16px",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        {total_xp} XP
      </p>
    </div>
  );
}
