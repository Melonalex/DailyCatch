import { formatDate, monthLabel } from "../format";

type SidebarProps = {
  dates: string[];
  selected: string | null;
  onSelectDate: (date: string) => void;
};

export function Sidebar({ dates, selected, onSelectDate }: SidebarProps) {
  return (
    <aside className="date-rail">
      {groupByMonth(dates).map((group) => (
        <div className="month-group" key={group.label}>
          <p className="rail-label">{group.label}</p>
          {group.dates.map((date) => (
            <button
              key={date}
              type="button"
              className={date === selected ? "date-button selected" : "date-button"}
              onClick={() => onSelectDate(date)}
            >
              {formatDate(date).replace(/ \d{4}$/, "")}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

function groupByMonth(dates: string[]): { label: string; dates: string[] }[] {
  const groups: { label: string; dates: string[] }[] = [];
  for (const date of dates) {
    const label = monthLabel(date);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) {
      groups.push({ label, dates: [date] });
    } else {
      last.dates.push(date);
    }
  }
  return groups;
}
