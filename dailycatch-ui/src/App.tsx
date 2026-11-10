import { useEffect, useState } from "react";
import { fetchDates, fetchDigest, type Digest, type Pane } from "./api";
import { ClickFx } from "./components/ClickFx";
import { DigestView } from "./components/DigestView";
import { IconBook, IconClose, IconMenu, IconMoon, IconSun } from "./components/Icons";
import { IssueNav } from "./components/IssueNav";
import { Sidebar } from "./components/Sidebar";
import { formatDate } from "./format";

export function App() {
  const [dates, setDates] = useState<string[]>([]);
  const [datesLoaded, setDatesLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [pane, setPane] = useState<Pane>({ kind: "article" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDates()
      .then((value) => {
        if (!active) {
          return;
        }
        setDates(value);
        setSelected(value[0] ?? null);
        setDatesLoaded(true);
      })
      .catch(() => {
        if (active) {
          setError("Could not load dates.");
          setDatesLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setDigest(null);
      return;
    }
    let active = true;
    setDigest(null);
    setPane({ kind: "article" });
    setError(null);
    fetchDigest(selected)
      .then((value) => {
        if (active) {
          setDigest(value);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const ready = digest !== null && digest.date === selected;
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [navOpen, setNavOpen] = useState(false);

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

  function chooseDate(date: string) {
    setSelected(date);
  }

  function choosePane(next: Pane) {
    setPane(next);
    setNavOpen(false);
  }

  return (
    <div className={navOpen ? "app nav-open" : "app"}>
      <ClickFx />
      <header className="topbar">
        <div className="brand-lockup">
          <IconBook className="brand-icon" />
          <div>
            <p className="eyebrow">DailyCatch</p>
            <p className="issue-name">{selected ? formatDate(selected) : "No issue"}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <p className="topbar-note">English study</p>
          <button
            type="button"
            className="theme-switch"
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <IconMoon /> : <IconSun />}
            <span className="knob" />
          </button>
          <button
            type="button"
            className="menu-button"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <IconClose /> : <IconMenu />}
            <span>{navOpen ? "Close" : "Issues"}</span>
          </button>
        </div>
      </header>
      <button
        type="button"
        className="scrim"
        aria-label="Close issues"
        onClick={() => setNavOpen(false)}
      />
      <div className="edition">
        <Sidebar dates={dates} selected={selected} onSelectDate={chooseDate} />
        <div className="spread">
          <IssueNav
            digest={ready ? digest : null}
            pane={pane}
            onSelectPane={choosePane}
            loading={Boolean(selected) && !ready && !error}
          />
          <main className="reader-pane">
          {!datesLoaded && !error && <p className="status">Loading...</p>}
          {error && <p className="status">{error}</p>}
          {datesLoaded && !selected && !error && <p className="status">No issues yet.</p>}
          {selected && !ready && !error && datesLoaded && <p className="status">Loading...</p>}
          {ready && digest && selected && (
            <DigestView digest={digest} pane={pane} />
          )}
          </main>
        </div>
      </div>
    </div>
  );
}
