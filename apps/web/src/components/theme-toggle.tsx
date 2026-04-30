"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useState } from "react";

const storageKey = "weibo-ops-theme";

function applyTheme(nextTheme: "light" | "dark") {
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  window.localStorage.setItem(storageKey, nextTheme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") {
      return "dark";
    }

    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });

  return (
    <button
      type="button"
      onClick={() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-app-line bg-app-panel-muted px-4 text-sm text-app-text-soft transition hover:border-app-line-strong hover:text-app-text-strong"
    >
      {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      <span>{theme === "dark" ? "浅色" : "深色"}</span>
    </button>
  );
}
