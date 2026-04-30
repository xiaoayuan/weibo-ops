"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      type="button"
      disabled={submitting}
      onClick={async () => {
        try {
          setSubmitting(true);
          await fetch("/api/auth/logout", {
            method: "POST",
          });
          router.replace("/login");
          router.refresh();
        } finally {
          setSubmitting(false);
        }
      }}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-app-line/70 bg-app-panel/80 px-4 text-sm text-app-text transition hover:border-app-danger/35 hover:text-app-text-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      <span>{submitting ? "退出中" : "退出"}</span>
    </button>
  );
}
