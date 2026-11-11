import type { Detail, HotTopic, Lesson } from "../types";
import { IconClose } from "./Icons";

export function Preview({
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
