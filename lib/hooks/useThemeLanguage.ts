"use client";

import { useState, useEffect } from "react";

class ThemeLanguageManager {
  private static instance: ThemeLanguageManager;
  private themeListeners: Set<(isDark: boolean) => void> = new Set();
  private languageListeners: Set<(lang: string) => void> = new Set();

  static getInstance(): ThemeLanguageManager {
    if (!this.instance) this.instance = new ThemeLanguageManager();
    return this.instance;
  }

  // видаляємо прямий доступ до localStorage тут
  isDarkMode(): boolean {
    return false; // default, actual value встановлюється у useEffect
  }

  setDarkMode(isDark: boolean): void {
    localStorage.setItem("theme", isDark ? "dark" : "light");
    this.applyTheme(isDark);
    this.notifyThemeListeners(isDark);
  }

  toggleDarkMode(): void {
    const current = localStorage.getItem("theme") === "dark";
    this.setDarkMode(!current);
  }

  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add("dark");
      document.documentElement.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
      document.documentElement.classList.remove("dark");
    }
  }

  getCurrentLanguage(): string {
    return "EN"; // default
  }

  setLanguage(lang: string): void {
    localStorage.setItem("language", lang);
    this.notifyLanguageListeners(lang);
  }

  onThemeChange(callback: (isDark: boolean) => void): () => void {
    this.themeListeners.add(callback);
    return () => this.themeListeners.delete(callback);
  }

  onLanguageChange(callback: (lang: string) => void): () => void {
    this.languageListeners.add(callback);
    return () => this.languageListeners.delete(callback);
  }

  private notifyThemeListeners(isDark: boolean): void {
    this.themeListeners.forEach((cb) => cb(isDark));
  }

  private notifyLanguageListeners(lang: string): void {
    this.languageListeners.forEach((cb) => cb(lang));
  }
}

const themeLanguageManager = ThemeLanguageManager.getInstance();

// hook
export function useThemeLanguage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentLang, setCurrentLang] = useState("EN");

  useEffect(() => {
    // читаємо localStorage тільки на клієнті
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkMode = savedTheme ? savedTheme === "dark" : prefersDark;

    const savedLang = localStorage.getItem("language") || "EN";

    setIsDarkMode(darkMode);
    setCurrentLang(savedLang);

    themeLanguageManager.setDarkMode(darkMode); // застосовуємо клас на body
    themeLanguageManager.setLanguage(savedLang);

    const unsubscribeTheme = themeLanguageManager.onThemeChange(setIsDarkMode);
    const unsubscribeLang = themeLanguageManager.onLanguageChange(setCurrentLang);

    return () => {
      unsubscribeTheme();
      unsubscribeLang();
    };
  }, []);

  const toggleDarkMode = () => themeLanguageManager.toggleDarkMode();
  const handleLangChange = (lang: string) => themeLanguageManager.setLanguage(lang);

  return { isDarkMode, currentLang, toggleDarkMode, handleLangChange };
}
