"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(isDark ? "light" : "dark")}>{isDark ? <Moon size={16} /> : <Sun size={16} />}</Button>;
}

export function ThemeModeHint() {
  const { theme } = useTheme();
  return <span className="sr-only">{theme === "system" ? <Monitor /> : null}</span>;
}
