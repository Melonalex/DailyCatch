import type { HotTopic } from "../types";

export function HotTopicView({
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
