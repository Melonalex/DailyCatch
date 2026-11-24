import { useEffect, useState } from "react";
import { fetchDates, fetchDigest } from "../api";
import type { Digest, IssueSummary } from "../types";

export function useIssues() {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [datesLoaded, setDatesLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDates()
      .then((value) => {
        if (!active) {
          return;
        }
        setIssues(value);
        setSelected(value[0]?.date ?? null);
        setDatesLoaded(true);
      })
      .catch(() => {
        if (active) {
          setError("Could not load dates.");
          setDatesLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setDigest(null);
      return;
    }
    let active = true;
    setDigest(null);
    setError(null);
    fetchDigest(selected)
      .then((value) => {
        if (active) {
          setDigest(value);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const ready = digest !== null && digest.date === selected;

  return {
    issues,
    datesLoaded,
    selected,
    setSelected,
    digest,
    error,
    ready,
  };
}
