import {
  CAPACITY_STATUSES,
  SIGNAL_IDS,
  SIGNAL_STATUSES,
  type CapacityStatus,
  type SignalId,
  type SignalStatus,
} from "./schema";

const FIELD_ALIASES: Record<string, string> = {
  "external id": "externalId",
  "row id": "externalId",
  id: "externalId",
  "company name": "companyName",
  company: "companyName",
  name: "companyName",
  domain: "domain",
  website: "domain",
  industry: "industry",
  "employee size": "employeeSize",
  employees: "employeeSize",
  "employee count": "employeeSize",
  country: "country",
  "capacity pressure": "capacityPressure",
  "engineering job count": "engineeringJobCount",
  "engineering job titles": "engineeringJobTitles",
  "contract engineering hiring": "contractEngineeringHiring",
  "evidence summary": "evidenceSummary",
  "india asia expansion": "indiaAsiaExpansion",
  "platform expansion": "platformExpansion",
  "offshore vendor change": "offshoreVendorChange",
  "news evidence summary": "newsEvidenceSummary",
  "qualified signals": "qualifiedSignals",
  "primary signal": "primarySignal",
  "campaign assignment": "campaignAssignment",
  campaign: "campaignAssignment",
  "approach variant": "approachVariant",
  variant: "approachVariant",
  "primary signal evidence": "primarySignalEvidence",
  "job title": "jobTitle",
  title: "jobTitle",
  "work email found": "workEmailFound",
  "outreach channel": "outreachChannel",
  channel: "outreachChannel",
  contact: "contact",
  signals: "signals",
};

function canonicalKey(key: string): string {
  const compact = key.trim();
  if (/^[ab][123]$/i.test(compact)) return compact.toUpperCase();
  const spaced = compact
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return FIELD_ALIASES[spaced] ?? compact;
}

function cleanText(value: string): string | undefined {
  const text = value.trim();
  return text.length > 0 ? text : undefined;
}

export function normalizeStatus(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "boolean") return value ? "CONFIRMED" : "NOT QUALIFIED";
  const raw = String(value)
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (raw.length === 0) return undefined;
  if (raw === "CONFIRMED" || raw === "YES" || raw === "TRUE") return "CONFIRMED";
  if (raw === "POSSIBLE") return "POSSIBLE";
  if (
    raw === "NOT QUALIFIED" ||
    raw === "UNQUALIFIED" ||
    raw === "NO" ||
    raw === "FALSE"
  ) {
    return "NOT QUALIFIED";
  }
  if (raw === "NOT RESEARCHED" || raw === "PENDING") return "NOT RESEARCHED";
  if (raw === "NOT FOUND") return "NOT FOUND";
  return String(value).trim();
}

function asSignalStatus(value: unknown): SignalStatus {
  const status = normalizeStatus(value);
  if (status && SIGNAL_STATUSES.includes(status as SignalStatus)) {
    return status as SignalStatus;
  }
  return "NOT RESEARCHED";
}

function asCapacity(value: unknown): CapacityStatus | undefined {
  const status = normalizeStatus(value);
  if (!status) return undefined;
  if (status === "NOT QUALIFIED") return "NOT FOUND";
  if (CAPACITY_STATUSES.includes(status as CapacityStatus)) {
    return status as CapacityStatus;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const status = normalizeStatus(value);
  if (status === "CONFIRMED" || status === "POSSIBLE") return true;
  if (status === "NOT QUALIFIED" || status === "NOT FOUND") return false;
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => cleanText(String(item)))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === "string") {
    const items = value
      .split(/[\n,|;]+/)
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function asCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Math.trunc(Number(value));
  }
  return undefined;
}

function asEvidence(value: unknown): string | boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value > 0;
  const text = typeof value === "string" ? cleanText(value) : undefined;
  if (!text) return undefined;
  const status = normalizeStatus(text);
  if (status === "CONFIRMED" || status === "POSSIBLE" || status === "NOT QUALIFIED" || status === "NOT RESEARCHED" || status === "NOT FOUND") {
    return status === "NOT FOUND" ? "NOT QUALIFIED" : status;
  }
  return text;
}

