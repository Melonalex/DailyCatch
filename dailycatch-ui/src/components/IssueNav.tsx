import type { Digest, Pane } from "../types";

type IssueNavProps = {
  digest: Digest | null;
  pane: Pane;
  loading: boolean;
  onSelectPane: (pane: Pane) => void;
};

export function IssueNav({ digest, pane, loading, onSelectPane }: IssueNavProps) {
  const lesson = digest?.lesson ?? null;
  return (
    <nav className="chapters" aria-label="This issue">
      <p className="rail-label">Contents</p>
      {loading && <p className="nav-empty">Loading...</p>}
      {!loading && !lesson && <p className="nav-empty">No article</p>}
      {lesson && (
        <button
          type="button"
          className={pane.kind === "article" ? "issue-row selected" : "issue-row"}
          onClick={() => onSelectPane({ kind: "article" })}
        >
          <span className="row-kicker">Article</span>
          <span className="row-title">{lesson.title}</span>
        </button>
      )}
      <p className="rail-label section">Hot topics</p>
      {!loading && (digest?.hot_topics.length ?? 0) === 0 && (
        <p className="nav-empty">None for this issue</p>
      )}
      {digest?.hot_topics.map((topic, index) => (
        <button
          key={topic.id}
          type="button"
          className={
            pane.kind === "topic" && pane.id === topic.id
              ? "issue-row selected"
              : "issue-row"
          }
          onClick={() => onSelectPane({ kind: "topic", id: topic.id })}
        >
          <span className="row-kicker">{String(index + 1).padStart(2, "0")}</span>
          <span className="row-title">{topic.title}</span>
        </button>
      ))}
    </nav>
  );
}
