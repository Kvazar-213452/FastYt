"use client";

import { useThemeLanguage } from "@/lib/hooks/useThemeLanguage";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useThemeLanguage();

  return (
    <main className={isDarkMode ? "dark" : "light"} id="app">
      {children}
    </main>
  );
}
