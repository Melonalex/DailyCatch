export type VocabularyEntry = {
  word: string;
  pos?: string;
  meaning: string;
  usage?: string;
  contrast?: string;
};

export type Lesson = {
  article_type: string;
  difficulty: string;
  topic: string;
  title: string;
  paragraphs: string[];
  translation: string[];
  vocabulary: VocabularyEntry[];
};

export type HotTopicQuote = {
  text: string;
  speaker: string;
  source_type: string;
  stance: string;
};

export type HotTopic = {
  id: number;
  title: string;
  overview: string;
  quotes: HotTopicQuote[];
  background: string | null;
};

export type Digest = {
  date: string;
  lesson: Lesson | null;
  hot_topics: HotTopic[];
};

export type Pane = { kind: "article" } | { kind: "topic"; id: number };

export type IssueSummary = {
  date: string;
  title: string | null;
  article_type: string | null;
  difficulty: string | null;
  topic: string | null;
};

export async function fetchDates(): Promise<IssueSummary[]> {
  const response = await fetch("/api/dates");
  if (!response.ok) {
    throw new Error("Could not load dates.");
  }
  const body = await response.json();
  if (!Array.isArray(body)) {
    return [];
  }
  return body.map((item) => {
    if (typeof item === "string") {
      return { date: item, title: null, article_type: null, difficulty: null, topic: null };
    }
    return {
      date: String(item.date),
      title: item.title ?? null,
      article_type: item.article_type ?? null,
      difficulty: item.difficulty ?? null,
      topic: item.topic ?? null,
    };
  });
}

export async function fetchDigest(digestDate: string): Promise<Digest> {
  const response = await fetch(`/api/digests/${digestDate}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body && typeof body.detail === "string" ? body.detail : "";
    throw new Error(detail || "Could not load this digest.");
  }
  const body = await response.json();
  return {
    date: body.date,
    lesson: body.lesson ?? null,
    hot_topics: body.hot_topics ?? [],
  };
}
