"use client";

import { useMemo, useState } from "react";
import type { Allocation, Priority } from "@/lib/schema";
import { northline, sampleBatch } from "@/lib/sample";

type Decision = {
  companyName: string;
  domain: string;
  pursue: boolean;
  fit: number;
  intent: number;
  urgency: number;
  expectedValue: number;
  confidence: number;
  priorityScore: number;
  priority: Priority;
  allocation: Allocation;
  rank: number;
  campaign: string;
  approachVariant: string | null;
  primarySignal: string | null;
  primarySignalStatus: string | null;
  contactTitle: string | null;
  channel: string;
  evidence: string[];
  reasoning: string[];
  recommendedAction: string;
  narrativeSource: "model" | "rules";
  narrativeWarning?: string;
};

const FACTORS = [
  ["fit", "Fit"],
  ["intent", "Intent"],
  ["urgency", "Urgency"],
  ["expectedValue", "Value"],
  ["confidence", "Confidence"],
] as const;

function percent(value: number): string {
  return `${Math.round(value * 100)}`;
}

export function DecisionConsole() {
  const [mode, setMode] = useState<"one" | "list">("list");
  const [body, setBody] = useState(() => JSON.stringify(sampleBatch, null, 2));
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [counts, setCounts] = useState<Record<Allocation, number> | null>(null);

  const endpoint = mode === "one" ? "/api/qualify" : "/api/prioritize";

  const summary = useMemo(() => {
    if (!decisions) return null;
    return decisions;
  }, [decisions]);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const parsed = JSON.parse(body) as unknown;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(parsed),
      });
      const payload = (await response.json()) as {
        error?: string;
        issues?: unknown;
        results?: Decision[];
        counts?: Record<Allocation, number>;
      } & Partial<Decision>;
      if (!response.ok) {
        setDecisions(null);
        setCounts(null);
        setError(
          `${payload.error ?? "Request failed"}${
            payload.issues ? `\n${JSON.stringify(payload.issues, null, 2)}` : ""
          }`,
        );
        return;
      }
      if (payload.results) {
        setDecisions(payload.results);
        setCounts(payload.counts ?? null);
      } else {
        setDecisions([payload as Decision]);
        setCounts(null);
      }
    } catch (caught) {
      setDecisions(null);
      setCounts(null);
      setError(caught instanceof Error ? caught.message : "Could not run the decision.");
    } finally {
      setPending(false);
    }
  }

  function loadSample(nextMode: "one" | "list") {
    setMode(nextMode);
    setBody(
      JSON.stringify(nextMode === "one" ? northline : sampleBatch, null, 2),
    );
    setDecisions(null);
    setCounts(null);
    setError(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8">
      <header className="border-b border-[#d9d1c3] pb-6">
        <p className="text-xs font-medium tracking-[0.18em] text-[#6d6458] uppercase">
          WSQ signal desk
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1c1915]">
          Which qualified account should sales work first?
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4e483f]">
          Clay already decides the campaign. This desk ranks the accounts that
          earned one, using fit, signal strength, urgency, value, and confidence.
          It recommends the next step. It does not email or message anyone.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadSample("one")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                mode === "one"
                  ? "bg-[#1c1915] text-[#f3efe6]"
                  : "bg-white text-[#1c1915] ring-1 ring-[#d9d1c3]"
              }`}
            >
              One account
            </button>
            <button
              type="button"
              onClick={() => loadSample("list")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                mode === "list"
                  ? "bg-[#1c1915] text-[#f3efe6]"
                  : "bg-white text-[#1c1915] ring-1 ring-[#d9d1c3]"
              }`}
            >
              Rank a list
            </button>
          </div>
          <label className="flex flex-col gap-2 text-sm text-[#4e483f]">
            Request JSON
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              spellCheck={false}
              className="min-h-[440px] rounded-lg border border-[#d9d1c3] bg-white p-3 font-mono text-xs leading-5 text-[#1c1915] outline-none focus:border-[#1c1915]"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-[#4e483f]">
            API key, if the server requires one
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              autoComplete="off"
              className="rounded-lg border border-[#d9d1c3] bg-white px-3 py-2 text-sm outline-none focus:border-[#1c1915]"
            />
          </label>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="h-11 rounded-full bg-[#1f6b4a] text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Scoring…" : mode === "one" ? "Score account" : "Rank accounts"}
          </button>
          {error ? (
            <pre className="overflow-auto rounded-lg bg-[#f8ebe6] p-3 text-xs leading-5 text-[#7a2e1f]">
              {error}
            </pre>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          {counts ? (
            <p className="text-sm text-[#4e483f]">
              Work now {counts.workNow} · Queue {counts.queue} · Later {counts.later}
            </p>
          ) : null}
          {summary ? (
            summary.map((decision) => (
              <article
                key={`${decision.domain}-${decision.rank}`}
                className="rounded-xl border border-[#d9d1c3] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-wide text-[#6d6458] uppercase">
                      Rank {decision.rank} · {decision.allocation}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{decision.companyName}</h2>
                    <p className="text-sm text-[#4e483f]">
                      {decision.domain} · {decision.campaign}
                      {decision.primarySignal
                        ? ` · ${decision.primarySignal} ${decision.primarySignalStatus}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase ${
                      decision.priority === "high"
                        ? "bg-[#e5f4ec] text-[#1f6b4a]"
                        : decision.priority === "medium"
                          ? "bg-[#f8f0dc] text-[#8a5b10]"
                          : "bg-[#eeeae3] text-[#5e584e]"
                    }`}
                  >
                    {decision.priority} {percent(decision.priorityScore)}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-5 gap-2">
                  {FACTORS.map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-[11px] tracking-wide text-[#6d6458] uppercase">
                        {label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium">{percent(decision[key])}</dd>
                      <div className="mt-1 h-1 rounded-full bg-[#eeeae3]">
                        <div
                          className="h-1 rounded-full bg-[#1c1915]"
                          style={{ width: `${percent(decision[key])}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm leading-6 text-[#1c1915]">
                  {decision.recommendedAction}
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-4 text-sm leading-5 text-[#4e483f]">
                  {decision.reasoning.map((reason, index) => (
                    <li key={`${decision.rank}-${index}`}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-[#6d6458]">
                  {decision.contactTitle ? `${decision.contactTitle} · ` : ""}
                  {decision.channel === "email"
                    ? "Work email"
                    : decision.channel === "linkedin"
                      ? "LinkedIn only"
                      : "No contact"}
                  {" · "}
                  {decision.narrativeSource === "model"
                    ? "Wording from Gemini"
                    : "Wording from the scoring rules"}
                  {decision.narrativeWarning ? ` · ${decision.narrativeWarning}` : ""}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[#d9d1c3] bg-white/60 p-5 text-sm leading-6 text-[#4e483f]">
              The sample list has one capacity slot. Northline Retail should be
              work now, Harbor Home should queue, and Desert Pantry should stay
              later because Clay marked it NO CAMPAIGN.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
