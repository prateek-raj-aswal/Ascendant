"use client";

/** Deterministic color from a seed string. */
function seedToColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 35%)`;
}

/** Single letter avatar derived from seed. */
function seedToInitial(seed: string): string {
  const trimmed = seed.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

interface AvatarPreviewProps {
  seed: string;
  size?: number;
}

export function AvatarPreview({ seed, size = 64 }: AvatarPreviewProps) {
  const bg = seedToColor(seed || "default");
  const initial = seedToInitial(seed || "default");
  return (
    <div
      data-testid="profile-avatar"
      aria-label="avatar"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: "700",
        color: "#e0e0e0",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

const PRESET_SEEDS = ["dawn", "dusk", "void", "flame", "rift"];

interface AvatarSeedPickerProps {
  value: string;
  onChange: (seed: string) => void;
}

export function AvatarSeedPicker({ value, onChange }: AvatarSeedPickerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {PRESET_SEEDS.map((seed) => (
          <button
            key={seed}
            type="button"
            onClick={() => onChange(seed)}
            aria-pressed={value === seed}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: seedToColor(seed),
              border: value === seed ? "2px solid var(--accent, #a0a0c0)" : "2px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: "700",
              color: "#e0e0e0",
            }}
          >
            {seed[0].toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label
          htmlFor="avatar_seed_input"
          style={{ fontSize: "13px", color: "var(--text-muted)" }}
        >
          Or enter a custom seed
        </label>
        <input
          id="avatar_seed_input"
          name="avatar_seed"
          data-testid="avatar-seed"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. shadow-walker"
          style={{ fontSize: "14px" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <AvatarPreview seed={value} size={48} />
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Preview</span>
      </div>
    </div>
  );
}