function emailFound(value: unknown, channel: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const fromValue = asBoolean(value);
  if (fromValue !== undefined && typeof value !== "string") return fromValue;
  const channelText = String(channel ?? value ?? "")
    .trim()
    .toLowerCase();
  if (!channelText) return fromValue;
  if (channelText.includes("linkedin only") || channelText === "linkedin") return false;
  if (channelText.includes("email")) return true;
  return fromValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAccount(input: unknown): unknown {
  if (!isRecord(input)) return input;

  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    flat[canonicalKey(key)] = value;
  }

  const signals: Record<string, SignalStatus> = {};
  if (isRecord(flat.signals)) {
    for (const [key, value] of Object.entries(flat.signals)) {
      const id = canonicalKey(key);
      if (SIGNAL_IDS.includes(id as SignalId)) {
        signals[id] = asSignalStatus(value);
      }
    }
  }
  for (const id of SIGNAL_IDS) {
    if (flat[id] !== undefined) signals[id] = asSignalStatus(flat[id]);
    if (!signals[id]) signals[id] = "NOT RESEARCHED";
  }

  const contact = isRecord(flat.contact) ? { ...flat.contact } : {};
  for (const [key, value] of Object.entries(contact)) {
    contact[canonicalKey(key)] = value;
  }
  const jobTitle =
    cleanText(String(flat.jobTitle ?? contact.jobTitle ?? "")) ??
    (typeof contact.jobTitle === "string" ? cleanText(contact.jobTitle) : undefined);
  const workEmailFound = emailFound(
    flat.workEmailFound ?? contact.workEmailFound,
    flat.outreachChannel ?? contact.outreachChannel,
  );

  const qualified = asStringList(flat.qualifiedSignals)
    ?.map((item) => item.toUpperCase())
    .filter((item): item is SignalId => SIGNAL_IDS.includes(item as SignalId));

  const primary = normalizeStatus(flat.primarySignal)?.match(/^[AB][123]$/)
    ? (String(flat.primarySignal).trim().toUpperCase() as SignalId)
    : typeof flat.primarySignal === "string" &&
        SIGNAL_IDS.includes(flat.primarySignal.trim().toUpperCase() as SignalId)
      ? (flat.primarySignal.trim().toUpperCase() as SignalId)
      : undefined;

  return {
    externalId:
      flat.externalId == null ? undefined : cleanText(String(flat.externalId)),
    companyName: cleanText(String(flat.companyName ?? "")),
    domain: cleanText(String(flat.domain ?? "")),
    industry: typeof flat.industry === "string" ? cleanText(flat.industry) : undefined,
    employeeSize:
      typeof flat.employeeSize === "string" || typeof flat.employeeSize === "number"
        ? cleanText(String(flat.employeeSize))
        : undefined,
    country: typeof flat.country === "string" ? cleanText(flat.country) : undefined,
    capacityPressure: asCapacity(flat.capacityPressure),
    engineeringJobCount: asCount(flat.engineeringJobCount),
    engineeringJobTitles: asStringList(flat.engineeringJobTitles),
    contractEngineeringHiring: asBoolean(flat.contractEngineeringHiring),
    evidenceSummary:
      typeof flat.evidenceSummary === "string"
        ? cleanText(flat.evidenceSummary)
        : undefined,
    indiaAsiaExpansion: asEvidence(flat.indiaAsiaExpansion),
    platformExpansion: asEvidence(flat.platformExpansion),
    offshoreVendorChange: asEvidence(flat.offshoreVendorChange),
    newsEvidenceSummary:
      typeof flat.newsEvidenceSummary === "string"
        ? cleanText(flat.newsEvidenceSummary)
        : undefined,
    signals,
    qualifiedSignals: qualified,
    primarySignal: primary,
    campaignAssignment: cleanText(String(flat.campaignAssignment ?? "")),
    approachVariant:
      typeof flat.approachVariant === "string"
        ? cleanText(flat.approachVariant)
        : undefined,
    primarySignalEvidence:
      typeof flat.primarySignalEvidence === "string"
        ? cleanText(flat.primarySignalEvidence)
        : undefined,
    contact:
      jobTitle || workEmailFound !== undefined
        ? {
            jobTitle,
            workEmailFound,
          }
        : undefined,
  };
}
