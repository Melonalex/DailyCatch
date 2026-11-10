import { useEffect, useMemo, useState } from "react";
import type { Digest, HotTopic, Lesson, Pane, VocabularyEntry } from "../api";
import { wordCount } from "../format";
import { IconBook, IconClose, IconEye, IconEyeOff, IconLanguage } from "./Icons";

const TYPE_LABELS: Record<string, string> = {
  ielts: "IELTS essay",
  daily: "Everyday English",
  tech: "Technology",
  news: "News",
};

const FONT_SIZES = [17, 19, 21, 23];
const FONT_KEY = "dailycatch-font-size";

type Detail =
  | { kind: "paragraph"; index: number }
  | { kind: "quote"; index: number }
  | null;

type WordPop = {
  word: string;
  x: number;
  y: number;
};

type DigestViewProps = {
  digest: Digest;
  pane: Pane;
};

export function DigestView({ digest, pane }: DigestViewProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [detail, setDetail] = useState<Detail>(null);
  const [pop, setPop] = useState<WordPop | null>(null);
  const [openQuote, setOpenQuote] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const topic =
    pane.kind === "topic"
      ? digest.hot_topics.find((item) => item.id === pane.id) ?? null
      : null;
  const allOpen = showTranslation && showVocabulary;

  useEffect(() => {
    const stored = window.localStorage.getItem(FONT_KEY);
    const parsed = stored ? Number(stored) : 19;
    if (FONT_SIZES.includes(parsed)) {
      setFontSize(parsed);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setPop(null);
    setOpenQuote(null);
    setProgress(0);
  }, [digest.date, pane]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "t" || event.key === "T") {
        setShowTranslation((current) => !current);
      }
      if (event.key === "Escape") {
        setDetail(null);
        setPop(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function changeFont(next: number) {
    setFontSize(next);
    window.localStorage.setItem(FONT_KEY, String(next));
  }

  function setBoth(next: boolean) {
    setShowTranslation(next);
    setShowVocabulary(next);
  }

  const pickedWord = pop?.word ?? null;

  function placePop(word: string | null, anchor?: DOMRect) {
    if (!word || !anchor) {
      setPop(null);
      return;
    }
    const width = 300;
    const left = Math.min(Math.max(12, anchor.left), window.innerWidth - width - 12);
    const top = Math.min(anchor.bottom + 10, window.innerHeight - 220);
    setPop({ word, x: left, y: top });
    setBurst({
      id: Date.now(),
      x: anchor.left + anchor.width / 2,
      y: anchor.top + anchor.height / 2,
    });
  }

  return (
    <div className={detail ? "reader-shell with-preview" : "reader-shell"}>
      <div className="transcript">
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="reader-toolbar">
          <p className="mono-meta">
            {topic ? "hot-topic" : digest.lesson?.article_type ?? "empty"} · {fontSize}px
          </p>
          <div className="font-controls">
            <button
              type="button"
              className="icon-button"
              onClick={() => changeFont(Math.max(FONT_SIZES[0], fontSize - 2))}
              aria-label="Smaller text"
            >
              A-
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => changeFont(Math.min(FONT_SIZES[FONT_SIZES.length - 1], fontSize + 2))}
              aria-label="Larger text"
            >
              A+
            </button>
          </div>
        </div>
        <div
          className="reader"
          style={{ fontSize: `${fontSize}px` }}
          onScroll={(event) => {
            const element = event.currentTarget;
            const range = element.scrollHeight - element.clientHeight;
            setProgress(range <= 0 ? 0 : element.scrollTop / range);
          }}
        >
          {topic ? (
            <HotTopicView
              key={topic.id}
              topic={topic}
              openQuote={openQuote}
              onQuote={(index) => {
                setOpenQuote(openQuote === index ? null : index);
                setDetail({ kind: "quote", index });
              }}
            />
          ) : (
            <ArticleView
              key={digest.date}
              lesson={digest.lesson}
              showTranslation={showTranslation}
              showVocabulary={showVocabulary}
              picked={pickedWord}
              onPick={(word, anchor) => placePop(word, anchor)}
            />
          )}
        </div>
        <div className="composer" role="group" aria-label="Reading tools">
          <button
            type="button"
            className="pill"
            aria-pressed={showTranslation}
            onClick={() => setShowTranslation((current) => !current)}
          >
            {showTranslation ? <IconEyeOff /> : <IconLanguage />}
            <span>{showTranslation ? "Hide Translation" : "Show Translation"}</span>
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={showVocabulary}
            onClick={() => setShowVocabulary((current) => !current)}
          >
            {showVocabulary ? <IconEyeOff /> : <IconBook />}
            <span>{showVocabulary ? "Hide Vocabulary" : "Show Vocabulary"}</span>
          </button>
          <button
            type="button"
            className="pill pill-primary"
            aria-pressed={!allOpen}
            onClick={() => setBoth(!allOpen)}
          >
            {allOpen ? <IconEyeOff /> : <IconEye />}
            <span>{allOpen ? "English Only" : "Show All"}</span>
          </button>
        </div>
      </div>
      <aside className={detail ? "preview open" : "preview"} aria-label="Detail">
        <Preview
          lesson={digest.lesson}
          topic={topic}
          detail={detail}
          onClose={() => setDetail(null)}
        />
      </aside>
      {pop && digest.lesson && (
        <WordPopCard
          entry={lookup(digest.lesson, pop.word)}
          x={pop.x}
          y={pop.y}
          onClose={() => setPop(null)}
        />
      )}
      {burst && <span key={burst.id} className="click-burst" style={{ left: burst.x, top: burst.y }} />}
    </div>
  );
}

function ArticleView({
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

function HotTopicView({
  topic,
  openQuote,
  onQuote,
}: {
  topic: HotTopic;
  openQuote: number | null;
  onQuote: (index: number) => void;
}) {
  return (
    <article className="sheet">
      <p className="kicker">
        <span>Hot topic</span>
      </p>
      <h2>{topic.title}</h2>
      <p className="paragraph">{topic.overview}</p>
      <div className="quotes">
        {topic.quotes.map((quote, index) => (
          <button
            key={`${quote.speaker}-${quote.text}`}
            type="button"
            className={openQuote === index ? "quote open" : "quote"}
            onClick={() => onQuote(index)}
          >
            <span className="quote-head">
              <span className="tag">{quote.source_type}</span>
              <span className="tag">{quote.stance}</span>
              <span>{quote.speaker}</span>
            </span>
            <span className="quote-text">{quote.text}</span>
          </button>
        ))}
      </div>
      {topic.background && <p className="background">{topic.background}</p>}
    </article>
  );
}

function Preview({
  lesson,
  topic,
  detail,
  onClose,
}: {
  lesson: Lesson | null;
  topic: HotTopic | null;
  detail: Detail;
  onClose: () => void;
}) {
  return (
    <div className="preview-inner">
      <header className="preview-head">
        <p>{detail ? detail.kind : "Detail"}</p>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </header>
      {!detail && <p className="note">Click a paragraph or a quote.</p>}
      {detail?.kind === "paragraph" && lesson && (
        <div className="preview-body">
          <p className="preview-en">{lesson.paragraphs[detail.index]}</p>
          <p className="preview-zh">{lesson.translation[detail.index] ?? "No translation for this paragraph."}</p>
        </div>
      )}
      {detail?.kind === "quote" && topic && (
        <div className="preview-body">
          <p className="preview-en">{topic.quotes[detail.index]?.text}</p>
          <p className="note">
            {topic.quotes[detail.index]?.speaker} · {topic.quotes[detail.index]?.source_type} ·{" "}
            {topic.quotes[detail.index]?.stance}
          </p>
          {topic.background && <p className="preview-zh">{topic.background}</p>}
        </div>
      )}
    </div>
  );
}

function indexVocabulary(entries: VocabularyEntry[]): Map<string, VocabularyEntry> {
  const map = new Map<string, VocabularyEntry>();
  for (const entry of entries) {
    map.set(entry.word.toLowerCase(), entry);
  }
  return map;
}

function lookup(lesson: Lesson, word: string): VocabularyEntry | null {
  return indexVocabulary(lesson.vocabulary).get(word) ?? null;
}

function WordPopCard({
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

function renderWords(
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
