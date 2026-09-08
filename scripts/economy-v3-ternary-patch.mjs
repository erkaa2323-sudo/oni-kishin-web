import fs from "node:fs";

const path = "firestore.progression.v3.rules.fragment";
let rules = fs.readFileSync(path, "utf8");

if (rules.includes("function isEconomyAdminV3()")) {
  console.log("ECONOMY_V3_TERNARY_PATCH_ALREADY_APPLIED");
  process.exit(0);
}

const replacements = [
  [
    `    function validEconomyProfileUpdateV3(uid) {
      let typeName = request.resource.data.get("lastAction", {}).get("type", "");
      return (typeName == "vault_unlock" && validVaultProfileV3(uid))
        || (typeName == "weekly_claim" && validWeeklyProfileV3(uid))
        || (typeName == "meet_reward" && validMeetProfileV3(uid))
        || (typeName == "prestige" && validPrestigeProfileV3(uid));
    }`,
    `    function validEconomyProfileUpdateV3(uid) {
      let typeName = request.resource.data.get("lastAction", {}).get("type", "");
      return typeName == "vault_unlock" ? validVaultProfileV3(uid)
        : typeName == "weekly_claim" ? validWeeklyProfileV3(uid)
        : typeName == "meet_reward" ? validMeetProfileV3(uid)
        : typeName == "prestige" ? validPrestigeProfileV3(uid)
        : false;
    }`,
  ],
  [
    `      allow update: if isAdmin() || (isApprovedMember()
        && profileIdentityV3(uid)
        && ((request.resource.data.diff(resource.data).affectedKeys().hasOnly(["equipped", "updatedAt"])
              && validEquipV3())
          || (request.resource.data.diff(resource.data).affectedKeys().hasAny(["lastAction"])
              && validEconomyProfileUpdateV3(uid))));`,
    `      allow update: if isAdmin() ? true
        : request.auth == null ? false
        : request.auth.uid != uid ? false
        : !isApprovedMember() ? false
        : !profileIdentityV3(uid) ? false
        : request.resource.data.diff(resource.data).affectedKeys().hasOnly(["equipped", "updatedAt"]) ? validEquipV3()
        : request.resource.data.diff(resource.data).affectedKeys().hasAny(["lastAction"]) ? validEconomyProfileUpdateV3(uid)
        : false;`,
  ],
  [
    `    function validLedgerCreateV3(ledgerId) {
      let profilePath = /databases/$(database)/documents/progressionProfiles/$(request.auth.uid);
      let profile = getAfter(profilePath).data;
      let action = profile.get("lastAction", {});
      let actionType = action.get("type", "");
      let actionKey = action.get("key", "");
      let sourceType = request.resource.data.get("sourceType", "");
      let weekId = action.get("weekId", "");
      return existsAfter(profilePath)
        && profile.updatedAt == request.time
        && action is map
        && request.resource.data.uid == request.auth.uid
        && requiredText(actionKey, 120)
        && request.resource.data.createdAt == request.time
        && ((sourceType == "vault_spend" && actionType == "vault_unlock"
          && request.resource.data.get("sourceKey", "") == actionKey
          && request.resource.data.get("itemId", "") == actionKey
          && ledgerId == "spend_" + request.auth.uid + "_" + actionKey)
        || (sourceType == "weekly_mission" && actionType == "weekly_claim"
          && request.resource.data.get("missionId", "") == actionKey
          && request.resource.data.get("weekId", "") == weekId
          && request.resource.data.get("sourceKey", "") == weekId + "_" + actionKey
          && ledgerId == "mission_" + request.auth.uid + "_" + weekId + "_" + actionKey)
        || (sourceType == "meet_attendance" && actionType == "meet_reward"
          && request.resource.data.get("sourceKey", "") == actionKey
          && ledgerId == request.auth.uid + "_" + actionKey)
        || (sourceType == "prestige" && actionType == "prestige"
          && request.resource.data.get("sourceKey", "") == actionKey
          && ledgerId == "prestige_" + request.auth.uid + "_" + actionKey));
    }`,
    `    function validLedgerCreateV3(ledgerId) {
      let profilePath = /databases/$(database)/documents/progressionProfiles/$(request.auth.uid);
      let profile = getAfter(profilePath).data;
      let action = profile.get("lastAction", {});
      let actionType = action.get("type", "");
      let actionKey = action.get("key", "");
      let sourceType = request.resource.data.get("sourceType", "");
      let weekId = action.get("weekId", "");
      let common = existsAfter(profilePath)
        && profile.updatedAt == request.time
        && action is map
        && request.resource.data.uid == request.auth.uid
        && requiredText(actionKey, 120)
        && request.resource.data.createdAt == request.time;
      return !common ? false
        : sourceType == "vault_spend" ? (actionType == "vault_unlock"
          && request.resource.data.get("sourceKey", "") == actionKey
          && request.resource.data.get("itemId", "") == actionKey
          && ledgerId == "spend_" + request.auth.uid + "_" + actionKey)
        : sourceType == "weekly_mission" ? (actionType == "weekly_claim"
          && request.resource.data.get("missionId", "") == actionKey
          && request.resource.data.get("weekId", "") == weekId
          && request.resource.data.get("sourceKey", "") == weekId + "_" + actionKey
          && ledgerId == "mission_" + request.auth.uid + "_" + weekId + "_" + actionKey)
        : sourceType == "meet_attendance" ? (actionType == "meet_reward"
          && request.resource.data.get("sourceKey", "") == actionKey
          && ledgerId == request.auth.uid + "_" + actionKey)
        : sourceType == "prestige" ? (actionType == "prestige"
          && request.resource.data.get("sourceKey", "") == actionKey
          && ledgerId == "prestige_" + request.auth.uid + "_" + actionKey)
        : false;
    }`,
  ],
  [
    `    function achievementEligibleV3(achievementId, profile) {
      let meetCount = profile.get("meetCount", 0);
      let creatorCount = profile.get("creatorCount", 0);
      let unlocked = profile.get("unlocked", []);
      let lifetimeXp = profile.get("lifetimeXp", 0);
      return (achievementId == "first-blood" && meetCount >= 1)
        || (achievementId == "night-rider" && meetCount >= 10)
        || (achievementId == "content-creator" && creatorCount >= 5)
        || (achievementId == "collector" && unlocked is list && unlocked.size() >= 5)
        || (achievementId == "kishin" && lifetimeXp >= 8500)
        || (achievementId == "legend" && lifetimeXp >= 26000);
    }`,
    `    function achievementEligibleV3(achievementId, profile) {
      let meetCount = profile.get("meetCount", 0);
      let creatorCount = profile.get("creatorCount", 0);
      let unlocked = profile.get("unlocked", []);
      let lifetimeXp = profile.get("lifetimeXp", 0);
      return achievementId == "first-blood" ? meetCount >= 1
        : achievementId == "night-rider" ? meetCount >= 10
        : achievementId == "content-creator" ? creatorCount >= 5
        : achievementId == "collector" ? (unlocked is list && unlocked.size() >= 5)
        : achievementId == "kishin" ? lifetimeXp >= 8500
        : achievementId == "legend" ? lifetimeXp >= 26000
        : false;
    }`,
  ],
  [
    `    function validAchievementClaimV3(claimId) {
      let profilePath = /databases/$(database)/documents/progressionProfiles/$(request.auth.uid);
      let profile = get(profilePath).data;
      let achievementId = request.resource.data.get("achievementId", "");
      return exists(profilePath)
        && request.resource.data.keys().hasOnly(["uid", "achievementId", "meetCount", "creatorCount", "unlockedCount", "lifetimeXp", "claimedAt"])
        && request.resource.data.get("uid", "") == request.auth.uid
        && requiredText(achievementId, 80)
        && claimId == request.auth.uid + "_" + achievementId
        && request.resource.data.get("claimedAt", null) == request.time
        && achievementEligibleV3(achievementId, profile)
        && request.resource.data.get("meetCount", -1) == profile.get("meetCount", 0)
        && request.resource.data.get("creatorCount", -1) == profile.get("creatorCount", 0)
        && request.resource.data.get("unlockedCount", -1) == profile.get("unlocked", []).size()
        && request.resource.data.get("lifetimeXp", -1) == profile.get("lifetimeXp", 0);
    }`,
    `    function validAchievementClaimV3(claimId) {
      let profilePath = /databases/$(database)/documents/progressionProfiles/$(request.auth.uid);
      let achievementId = request.resource.data.get("achievementId", "");
      return !exists(profilePath) ? false
        : !request.resource.data.keys().hasOnly(["uid", "achievementId", "meetCount", "creatorCount", "unlockedCount", "lifetimeXp", "claimedAt"]) ? false
        : request.resource.data.get("uid", "") != request.auth.uid ? false
        : !requiredText(achievementId, 80) ? false
        : claimId != request.auth.uid + "_" + achievementId ? false
        : request.resource.data.get("claimedAt", null) != request.time ? false
        : !achievementEligibleV3(achievementId, get(profilePath).data) ? false
        : request.resource.data.get("meetCount", -1) != get(profilePath).data.get("meetCount", 0) ? false
        : request.resource.data.get("creatorCount", -1) != get(profilePath).data.get("creatorCount", 0) ? false
        : request.resource.data.get("unlockedCount", -1) != get(profilePath).data.get("unlocked", []).size() ? false
        : request.resource.data.get("lifetimeXp", -1) == get(profilePath).data.get("lifetimeXp", 0);
    }`,
  ],
  [
    `      allow create: if isApprovedMember() && validAchievementClaimV3(claimId);`,
    `      allow create: if request.auth == null ? false
        : !isApprovedMember() ? false
        : validAchievementClaimV3(claimId);`,
  ],
];

for (const [before, after] of replacements) {
  if (!rules.includes(before)) throw new Error(`Patch marker missing: ${before.slice(0, 60)}`);
  rules = rules.replace(before, after);
}

const rootMarker = `    function currentWeekPathV3() {`;
const safeAdminHelper = `    function isEconomyAdminV3() {\n      return request.auth != null\n        && request.auth.token.get("email", "") == "erkaa130@gmail.com";\n    }\n\n`;
if (!rules.includes(rootMarker)) throw new Error("Economy root marker missing");
rules = rules.replace(rootMarker, safeAdminHelper + rootMarker);
rules = rules.replaceAll("isAdmin()", "isEconomyAdminV3()");

fs.writeFileSync(path, rules);
console.log("ECONOMY_V3_TERNARY_PATCH_OK");
