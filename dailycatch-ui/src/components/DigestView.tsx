import { useEffect, useState } from "react";
import type { Digest, Detail, Pane } from "../types";
import { ArticleView } from "./ArticleView";
import { IconBook, IconEye, IconEyeOff, IconLanguage } from "./Icons";
import { HotTopicView } from "./HotTopicView";
import { Preview } from "./Preview";
import { lookup, WordPopCard } from "./Vocabulary";

const FONT_SIZES = [17, 19, 21, 23];
const FONT_KEY = "dailycatch-font-size";

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
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        setPop(null);
        return;
      }
      if (target.closest(".glass-pop") || target.closest(".vocab-word")) {
        return;
      }
      setPop(null);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

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
