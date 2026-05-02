"use client";

import { MoonStar, SunMedium, Monitor } from "lucide-react";
import { useState, useEffect } from "react";

const storageKey = "weibo-ops-theme";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const actualTheme = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.dataset.theme = actualTheme;
  document.documentElement.style.colorScheme = actualTheme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "system";
    const stored = window.localStorage.getItem(storageKey) as Theme | null;
    return stored || "system";
  });

  const [isOpen, setIsOpen] = useState(false);

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => applyTheme("system");
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    setIsOpen(false);
  };

  const currentDisplayTheme = theme === "system" ? getSystemTheme() : theme;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-app-line bg-app-panel-muted px-4 text-sm text-app-text-soft transition hover:border-app-line-strong hover:text-app-text-strong"
      >
        {theme === "system" ? (
          <Monitor className="h-4 w-4" />
        ) : currentDisplayTheme === "dark" ? (
          <SunMedium className="h-4 w-4" />
        ) : (
          <MoonStar className="h-4 w-4" />
        )}
        <span>
          {theme === "system" ? "跟随系统" : currentDisplayTheme === "dark" ? "浅色" : "深色"}
        </span>
      </button>

      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 下拉菜单 */}
          <div className="absolute right-0 mt-2 w-40 app-surface z-50 shadow-lg">
            <button
              onClick={() => handleThemeChange("light")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition ${
                theme === "light"
                  ? "bg-app-accent-soft text-app-accent"
                  : "text-app-text hover:bg-app-panel-muted"
              }`}
            >
              <SunMedium className="h-4 w-4" />
              <span>浅色</span>
            </button>

            <button
              onClick={() => handleThemeChange("dark")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition border-t border-app-line ${
                theme === "dark"
                  ? "bg-app-accent-soft text-app-accent"
                  : "text-app-text hover:bg-app-panel-muted"
              }`}
            >
              <MoonStar className="h-4 w-4" />
              <span>深色</span>
            </button>

            <button
              onClick={() => handleThemeChange("system")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition border-t border-app-line ${
                theme === "system"
                  ? "bg-app-accent-soft text-app-accent"
                  : "text-app-text hover:bg-app-panel-muted"
              }`}
            >
              <Monitor className="h-4 w-4" />
              <span>跟随系统</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
