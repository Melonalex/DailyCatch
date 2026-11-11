import { useMemo } from "react";
import { wordCount } from "../format";
import type { Lesson } from "../types";
import { indexVocabulary, renderWords } from "./Vocabulary";

const TYPE_LABELS: Record<string, string> = {
  ielts: "IELTS essay",
  daily: "Everyday English",
  tech: "Technology",
  news: "News",
};

export function ArticleView({
  lesson,
  showTranslation,
  showVocabulary,
  picked,
  onPick,
}: {
  lesson: Lesson | null;
  showTranslation: boolean;
  showVocabulary: boolean;
  picked: string | null;
  onPick: (word: string | null, anchor?: DOMRect) => void;
}) {
  const vocab = useMemo(() => indexVocabulary(lesson?.vocabulary ?? []), [lesson]);
  if (!lesson) {
    return <p className="status">No short article is stored for this date.</p>;
  }
  const words = wordCount(lesson.paragraphs.join(" "));
  return (
    <article className="sheet">
      <p className="kicker">
        <span>{TYPE_LABELS[lesson.article_type] ?? lesson.article_type}</span>
        <span>{lesson.difficulty}</span>
        <span>{lesson.topic}</span>
        <span>{words} words</span>
      </p>
      <h2>{lesson.title}</h2>
      <p className="hint">Click a highlighted word.</p>
      {lesson.paragraphs.map((paragraph, index) => (
        <div className="paragraph-block" key={paragraph}>
          <p className="paragraph">
            {renderWords(paragraph, vocab, picked, onPick)}
          </p>
          {showTranslation && lesson.translation[index] && (
            <div className="paragraph-translation">
              <span>Translation</span>
              <p>{lesson.translation[index]}</p>
            </div>
          )}
        </div>
      ))}
      {showVocabulary && (
        <section className="vocab-panel">
          <h3>Key vocabulary</h3>
          {lesson.vocabulary.length === 0 ? (
            <p className="note">No vocabulary is stored for this article.</p>
          ) : (
            <ul className="vocab-list">
              {lesson.vocabulary.map((entry) => (
                <li key={entry.word}>
                  <button
                    type="button"
                    className="vocab-card"
                    onClick={(event) => onPick(entry.word.toLowerCase(), event.currentTarget.getBoundingClientRect())}
                  >
                    <span className="word">{entry.word}</span>
                    {entry.pos && <span className="pos">{entry.pos}</span>}
                    <span className="meaning">{entry.meaning}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
