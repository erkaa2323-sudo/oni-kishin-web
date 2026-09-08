import fs from "node:fs";

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  if (source.includes(after)) return false;
  if (!source.includes(before)) throw new Error(`Hardening marker missing in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
  return true;
}

const adminBefore = `    function isAdmin() {\n      return request.auth != null\n        && request.auth.token.email == "erkaa130@gmail.com";\n    }`;
const adminAfter = `    function isAdmin() {\n      return request.auth != null\n        && (request.auth.token.get("admin", false) == true\n          || request.auth.token.get("email", "") == "erkaa130@gmail.com");\n    }`;
replaceOnce("firestore.rules", adminBefore, adminAfter);

for (const path of [
  "firestore.progression.v3.rules.fragment",
  "firestore.progression.rules.fragment",
]) {
  const before = `    match /progressionProfiles/{uid} {\n      allow read: if true;`;
  const after = `    match /progressionProfiles/{uid} {\n      allow read: if isAdmin() || isApprovedMember();`;
  replaceOnce(path, before, after);
}

const economyPath = "scripts/economy-v3-ternary-patch.mjs";
const economyBefore = 'const safeAdminHelper = `    function isEconomyAdminV3() {\\n      return request.auth != null\\n        && request.auth.token.get("email", "") == "erkaa130@gmail.com";\\n    }\\n\\n`;';
const economyAfter = 'const safeAdminHelper = `    function isEconomyAdminV3() {\\n      return request.auth != null\\n        && (request.auth.token.get("admin", false) == true\\n          || request.auth.token.get("email", "") == "erkaa130@gmail.com");\\n    }\\n\\n`;';
replaceOnce(economyPath, economyBefore, economyAfter);

const adminAuthPath = "src/lib/admin-authorization.ts";
const adminAuthBefore = `/** Canonical Firebase owner allowlist; mirrored by Firestore isAdmin().\n * Client checks are UX only. Firestore and verified server tokens enforce access.\n */\nexport const ADMIN_EMAIL = "erkaa130@gmail.com";\nexport function isAdminEmail(email: string | null | undefined): boolean {\n  return email === ADMIN_EMAIL;\n}\n`;
const adminAuthAfter = `/**\n * Compatibility owner identity. Firestore/server authorization also accepts\n * a Firebase custom \`admin\` claim; email checks in the client are UX only.\n */\nexport const ADMIN_EMAIL = "erkaa130@gmail.com";\n\nexport type AdminTokenClaims = Record<string, unknown> | null | undefined;\n\nexport function hasAdminClaim(claims: AdminTokenClaims): boolean {\n  return claims?.["admin"] === true;\n}\n\nexport function isAdminEmail(email: string | null | undefined): boolean {\n  return email === ADMIN_EMAIL;\n}\n\nexport function isAdminIdentity(\n  email: string | null | undefined,\n  claims?: AdminTokenClaims,\n): boolean {\n  return hasAdminClaim(claims) || isAdminEmail(email);\n}\n`;
replaceOnce(adminAuthPath, adminAuthBefore, adminAuthAfter);

const packagePath = "package.json";
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (pkg.dependencies?.["@supabase/supabase-js"]) {
  delete pkg.dependencies["@supabase/supabase-js"];
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

for (const path of [
  "HARDENING.md",
  "docs-final-hardening-plan.md",
  "AUDIT-HARDENING.md",
  "HARDENING-STATE.md",
  "HARDENING-LOCK.md",
  "HARDENING-START.md",
  "HARDENING-TEMP.md",
  "HARDENING-CONTINUE.md",
  "HARDENING-WIP.md",
  "HARDENING-GO.md",
]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}

console.log("FINAL_HARDENING_SOURCE_PATCH_OK");
