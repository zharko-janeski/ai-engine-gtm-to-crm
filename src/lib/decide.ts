import { z } from "zod";
import { normalizeAccount } from "./normalize";
import { narrate, type Narrative } from "./narrate";
import {
  accountSchema,
  prioritizeRequestSchema,
  type Account,
  type Allocation,
  type Channel,
  type Priority,
  type SignalId,
  type SignalStatus,
} from "./schema";
import {
  assignCapacity,
  scoreAccount,
  type Factor,
  type ScoredAccount,
} from "./score";

export type Decision = Narrative & {
  externalId: string | null;
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
  primarySignal: SignalId | null;
  primarySignalStatus: SignalStatus | null;
  qualifiedSignals: SignalId[];
  contactTitle: string | null;
  channel: Channel;
  evidence: string[];
  factors: {
    fit: Factor;
    intent: Factor;
    urgency: Factor;
    expectedValue: Factor;
    confidence: Factor;
  };
};

export type PrioritizeResult = {
  capacity: number;
  counts: Record<Allocation, number>;
  results: Decision[];
};

function evidenceFrom(scored: ScoredAccount): string[] {
  return [
    ...scored.fit.notes,
    ...scored.intent.notes,
    ...scored.urgency.notes,
    ...scored.expectedValue.notes,
    ...scored.confidence.notes,
  ];
}

async function toDecision(
  account: Account,
  scored: ScoredAccount,
  rank: number,
): Promise<Decision> {
  const narrative = await narrate(account, scored);
  return {
    ...narrative,
    externalId: account.externalId ?? null,
    companyName: account.companyName,
    domain: account.domain,
    pursue: scored.pursue,
    fit: scored.fit.score,
    intent: scored.intent.score,
    urgency: scored.urgency.score,
    expectedValue: scored.expectedValue.score,
    confidence: scored.confidence.score,
    priorityScore: scored.priorityScore,
    priority: scored.priority,
    allocation: scored.allocation,
    rank,
    campaign: account.campaignAssignment,
    approachVariant: account.approachVariant ?? null,
    primarySignal: scored.primarySignal,
    primarySignalStatus: scored.primarySignalStatus,
    qualifiedSignals: scored.qualifiedSignals,
    contactTitle: scored.contactTitle,
    channel: scored.channel,
    evidence: evidenceFrom(scored),
    factors: {
      fit: scored.fit,
      intent: scored.intent,
      urgency: scored.urgency,
      expectedValue: scored.expectedValue,
      confidence: scored.confidence,
    },
  };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function parseAccount(input: unknown): Account {
  return accountSchema.parse(normalizeAccount(input));
}

export function formatZodError(error: z.ZodError): unknown {
  if (typeof error.flatten === "function") return error.flatten();
  return error.issues;
}

export async function qualifyAccount(input: unknown): Promise<Decision> {
  const account = parseAccount(input);
  const scored = scoreAccount(account);
  return toDecision(account, scored, 1);
}

export async function prioritizeAccounts(input: unknown): Promise<PrioritizeResult> {
  const body = Array.isArray(input) ? { accounts: input } : input;
  const normalized = prioritizeRequestSchema.parse(
    body && typeof body === "object"
      ? {
          ...(body as Record<string, unknown>),
          accounts: Array.isArray((body as { accounts?: unknown }).accounts)
            ? (body as { accounts: unknown[] }).accounts.map((account) =>
                normalizeAccount(account),
              )
            : (body as { accounts?: unknown }).accounts,
        }
      : body,
  );

  const scored = assignCapacity(
    normalized.accounts.map((account) => scoreAccount(account)),
    normalized.capacity,
  );
  const ranked = normalized.accounts
    .map((account, index) => ({ account, scored: scored[index] }))
    .sort(
      (a, b) =>
        b.scored.priorityScore - a.scored.priorityScore ||
        a.account.companyName.localeCompare(b.account.companyName),
    );

  const decisions = await mapPool(ranked, 4, ({ account, scored: item }, index) =>
    toDecision(account, item, index + 1),
  );

  const counts: Record<Allocation, number> = { workNow: 0, queue: 0, later: 0 };
  for (const decision of decisions) counts[decision.allocation] += 1;

  return {
    capacity: normalized.capacity,
    counts,
    results: decisions,
  };
}
