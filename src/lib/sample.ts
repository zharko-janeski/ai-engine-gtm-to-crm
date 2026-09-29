import type { Account } from "./schema";

export const northline: Account = {
  externalId: "sample-northline",
  companyName: "Northline Retail",
  domain: "northline-retail.example",
  industry: "Retail Apparel & Fashion",
  employeeSize: "201-500",
  country: "United Kingdom",
  capacityPressure: "CONFIRMED",
  engineeringJobCount: 4,
  engineeringJobTitles: ["Backend Engineer", "QA Engineer", "DevOps Engineer"],
  contractEngineeringHiring: true,
  evidenceSummary:
    "Four open engineering roles covering backend, QA, and DevOps. Two of the postings are contractor roles, which points to delivery pressure rather than general retail hiring.",
  indiaAsiaExpansion: "POSSIBLE",
  platformExpansion: "CONFIRMED",
  offshoreVendorChange: "NOT QUALIFIED",
  newsEvidenceSummary:
    "The company announced a replatform of its e-commerce stack this quarter. Older funding news was ignored by the news rules.",
  signals: {
    A1: "CONFIRMED",
    A2: "NOT QUALIFIED",
    A3: "POSSIBLE",
    B1: "CONFIRMED",
    B2: "POSSIBLE",
    B3: "NOT RESEARCHED",
  },
  qualifiedSignals: ["A1", "A3", "B1", "B2"],
  primarySignal: "A1",
  campaignAssignment: "Campaign A",
  approachVariant: "A1 existing offshore capacity",
  primarySignalEvidence:
    "Existing India engineering hiring plus multiple open software roles and a current replatform. Capacity pressure is confirmed.",
  contact: {
    jobTitle: "Head of Engineering",
    workEmailFound: true,
  },
};

export const harbor: Account = {
  externalId: "sample-harbor",
  companyName: "Harbor Home",
  domain: "harbor-home.example",
  industry: "Consumer Goods",
  employeeSize: "51-200",
  country: "Saudi Arabia",
  capacityPressure: "POSSIBLE",
  engineeringJobCount: 1,
  engineeringJobTitles: ["Full Stack Engineer"],
  contractEngineeringHiring: false,
  evidenceSummary: "One credible full-stack engineering role is open. No contractor pattern was found.",
  indiaAsiaExpansion: "NOT QUALIFIED",
  platformExpansion: "POSSIBLE",
  offshoreVendorChange: "NOT QUALIFIED",
  newsEvidenceSummary: "A short store-opening mention did not meet the recency bar for a current expansion signal.",
  signals: {
    A1: "NOT QUALIFIED",
    A2: "NOT QUALIFIED",
    A3: "POSSIBLE",
    B1: "NOT QUALIFIED",
    B2: "NOT QUALIFIED",
    B3: "NOT RESEARCHED",
  },
  qualifiedSignals: ["A3"],
  primarySignal: "A3",
  campaignAssignment: "Campaign A",
  approachVariant: "A3 engineering expansion",
  primarySignalEvidence:
    "A single engineering role suggests openness to extra delivery capacity, but the evidence is not strong enough to confirm.",
  contact: {
    jobTitle: "IT Director",
    workEmailFound: false,
  },
};

export const desertPantry: Account = {
  externalId: "sample-desert",
  companyName: "Desert Pantry",
  domain: "desert-pantry.example",
  industry: "Retail",
  employeeSize: "51-200",
  country: "Saudi Arabia",
  capacityPressure: "NOT FOUND",
  engineeringJobCount: 0,
  engineeringJobTitles: [],
  contractEngineeringHiring: false,
  evidenceSummary: "Open roles are in stores and finance. No software-delivery roles were found.",
  indiaAsiaExpansion: "NOT QUALIFIED",
  platformExpansion: "NOT QUALIFIED",
  offshoreVendorChange: "NOT QUALIFIED",
  signals: {
    A1: "NOT QUALIFIED",
    A2: "NOT QUALIFIED",
    A3: "NOT QUALIFIED",
    B1: "NOT QUALIFIED",
    B2: "NOT QUALIFIED",
    B3: "NOT RESEARCHED",
  },
  qualifiedSignals: [],
  campaignAssignment: "NO CAMPAIGN",
  primarySignalEvidence: "Research completed. No A1–B3 signal qualified.",
};

export const sampleBatch = {
  capacity: 1,
  accounts: [harbor, desertPantry, northline],
};
