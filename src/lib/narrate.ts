import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { Account, Allocation } from "./schema";
import type { ScoredAccount } from "./score";

const narrativeSchema = z.object({
  reasoning: z.array(z.string().min(8).max(280)).min(3).max(5),
  recommendedAction: z.string().min(8).max(320),
});

export type Narrative = {
  reasoning: string[];
  recommendedAction: string;
  narrativeSource: "model" | "rules";
  narrativeWarning?: string;
};

function clip(value: string | undefined, max = 420): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function channelLine(scored: ScoredAccount): string {
  if (scored.channel === "email" && scored.contactTitle) {
    return `Reach the ${scored.contactTitle} by work email.`;
  }
  if (scored.channel === "linkedin" && scored.contactTitle) {
    return `Reach the ${scored.contactTitle} on LinkedIn. No work email is on file.`;
  }
  return "No decision-maker was provided, so the next step is to find the engineering or IT contact before outreach.";
}

export function rulesNarrative(account: Account, scored: ScoredAccount): Narrative {
  const evidence =
    clip(account.primarySignalEvidence, 180) ??
    clip(account.evidenceSummary, 180) ??
    "No evidence text was provided.";
  const campaign = account.campaignAssignment;
  const variant = account.approachVariant ? ` Variant: ${account.approachVariant}.` : "";

  let recommendedAction: string;
  if (!scored.pursue) {
    recommendedAction = "Do not contact. Campaign assignment is NO CAMPAIGN.";
  } else if (scored.allocation === "workNow") {
    recommendedAction = `Work today: ${campaign}.${variant} ${channelLine(scored)}`;
  } else if (scored.allocation === "queue") {
    recommendedAction = `Queue for follow-up: ${campaign}.${variant} ${channelLine(scored)}`;
  } else {
    recommendedAction = `Hold for later review. Do not spend a sales slot on ${campaign} yet.`;
  }

  const signalLine =
    scored.qualifiedSignals.length > 1
      ? `Qualifying signals: ${scored.qualifiedSignals.join(", ")}.`
      : scored.qualifiedSignals.length === 1
        ? `Only ${scored.qualifiedSignals[0]} qualifies.`
        : "No signal is POSSIBLE or CONFIRMED.";

  const reasoning = (
    scored.pursue
      ? [
          scored.primarySignal
            ? `Primary signal ${scored.primarySignal} is ${scored.primarySignalStatus}.`
            : "No qualifying primary signal is set.",
          scored.urgency.notes[0] ?? "Urgency could not be read from the row.",
          evidence,
          signalLine,
          channelLine(scored),
        ]
      : [
          "Campaign assignment is NO CAMPAIGN.",
          scored.urgency.notes[0] ?? "Capacity pressure was not provided.",
          evidence,
          "This account stays out of the sales queue.",
        ]
  ).slice(0, 5);

  return {
    reasoning,
    recommendedAction,
    narrativeSource: "rules",
  };
}

function actionMatches(allocation: Allocation, pursue: boolean, action: string): boolean {
  const text = action.toLowerCase();
  if (!pursue) return /do not contact|no campaign/.test(text);
  if (allocation === "workNow") return /work today|same-day|same day/.test(text);
  if (allocation === "queue") return /queue|follow-up|follow up/.test(text);
  return /hold|later|do not spend|do not contact/.test(text);
}

function factsForPrompt(account: Account, scored: ScoredAccount) {
  return {
    companyName: account.companyName,
    domain: account.domain,
    country: account.country ?? null,
    industry: account.industry ?? null,
    employeeSize: account.employeeSize ?? null,
    campaign: account.campaignAssignment,
    approachVariant: account.approachVariant ?? null,
    primarySignal: scored.primarySignal,
    primarySignalStatus: scored.primarySignalStatus,
    qualifiedSignals: scored.qualifiedSignals,
    signalStatus: account.signals,
    capacityPressure: account.capacityPressure ?? null,
    engineeringJobCount: account.engineeringJobCount ?? null,
    engineeringJobTitles: account.engineeringJobTitles ?? [],
    contractEngineeringHiring: account.contractEngineeringHiring ?? null,
    evidenceSummary: account.evidenceSummary ?? null,
    indiaAsiaExpansion: account.indiaAsiaExpansion ?? null,
    platformExpansion: account.platformExpansion ?? null,
    offshoreVendorChange: account.offshoreVendorChange ?? null,
    newsEvidenceSummary: account.newsEvidenceSummary ?? null,
    primarySignalEvidence: account.primarySignalEvidence ?? null,
    contactTitle: scored.contactTitle,
    channel: scored.channel,
    pursue: scored.pursue,
    allocation: scored.allocation,
    priority: scored.priority,
    priorityScore: scored.priorityScore,
    fit: scored.fit.score,
    intent: scored.intent.score,
    urgency: scored.urgency.score,
    expectedValue: scored.expectedValue.score,
    confidence: scored.confidence.score,
  };
}

export async function narrate(account: Account, scored: ScoredAccount): Promise<Narrative> {
  const rules = rulesNarrative(account, scored);
  if (!scored.pursue) return rules;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return rules;

  try {
    const { output } = await generateText({
      model: google(process.env.GEMINI_MODEL ?? "gemini-3.8-flash"),
      temperature: 0.2,
      maxOutputTokens: 800,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      output: Output.object({
        schema: narrativeSchema,
        name: "SalesPriorityNarrative",
        description:
          "Three to five evidence-backed reasons and one next action for a salesperson.",
      }),
      system: `You write the sales note for WSQ, a firm that sells extra software-development capacity to retail and consumer companies in the United Kingdom and Saudi Arabia.
Clay has already set signals A1–B3 and the campaign. Those facts are fixed.
Explain why this account has the given allocation. Cite only facts in the user payload.
Do not invent funding, website intent, technology usage, people, or events.
Do not draft outreach copy.
Do not change the campaign, the signal statuses, or the scores.
If an evidence field is null, say that piece of evidence was not provided.
The recommendedAction must match allocation:
- workNow: start with "Work today:" and name the campaign, the channel, and the job title when present.
- queue: start with "Queue for follow-up:" and name the campaign.
- later: tell the rep to hold and not spend a sales slot.
- pursue false: start with "Do not contact."`,
      prompt: JSON.stringify(factsForPrompt(account, scored)),
    });

    if (!output) {
      return { ...rules, narrativeWarning: "The model returned no narrative. Rules text was used." };
    }

    const recommendedAction = actionMatches(scored.allocation, scored.pursue, output.recommendedAction)
      ? output.recommendedAction
      : rules.recommendedAction;

    return {
      reasoning: output.reasoning,
      recommendedAction,
      narrativeSource: "model",
      narrativeWarning: recommendedAction === output.recommendedAction
        ? undefined
        : "The model action did not match the allocation, so the rules action was kept.",
    };
  } catch {
    return {
      ...rules,
      narrativeWarning: "The model call failed. Rules text was used.",
    };
  }
}
