import { useState } from "react";
import type { Pane } from "./types";
import { ClickFx } from "./components/ClickFx";
import { DigestView } from "./components/DigestView";
import { IconBook, IconClose, IconMenu, IconMoon, IconSun } from "./components/Icons";
import { IssueNav } from "./components/IssueNav";
import { SceneBackground } from "./components/SceneBackground";
import type { Season } from "./components/SeasonField";
import { Sidebar } from "./components/Sidebar";
import { formatDate } from "./format";
import { useAppearance } from "./hooks/useAppearance";
import { useIssues } from "./hooks/useIssues";

export function App() {
  const {
    issues,
    datesLoaded,
    selected,
    setSelected,
    digest,
    pane,
    setPane,
    error,
    ready,
  } = useIssues();
  const { theme, setTheme, season, setSeason } = useAppearance();
  const [navOpen, setNavOpen] = useState(false);
  const seasons: Season[] = ["spring", "summer", "autumn", "winter"];

  function chooseDate(date: string) {
    setSelected(date);
  }

  function choosePane(next: Pane) {
    setPane(next);
    setNavOpen(false);
  }

  return (
    <div className={navOpen ? "app nav-open" : "app"}>
      <SceneBackground theme={theme} season={season} />
      {theme === "dark" ? <ClickFx /> : null}
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
          <div className="season-switch" role="group" aria-label="Season">
            {seasons.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={season === item}
                onClick={() => {
                  setSeason(item);
                  setTheme("light");
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="theme-switch"
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <span className="knob">{theme === "dark" ? <IconMoon /> : <IconSun />}</span>
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
        <Sidebar issues={issues} selected={selected} onSelectDate={chooseDate} />
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
