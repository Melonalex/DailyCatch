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

export type Detail =
  | { kind: "paragraph"; index: number }
  | { kind: "quote"; index: number }
  | null;
