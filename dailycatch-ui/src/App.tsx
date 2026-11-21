import { useState } from "react";
import { DigestView } from "./components/DigestView";
import { IconClose, IconMenu } from "./components/Icons";
import { Sidebar } from "./components/Sidebar";
import { formatDate } from "./format";
import { useIssues } from "./hooks/useIssues";

export function App() {
  const {
    issues,
    datesLoaded,
    selected,
    setSelected,
    digest,
    error,
    ready,
  } = useIssues();
  const [navOpen, setNavOpen] = useState(false);

  function chooseDate(date: string) {
    setSelected(date);
    setNavOpen(false);
  }

  return (
    <div className={navOpen ? "app nav-open" : "app"}>
      <header className="top">
        <div>
          <p className="brand">DailyCatch</p>
          <p className="when">{selected ? formatDate(selected) : "No issue"}</p>
        </div>
        <button
          type="button"
          className="menu-button"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? <IconClose /> : <IconMenu />}
          <span>{navOpen ? "Close" : "Issues"}</span>
        </button>
      </header>
      <button type="button" className="scrim" aria-label="Close issues" onClick={() => setNavOpen(false)} />
      <div className="layout">
        <Sidebar issues={issues} selected={selected} onSelectDate={chooseDate} />
        <div className="read">
          <main>
            {!datesLoaded && !error && <p className="status">Loading...</p>}
            {error && <p className="status">{error}</p>}
            {datesLoaded && !selected && !error && <p className="status">No issues yet.</p>}
            {selected && !ready && !error && datesLoaded && <p className="status">Loading...</p>}
            {ready && digest && selected && <DigestView digest={digest} />}
          </main>
        </div>
      </div>
    </div>
  );
}
