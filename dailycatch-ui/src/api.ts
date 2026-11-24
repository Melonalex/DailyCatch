import type { Digest, IssueSummary } from "./types";

export async function fetchDates(): Promise<IssueSummary[]> {
  const response = await fetch("/api/dates");
  if (!response.ok) {
    throw new Error("Could not load dates.");
  }
  const body = await response.json();
  if (!Array.isArray(body)) {
    return [];
  }
  return body.map(toIssueSummary);
}

export async function fetchDigest(digestDate: string): Promise<Digest> {
  const response = await fetch(`/api/digests/${digestDate.replace(/-/g, "")}`);
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

function toIssueSummary(item: unknown): IssueSummary {
  if (typeof item === "string") {
    return { date: item, title: null, article_type: null, difficulty: null, topic: null };
  }
  const row = item as {
    date?: unknown;
    title?: string | null;
    article_type?: string | null;
    difficulty?: string | null;
    topic?: string | null;
  };
  return {
    date: String(row.date),
    title: row.title ?? null,
    article_type: row.article_type ?? null,
    difficulty: row.difficulty ?? null,
    topic: row.topic ?? null,
  };
}
