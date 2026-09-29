import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAccount } from "./decide";
import { normalizeAccount } from "./normalize";
import type { Account } from "./schema";
import { assignCapacity, scoreAccount } from "./score";
import { desertPantry, harbor, northline } from "./sample";

function scoreParsed(input: unknown) {
  return scoreAccount(parseAccount(input));
}

describe("WSQ priority scoring", () => {
  it("ranks a confirmed capacity signal ahead of a possible one", () => {
    const strong = scoreParsed(northline);
    const possible = scoreParsed(harbor);
    const parked = scoreParsed(desertPantry);

    assert.equal(strong.priority, "high");
    assert.equal(strong.pursue, true);
    assert.equal(strong.channel, "email");
    assert.equal(possible.priority, "medium");
    assert.equal(possible.channel, "linkedin");
    assert.equal(possible.pursue, true);
    assert.equal(parked.priority, "low");
    assert.equal(parked.pursue, false);
    assert.equal(parked.allocation, "later");
    assert.ok(strong.priorityScore > possible.priorityScore);
    assert.ok(possible.priorityScore > parked.priorityScore);
  });

  it("does not treat missing research as a failed qualification", () => {
    const incomplete = scoreParsed({
      ...northline,
      primarySignal: "A1",
      signals: {
        A1: "NOT RESEARCHED",
        A2: "NOT RESEARCHED",
        A3: "NOT RESEARCHED",
        B1: "NOT RESEARCHED",
        B2: "NOT RESEARCHED",
        B3: "NOT RESEARCHED",
      },
      qualifiedSignals: [],
      campaignAssignment: "Campaign A",
    });
    const rejected = scoreParsed({
      ...northline,
      primarySignal: "A1",
      signals: {
        A1: "NOT QUALIFIED",
        A2: "NOT QUALIFIED",
        A3: "NOT QUALIFIED",
        B1: "NOT QUALIFIED",
        B2: "NOT QUALIFIED",
        B3: "NOT QUALIFIED",
      },
      qualifiedSignals: [],
      campaignAssignment: "Campaign A",
    });

    assert.ok(incomplete.intent.score > rejected.intent.score);
    assert.match(incomplete.confidence.notes.join(" "), /NOT RESEARCHED/);
    assert.equal(incomplete.priority, "low");
    assert.equal(rejected.priority, "low");
  });

  it("does not pursue a confirmed signal when Clay assigned no campaign", () => {
    const blocked = scoreParsed({
      ...northline,
      campaignAssignment: "NO CAMPAIGN",
    });
    assert.equal(blocked.pursue, false);
    assert.equal(blocked.priority, "low");
    assert.equal(blocked.allocation, "later");
  });

  it("keeps an out-of-ICP country below high", () => {
    const outside = scoreParsed({ ...northline, country: "Germany" });
    assert.ok(outside.fit.score < 0.45);
    assert.notEqual(outside.priority, "high");
  });

  it("returns the same score for the same account", () => {
    assert.deepEqual(scoreParsed(northline), scoreParsed(northline));
  });

  it("gives the single capacity slot to the stronger account", () => {
    const accounts = [harbor, desertPantry, northline].map(parseAccount);
    const allocated = assignCapacity(
      accounts.map((account: Account) => scoreAccount(account)),
      1,
    );
    const byName = new Map(
      accounts.map((account, index) => [account.companyName, allocated[index]]),
    );

    assert.equal(byName.get("Northline Retail")?.allocation, "workNow");
    assert.equal(byName.get("Harbor Home")?.allocation, "queue");
    assert.equal(byName.get("Desert Pantry")?.allocation, "later");
  });

  it("accepts Clay column names", () => {
    const account = parseAccount(
      normalizeAccount({
        "Company Name": "Northline Retail",
        Domain: "northline-retail.example",
        Industry: "Retail Apparel & Fashion",
        "Employee Size": "201-500",
        Country: "United Kingdom",
        capacity_pressure: "confirmed",
        engineering_job_count: "4",
        engineering_job_titles: "Backend Engineer, QA Engineer",
        contract_engineering_hiring: "yes",
        evidence_summary: northline.evidenceSummary,
        A1: "Confirmed",
        A2: "not qualified",
        A3: "possible",
        B1: "CONFIRMED",
        B2: "POSSIBLE",
        B3: "",
        "Primary Signal": "a1",
        "Campaign Assignment": "Campaign A",
        "Approach Variant": "A1 existing offshore capacity",
        "Primary Signal Evidence": northline.primarySignalEvidence,
        "Job Title": "Head of Engineering",
        "Work Email Found": "yes",
      }),
    );

    assert.equal(account.companyName, "Northline Retail");
    assert.equal(account.capacityPressure, "CONFIRMED");
    assert.equal(account.signals.A1, "CONFIRMED");
    assert.equal(account.signals.B3, "NOT RESEARCHED");
    assert.equal(account.primarySignal, "A1");
    assert.equal(account.engineeringJobCount, 4);
    assert.equal(account.contact?.workEmailFound, true);
    assert.equal(scoreAccount(account).priority, "high");
  });
});
