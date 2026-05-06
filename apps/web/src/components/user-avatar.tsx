"use client";

type UserAvatarProps = {
  base64: string | null | undefined;
  username: string;
  size?: number;
};

export function UserAvatar({ base64, username, size = 36 }: UserAvatarProps) {
  const initial = (username || "?").charAt(0).toUpperCase();

  if (base64) {
    return (
      <img
        src={base64}
        alt={username}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-app-panel-muted border border-app-line flex items-center justify-center flex-shrink-0 text-app-text-soft font-semibold select-none"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.4) }}
    >
      {initial}
    </div>
  );
}
