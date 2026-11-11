import type { Lesson, VocabularyEntry } from "../types";
import { IconClose } from "./Icons";

export function indexVocabulary(entries: VocabularyEntry[]): Map<string, VocabularyEntry> {
  const map = new Map<string, VocabularyEntry>();
  for (const entry of entries) {
    map.set(entry.word.toLowerCase(), entry);
  }
  return map;
}

export function lookup(lesson: Lesson, word: string): VocabularyEntry | null {
  return indexVocabulary(lesson.vocabulary).get(word) ?? null;
}

export function WordPopCard({
  entry,
  x,
  y,
  onClose,
}: {
  entry: VocabularyEntry | null;
  x: number;
  y: number;
  onClose: () => void;
}) {
  if (!entry) {
    return null;
  }
  return (
    <aside className="glass-pop" style={{ left: x, top: y }}>
      <div className="glass-pop-head">
        <div>
          <p className="word-label">Vocabulary</p>
          <h3>{entry.word}</h3>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>
      {entry.pos && <p className="pos-badge">{entry.pos}</p>}
      <p className="card-meaning">{entry.meaning}</p>
      {entry.usage && (
        <p className="example-line">
          <span>Usage</span>
          {entry.usage}
        </p>
      )}
      {entry.contrast && (
        <p className="example-line">
          <span>Contrast</span>
          {entry.contrast}
        </p>
      )}
    </aside>
  );
}

export function renderWords(
  text: string,
  vocab: Map<string, VocabularyEntry>,
  picked: string | null,
  onPick: (word: string | null, anchor?: DOMRect) => void,
) {
  const parts = text.split(/(\b[A-Za-z][A-Za-z'-]*\b)/);
  return parts.map((part, index) => {
    const key = part.toLowerCase();
    if (!vocab.has(key)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }
    return (
      <button
        key={`${part}-${index}`}
        type="button"
        className={picked === key ? "vocab-word active" : "vocab-word"}
        onClick={(event) => {
          event.stopPropagation();
          const next = picked === key ? null : key;
          onPick(next, next ? event.currentTarget.getBoundingClientRect() : undefined);
        }}
      >
        {part}
      </button>
    );
  });
}
