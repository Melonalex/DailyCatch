import { useEffect, useState } from "react";
import type { Digest, Detail, HotTopic } from "../types";
import { ArticleView } from "./ArticleView";
import { IconBook, IconEye, IconEyeOff, IconLanguage } from "./Icons";
import { HotTopicView } from "./HotTopicView";
import { Preview } from "./Preview";
import { lookup, WordPopCard } from "./Vocabulary";

type WordPop = {
  word: string;
  x: number;
  y: number;
};

type DigestViewProps = {
  digest: Digest;
};

export function DigestView({ digest }: DigestViewProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);
  const [pop, setPop] = useState<WordPop | null>(null);
  const [quoteTopic, setQuoteTopic] = useState<HotTopic | null>(null);
  const [openQuote, setOpenQuote] = useState<number | null>(null);
  const allOpen = showTranslation && showVocabulary;

  useEffect(() => {
    setDetail(null);
    setPop(null);
    setQuoteTopic(null);
    setOpenQuote(null);
  }, [digest.date]);

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
  }

  return (
    <div className={detail ? "reader-shell with-preview" : "reader-shell"}>
      <div className="transcript">
        <div className="reader">
          <ArticleView
            key={digest.date}
            lesson={digest.lesson}
            showTranslation={showTranslation}
            showVocabulary={showVocabulary}
            picked={pickedWord}
            onPick={(word, anchor) => placePop(word, anchor)}
          />
          {digest.hot_topics.map((topic) => (
            <HotTopicView
              key={topic.id}
              topic={topic}
              openQuote={quoteTopic?.id === topic.id ? openQuote : null}
              onQuote={(index) => {
                setQuoteTopic(topic);
                setOpenQuote(openQuote === index && quoteTopic?.id === topic.id ? null : index);
                setDetail({ kind: "quote", index });
              }}
            />
          ))}
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
          topic={quoteTopic}
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
    </div>
  );
}
