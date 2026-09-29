import { z } from "zod";

export const SIGNAL_IDS = ["A1", "A2", "A3", "B1", "B2", "B3"] as const;
export type SignalId = (typeof SIGNAL_IDS)[number];

export const SIGNAL_STATUSES = [
  "NOT RESEARCHED",
  "NOT QUALIFIED",
  "POSSIBLE",
  "CONFIRMED",
] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const CAPACITY_STATUSES = ["NOT FOUND", "POSSIBLE", "CONFIRMED"] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ALLOCATIONS = ["workNow", "queue", "later"] as const;
export type Allocation = (typeof ALLOCATIONS)[number];

export const CHANNELS = ["email", "linkedin", "none"] as const;
export type Channel = (typeof CHANNELS)[number];

const signalStatusSchema = z.enum(SIGNAL_STATUSES);
const evidenceSchema = z.union([z.string().max(4000), z.boolean()]);

export const contactSchema = z.object({
  jobTitle: z.string().min(1).max(200).optional(),
  workEmailFound: z.boolean().optional(),
});

export const signalsSchema = z.object({
  A1: signalStatusSchema,
  A2: signalStatusSchema,
  A3: signalStatusSchema,
  B1: signalStatusSchema,
  B2: signalStatusSchema,
  B3: signalStatusSchema,
});

export const accountSchema = z.object({
  externalId: z.string().min(1).max(200).optional(),
  companyName: z.string().min(1).max(300),
  domain: z.string().min(1).max(300),
  industry: z.string().max(200).optional(),
  employeeSize: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  capacityPressure: z.enum(CAPACITY_STATUSES).optional(),
  engineeringJobCount: z.number().int().nonnegative().max(10_000).optional(),
  engineeringJobTitles: z.array(z.string().min(1).max(200)).max(40).optional(),
  contractEngineeringHiring: z.boolean().optional(),
  evidenceSummary: z.string().max(4000).optional(),
  indiaAsiaExpansion: evidenceSchema.optional(),
  platformExpansion: evidenceSchema.optional(),
  offshoreVendorChange: evidenceSchema.optional(),
  newsEvidenceSummary: z.string().max(4000).optional(),
  signals: signalsSchema,
  qualifiedSignals: z.array(z.enum(SIGNAL_IDS)).max(6).optional(),
  primarySignal: z.enum(SIGNAL_IDS).optional(),
  campaignAssignment: z.string().min(1).max(200),
  approachVariant: z.string().max(300).optional(),
  primarySignalEvidence: z.string().max(4000).optional(),
  contact: contactSchema.optional(),
});

export type Account = z.infer<typeof accountSchema>;

export const prioritizeRequestSchema = z.object({
  capacity: z.number().int().min(1).max(100).default(12),
  accounts: z.array(accountSchema).min(1).max(100),
});

export type PrioritizeRequest = z.infer<typeof prioritizeRequestSchema>;

export const DEFAULT_CAPACITY = 12;
