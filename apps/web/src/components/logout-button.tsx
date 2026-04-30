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
      className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-app-line bg-app-panel-muted px-4 text-sm text-app-text-soft transition hover:border-app-line-strong hover:text-app-text-strong disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      <span>{submitting ? "退出中" : "退出"}</span>
    </button>
  );
}
