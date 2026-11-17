import { useState } from "react";
import { createPortal } from "react-dom";
import type { IssueSummary } from "../types";
import { formatDate, formatIssueDate, monthLabel } from "../format";

type SidebarProps = {
  issues: IssueSummary[];
  selected: string | null;
  onSelectDate: (date: string) => void;
};

type Tip = { issue: IssueSummary; top: number; left: number };

export function Sidebar({ issues, selected, onSelectDate }: SidebarProps) {
  const [tip, setTip] = useState<Tip | null>(null);

  function showTip(issue: IssueSummary | undefined, element: HTMLButtonElement) {
    if (!issue) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const width = 236;
    const left = rect.right + 12 + width > window.innerWidth ? rect.left - width - 12 : rect.right + 12;
    const top = Math.max(12, Math.min(rect.top, window.innerHeight - 132));
    setTip({ issue, top, left: Math.max(12, left) });
  }

  return (
    <aside
      className="date-rail"
      onMouseOver={(event) => {
        const button = (event.target as Element).closest?.(".date-button");
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        showTip(issueFor(issues, button.dataset.date), button);
      }}
      onMouseOut={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          return;
        }
        setTip(null);
      }}
    >
      {groupByMonth(issues).map((group) => (
        <div className="month-group" key={group.label}>
          <p className="rail-label">{group.label}</p>
          {group.dates.map((issue) => (
            <button
              key={issue.date}
              type="button"
              className={issue.date === selected ? "date-button selected" : "date-button"}
              data-date={issue.date}
              onClick={() => onSelectDate(issue.date)}
              onFocus={(event) => showTip(issue, event.currentTarget)}
              onBlur={() => setTip(null)}
            >
              <span className="date-title">{issue.title || formatDate(issue.date)}</span>
            </button>
          ))}
        </div>
      ))}
      {tip &&
        createPortal(
          <div className="rail-tip" style={{ top: tip.top, left: tip.left }} role="tooltip">
            <p>{formatIssueDate(tip.issue.date)}</p>
            {tip.issue.article_type ? (
              <p>
                {[tip.issue.article_type, tip.issue.difficulty, tip.issue.topic].filter(Boolean).join(" · ")}
              </p>
            ) : (
              <p>No lesson for this date</p>
            )}
          </div>,
          document.body,
        )}
    </aside>
  );
}

function issueFor(issues: IssueSummary[], date: string | undefined): IssueSummary | undefined {
  return issues.find((issue) => issue.date === date);
}

function groupByMonth(issues: IssueSummary[]): { label: string; dates: IssueSummary[] }[] {
  const groups: { label: string; dates: IssueSummary[] }[] = [];
  for (const issue of issues) {
    const label = monthLabel(issue.date);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) {
      groups.push({ label, dates: [issue] });
    } else {
      last.dates.push(issue);
    }
  }
  return groups;
}
