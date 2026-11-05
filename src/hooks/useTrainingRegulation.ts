import { useCallback, useEffect, useRef, useState } from "react";
import { loadTrainingRegulation, saveRegulationDraft, publishRegulation } from "@/services/trainingRegulation";
import { generateRegulationPdf } from "@/lib/trainingRegulationPdf";
import type { RegulationVersion } from "@/lib/trainingRegulation";
import initialContent from "@/assets/training-regulation.md?raw";
import { reportHandledError } from "@/lib/sentry";

export function useTrainingRegulation(onPublished: (url: string) => void) {
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [versions, setVersions] = useState<RegulationVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const saved = useRef("");
  const latest = useRef("");
  const queue = useRef(Promise.resolve());
  const failed = useCallback((cause: unknown) => {
    reportHandledError(cause);
    setError(cause instanceof Error ? cause.message : typeof cause === "object" && cause && "message" in cause ? String(cause.message) : "Enregistrement impossible");
  }, []);

  const save = useCallback((value: string) => {
    const task = queue.current.then(async () => {
      if (value === saved.current) return;
      setStatus("saving");
      await saveRegulationDraft(value, saved.current);
      saved.current = value;
      setStatus(latest.current === value ? "saved" : "unsaved");
      setError("");
    });
    queue.current = task.catch(cause => { setStatus("unsaved"); failed(cause); });
    return task;
  }, [failed]);

  useEffect(() => {
    let active = true;
    loadTrainingRegulation().then(data => {
      if (!active) return;
      saved.current = data.draft;
      latest.current = data.draft || initialContent;
      setContent(latest.current);
      setUrl(data.url);
      setVersions(data.versions);
      setStatus(data.draft ? "saved" : "unsaved");
    }).catch(failed).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [failed]);

  useEffect(() => {
    if (loading || error || latest.current === saved.current) return;
    const timer = setTimeout(() => { void save(latest.current).catch(() => undefined); }, 1500);
    return () => clearTimeout(timer);
  }, [content, loading, error, save]);

  const change = (value: string) => { latest.current = value; setContent(value); setStatus("unsaved"); };
  const publish = async () => {
    if (publishing || !latest.current.trim()) return;
    setPublishing(true);
    try {
      const snapshot = latest.current;
      await save(snapshot);
      const blob = await generateRegulationPdf(snapshot, new Date().toISOString());
      const data = await publishRegulation(snapshot, blob, url);
      setUrl(data.url); setVersions(data.versions); onPublished(data.url);
    } catch (cause) { failed(cause); }
    finally { setPublishing(false); }
  };

  return { content, change, url, versions, loading, status, error, publishing, publish, save: () => save(latest.current) };
}