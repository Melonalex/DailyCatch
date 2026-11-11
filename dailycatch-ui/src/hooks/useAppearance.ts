import { useEffect, useState } from "react";
import { seasonFor, type Season } from "../components/SeasonField";

export function useAppearance() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [season, setSeason] = useState<Season>(() => seasonFor());

  useEffect(() => {
    const stored = window.localStorage.getItem("dailycatch-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("dailycatch-theme", theme);
  }, [theme]);

  useEffect(() => {
    const stored = window.localStorage.getItem("dailycatch-season");
    if (stored === "spring" || stored === "summer" || stored === "autumn" || stored === "winter") {
      setSeason(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dailycatch-season", season);
  }, [season]);

  return { theme, setTheme, season, setSeason };
}
