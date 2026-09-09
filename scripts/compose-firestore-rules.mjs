import { readFileSync, writeFileSync } from "node:fs";

export function composeRules() {
  let rules = readFileSync("firestore.rules", "utf8");
  const marker = "    match /{document=**} { allow read, write: if false; }";
  if (rules.split(marker).length !== 2) throw new Error("Expected exactly one deny-all marker");
  for (const [file, needle] of [
    ["firestore.creator.rules.fragment", "match /creatorPublishRequests/"],
    ["firestore.nexus.rules.fragment", "match /pushSubscriptions/"],
    ["firestore.progression.v3.rules.fragment", "function currentWeekPathV3()"],
    [
      "firestore.progression.shop-hotfix.rules.fragment",
      "function validCosmeticUnlockSocialHotfixV1(eventId)",
    ],
  ]) {
    if (!rules.includes(needle))
      rules = rules.replace(marker, `${readFileSync(file, "utf8").trimEnd()}\n\n${marker}`);
  }
  return rules;
}

const composed = composeRules();
writeFileSync("firestore.test.generated.rules", composed);
writeFileSync("firestore.economy-audit.rules", composed);
