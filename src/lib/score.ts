import {
  SIGNAL_IDS,
  type Account,
  type Allocation,
  type CapacityStatus,
  type Channel,
  type Priority,
  type SignalId,
  type SignalStatus,
} from "./schema";

export const WEIGHTS = {
  fit: 0.22,
  intent: 0.3,
  urgency: 0.28,
  expectedValue: 0.2,
} as const;

export const HIGH_BAND = 0.72;
export const MEDIUM_BAND = 0.48;

const STATUS_SCORE: Record<SignalStatus, number> = {
  CONFIRMED: 1,
  POSSIBLE: 0.62,
  "NOT QUALIFIED": 0.05,
  "NOT RESEARCHED": 0.35,
};

export type Factor = {
  score: number;
  notes: string[];
};

export type ScoredAccount = {
  pursue: boolean;
  fit: Factor;
  intent: Factor;
  urgency: Factor;
  expectedValue: Factor;
  confidence: Factor;
  priorityScore: number;
  priority: Priority;
  allocation: Allocation;
  channel: Channel;
  contactTitle: string | null;
  primarySignal: SignalId | null;
  primarySignalStatus: SignalStatus | null;
  qualifiedSignals: SignalId[];
};

export function roundScore(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

function countryScore(country: string | undefined, notes: string[]): number {
  if (!country) {
    notes.push("Country was not provided, so ICP fit is only partial.");
    return 0.45;
  }
  const value = country.toLowerCase();
  const matches =
    /\bunited kingdom\b|\buk\b|\bgreat britain\b|\bengland\b/.test(value) ||
    /saudi|\bksa\b|\bsa\b/.test(value);
  if (matches) {
    notes.push(`${country} is inside the UK and Saudi Arabia ICP.`);
    return 1;
  }
  notes.push(`${country} is outside the UK and Saudi Arabia ICP.`);
  return 0.2;
}

function sizeBand(employeeSize: string | undefined): {
  min: number;
  max: number;
} | null {
  if (!employeeSize) return null;
  const normalized = employeeSize.replace(/[–—]/g, "-");
  const numbers = normalized.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;
  if (numbers.length === 1) {
    const plus = /\+/.test(normalized);
    return { min: numbers[0], max: plus ? numbers[0] + 5000 : numbers[0] };
  }
  return { min: numbers[0], max: numbers[1] };
}

function overlapsIcp(min: number, max: number): boolean {
  return max >= 51 && min <= 500;
}

function sizeScore(employeeSize: string | undefined, notes: string[]): number {
  const band = sizeBand(employeeSize);
  if (!band || !employeeSize) {
    notes.push("Employee size was not provided.");
    return 0.5;
  }
  if (overlapsIcp(band.min, band.max) && band.min >= 51 && band.max <= 500) {
    notes.push(`${employeeSize} sits inside the 51–500 employee ICP.`);
    return 1;
  }
  if (overlapsIcp(band.min, band.max)) {
    notes.push(`${employeeSize} overlaps the 51–500 employee ICP.`);
    return 0.7;
  }
  const adjacent = band.max >= 11 && band.min <= 1000;
  if (adjacent) {
    notes.push(`${employeeSize} is adjacent to the 51–500 employee ICP.`);
    return 0.45;
  }
  notes.push(`${employeeSize} is outside the 51–500 employee ICP.`);
  return 0.2;
}

function industryScore(industry: string | undefined, notes: string[]): number {
  if (!industry) {
    notes.push("Industry was not provided.");
    return 0.5;
  }
  const value = industry.toLowerCase();
  if (/retail|apparel|fashion|consumer/.test(value)) {
    notes.push(`${industry} matches the retail and consumer ICP.`);
    return 1;
  }
  notes.push(`${industry} is outside retail and consumer goods.`);
  return 0.25;
}

function qualifying(status: SignalStatus): boolean {
  return status === "CONFIRMED" || status === "POSSIBLE";
}

export function derivePrimarySignal(account: Account): SignalId | null {
  if (account.primarySignal) return account.primarySignal;
  const confirmed = SIGNAL_IDS.find((id) => account.signals[id] === "CONFIRMED");
  if (confirmed) return confirmed;
  return SIGNAL_IDS.find((id) => account.signals[id] === "POSSIBLE") ?? null;
}

export function listQualifiedSignals(account: Account): SignalId[] {
  const fromInput = account.qualifiedSignals?.filter((id) =>
    qualifying(account.signals[id]),
  );
  if (fromInput && fromInput.length > 0) return fromInput;
  return SIGNAL_IDS.filter((id) => qualifying(account.signals[id]));
}

function evidenceWeight(value: string | boolean | undefined): number {
  if (value === true) return 0.06;
  if (value === false || value == null) return 0;
  const status = value.toUpperCase();
  if (status === "CONFIRMED") return 0.1;
  if (status === "POSSIBLE") return 0.05;
  if (
    status === "NOT QUALIFIED" ||
    status === "NOT RESEARCHED" ||
    status === "NOT FOUND" ||
    status === "NO"
  ) {
    return 0;
  }
  return value.trim().length > 20 ? 0.05 : 0;
}

function evidenceNote(
  label: string,
  value: string | boolean | undefined,
): string | null {
  if (value == null || value === false) return null;
  if (value === true) return `${label} is present.`;
  const status = value.toUpperCase();
  if (status === "NOT QUALIFIED" || status === "NOT RESEARCHED" || status === "NOT FOUND") {
    return null;
  }
  if (status === "CONFIRMED" || status === "POSSIBLE") {
    return `${label} is ${status}.`;
  }
  return `${label}: ${value}`;
}

function textLength(value: string | undefined): number {
  return value?.trim().length ?? 0;
}

export function isNoCampaign(campaign: string): boolean {
  return campaign.trim().toUpperCase() === "NO CAMPAIGN";
}

function bandFor(score: number): Priority {
  if (score >= HIGH_BAND) return "high";
  if (score >= MEDIUM_BAND) return "medium";
  return "low";
}

export function allocationFor(priority: Priority, pursue: boolean): Allocation {
  if (!pursue || priority === "low") return "later";
  if (priority === "high") return "workNow";
  return "queue";
}

export function scoreAccount(account: Account): ScoredAccount {
  const fitNotes: string[] = [];
  const fit = roundScore(
    countryScore(account.country, fitNotes) * 0.7 +
      sizeScore(account.employeeSize, fitNotes) * 0.15 +
      industryScore(account.industry, fitNotes) * 0.15,
  );

  const primarySignal = derivePrimarySignal(account);
  const primarySignalStatus = primarySignal ? account.signals[primarySignal] : null;
  const qualifiedSignals = listQualifiedSignals(account);
  const confirmedCount = SIGNAL_IDS.filter(
    (id) => account.signals[id] === "CONFIRMED",
  ).length;
  const possibleCount = SIGNAL_IDS.filter(
    (id) => account.signals[id] === "POSSIBLE",
  ).length;
  const notResearchedCount = SIGNAL_IDS.filter(
    (id) => account.signals[id] === "NOT RESEARCHED",
  ).length;

  const intentNotes: string[] = [];
  const primaryScore = primarySignalStatus ? STATUS_SCORE[primarySignalStatus] : 0.2;
  const extraQualifying = qualifiedSignals.filter((id) => id !== primarySignal).length;
  if (primarySignal && primarySignalStatus) {
    intentNotes.push(`Primary signal ${primarySignal} is ${primarySignalStatus}.`);
  } else {
    intentNotes.push("No primary signal was set.");
  }
  const extras = qualifiedSignals.filter((id) => id !== primarySignal);
  if (extras.length > 0) {
    intentNotes.push(
      `Other qualifying signals: ${extras
        .map((id) => `${id} ${account.signals[id]}`)
        .join(", ")}.`,
    );
  }
  const intent = roundScore(
    Math.min(1, primaryScore * 0.82 + extraQualifying * 0.06 + (confirmedCount >= 2 ? 0.06 : 0)),
  );

  const urgencyNotes: string[] = [];
  const capacityScore: Record<CapacityStatus, number> = {
    CONFIRMED: 1,
    POSSIBLE: 0.68,
    "NOT FOUND": 0.12,
  };
  let urgencyRaw = account.capacityPressure
    ? capacityScore[account.capacityPressure]
    : 0.35;
  if (account.capacityPressure) {
    urgencyNotes.push(`Capacity pressure is ${account.capacityPressure}.`);
  } else {
    urgencyNotes.push("Capacity pressure was not provided.");
  }
  if (
    account.capacityPressure &&
    account.capacityPressure !== "NOT FOUND" &&
    account.contractEngineeringHiring
  ) {
    urgencyRaw += 0.08;
    urgencyNotes.push("Contract or flexible engineering hiring is present.");
  }
  if (
    account.capacityPressure &&
    account.capacityPressure !== "NOT FOUND" &&
    (account.engineeringJobCount ?? 0) >= 3
  ) {
    urgencyRaw += 0.04;
    urgencyNotes.push(`${account.engineeringJobCount} relevant engineering roles are open.`);
  }
  for (const [label, value] of [
    ["India/Asia expansion", account.indiaAsiaExpansion],
    ["Platform expansion", account.platformExpansion],
    ["Offshore or vendor change", account.offshoreVendorChange],
  ] as const) {
    urgencyRaw += evidenceWeight(value);
    const note = evidenceNote(label, value);
    if (note) urgencyNotes.push(note);
  }
  const urgency = roundScore(urgencyRaw);

  const valueNotes: string[] = [];
  const band = sizeBand(account.employeeSize);
  let valueRaw = 0.55;
  if (!band) {
    valueNotes.push("Commercial value uses a neutral size because headcount is missing.");
  } else if (band.min >= 201 && band.max <= 500) {
    valueRaw = 0.9;
    valueNotes.push("Headcount is in the upper half of the ICP, which supports a larger delivery need.");
  } else if (overlapsIcp(band.min, band.max)) {
    valueRaw = 0.74;
    valueNotes.push("Headcount is inside the ICP band.");
  } else {
    valueRaw = 0.4;
    valueNotes.push("Headcount sits outside the core ICP band, so expected value is lower.");
  }
  if (confirmedCount >= 2) {
    valueRaw += 0.08;
    valueNotes.push("More than one signal is CONFIRMED.");
  }
  if (account.platformExpansion === true || account.platformExpansion === "CONFIRMED") {
    valueRaw += 0.05;
    valueNotes.push("Platform expansion supports a funded delivery need.");
  }
  const expectedValue = roundScore(valueRaw);

  const confidenceNotes: string[] = [];
  let confidenceRaw = 0.34;
  if (textLength(account.primarySignalEvidence) > 40) {
    confidenceRaw += 0.16;
    confidenceNotes.push("Primary signal evidence is recorded.");
  } else {
    confidenceNotes.push("Primary signal evidence is missing or very short.");
  }
  if (textLength(account.evidenceSummary) > 40) {
    confidenceRaw += 0.1;
    confidenceNotes.push("Engineering hiring evidence is recorded.");
  }
  if (textLength(account.newsEvidenceSummary) > 40) {
    confidenceRaw += 0.08;
    confidenceNotes.push("News evidence is recorded.");
  }
  if (account.capacityPressure) confidenceRaw += 0.06;
  if (account.contact?.jobTitle) {
    confidenceRaw += 0.08;
    confidenceNotes.push(`Decision-maker title on file: ${account.contact.jobTitle}.`);
  } else {
    confidenceNotes.push("No decision-maker title was provided.");
  }
  if (account.contact?.workEmailFound === true) {
    confidenceRaw += 0.05;
    confidenceNotes.push("A work email was found.");
  } else if (account.contact?.workEmailFound === false) {
    confidenceRaw += 0.03;
    confidenceNotes.push("No work email was found. LinkedIn is the available channel.");
  }
  if (primarySignalStatus === "NOT RESEARCHED") {
    confidenceRaw -= 0.12;
    confidenceNotes.push("The primary signal is NOT RESEARCHED, so this is incomplete research rather than a rejection.");
  }
  if (notResearchedCount >= 4) {
    confidenceRaw -= 0.08;
    confidenceNotes.push(`${notResearchedCount} of 6 signals are NOT RESEARCHED.`);
  }
  if (!account.country || !account.industry) confidenceRaw -= 0.05;
  const confidence = roundScore(Math.min(0.95, Math.max(0.15, confidenceRaw)));

  const base =
    WEIGHTS.fit * fit +
    WEIGHTS.intent * intent +
    WEIGHTS.urgency * urgency +
    WEIGHTS.expectedValue * expectedValue;
  let priorityScore = roundScore(base * (0.55 + 0.45 * confidence));

  const pursue = !isNoCampaign(account.campaignAssignment);
  let priority = bandFor(priorityScore);

  if (!pursue) {
    priority = "low";
    priorityScore = Math.min(priorityScore, 0.35);
    intentNotes.push("Campaign assignment is NO CAMPAIGN, so the account is not queued.");
  } else if (confirmedCount === 0 && possibleCount === 0) {
    priority = "low";
    priorityScore = Math.min(priorityScore, MEDIUM_BAND - 0.01);
    intentNotes.push("No signal is POSSIBLE or CONFIRMED.");
  } else if (confirmedCount === 0 && priority === "high") {
    priority = "medium";
    intentNotes.push("Only POSSIBLE signals are present, so priority is capped at medium.");
  } else if (fit < 0.45 && priority === "high") {
    priority = "medium";
    fitNotes.push("Weak ICP fit keeps a strong signal from ranking high.");
  }

  const channel: Channel =
    account.contact?.workEmailFound === true
      ? "email"
      : account.contact
        ? "linkedin"
        : "none";

  return {
    pursue,
    fit: { score: fit, notes: fitNotes },
    intent: { score: intent, notes: intentNotes },
    urgency: { score: urgency, notes: urgencyNotes },
    expectedValue: { score: expectedValue, notes: valueNotes },
    confidence: { score: confidence, notes: confidenceNotes },
    priorityScore,
    priority,
    allocation: allocationFor(priority, pursue),
    channel,
    contactTitle: account.contact?.jobTitle ?? null,
    primarySignal,
    primarySignalStatus,
    qualifiedSignals,
  };
}

export function assignCapacity(
  scored: ScoredAccount[],
  capacity: number,
): ScoredAccount[] {
  const order = scored
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.priorityScore - a.item.priorityScore || a.index - b.index);

  let slots = 0;
  const allocated = order.map(({ item }) => {
    if (!item.pursue || item.priority === "low") {
      return { ...item, allocation: "later" as const };
    }
    if (slots < capacity) {
      slots += 1;
      return { ...item, allocation: "workNow" as const };
    }
    return { ...item, allocation: "queue" as const };
  });

  const byIndex = new Map(order.map(({ index }, position) => [index, allocated[position]]));
  return scored.map((_, index) => byIndex.get(index)!);
}
