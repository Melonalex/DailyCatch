import type { HotTopic } from "../types";

export function HotTopicView({ topic }: { topic: HotTopic }) {
  return (
    <article className="hot-item">
      <h3 className="hot-title">{topic.title}</h3>
      <p className="hot-body">{topic.overview}</p>
      <ul className="hot-quotes">
        {topic.quotes.map((quote) => (
          <li className="hot-quote" key={`${quote.speaker}-${quote.text}`}>
            <p>{quote.text}</p>
            <span className="hot-tag">
              {quote.source_type} · {quote.speaker} · {quote.stance}
            </span>
          </li>
        ))}
      </ul>
      {topic.background && <p className="hot-note">{topic.background}</p>}
    </article>
  );
}
