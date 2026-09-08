import fs from "node:fs";

const log = fs.readFileSync("economy-emulator.log", "utf8");
const lines = log.split(/\r?\n/);

const requiredMarkers = ["ECONOMY_SECURITY_INTEGRATION_OK", "RULE_COVERAGE_FOCUSED_OK"];
for (const marker of requiredMarkers) {
  if (!log.includes(marker)) throw new Error(`Missing audit marker: ${marker}`);
}

if (/maximum of 1000 expressions/i.test(log)) {
  throw new Error("Firestore rules exceeded the 1000-expression limit");
}

const windows = [
  ["CASE_1_ARBITRARY_MINT_BEGIN", "CASE_1_ARBITRARY_MINT_END", "arbitrary mint deny"],
  ["CASE_3_FAKE_LEDGER_BEGIN", "CASE_3_FAKE_LEDGER_END", "fake ledger deny"],
  ["CASE_4B_WEEKLY_REPLAY_BEGIN", "CASE_4B_WEEKLY_REPLAY_END", "weekly replay deny"],
  [
    "CASE_5_MEET_NO_ATTENDANCE_BEGIN",
    "CASE_5_MEET_NO_ATTENDANCE_END",
    "meet without confirmed attendance deny",
  ],
  [
    "CASE_6B_ACHIEVEMENT_UNEARNED_BEGIN",
    "CASE_6B_ACHIEVEMENT_UNEARNED_END",
    "unearned achievement deny",
  ],
];

const ranges = windows.map(([begin, end, label]) => {
  const start = lines.findIndex((line) => line.includes(begin));
  const finish = lines.findIndex((line, index) => index > start && line.includes(end));
  if (start < 0 || finish < 0) throw new Error(`Missing expected deny window: ${label}`);
  return { start, finish, label };
});

const evaluationErrors = [];
for (let index = 0; index < lines.length; index += 1) {
  if (!/evaluation error/i.test(lines[index])) continue;
  const owner = ranges.find((range) => index > range.start && index < range.finish);
  if (!owner) {
    throw new Error(
      `Unexpected Firestore evaluation error outside expected DENY windows at log line ${index + 1}: ${lines[index]}`,
    );
  }
  evaluationErrors.push({ line: index + 1, case: owner.label });
}

console.log("EXPECTED_DENY_EVALUATION_DIAGNOSTICS", JSON.stringify(evaluationErrors));
console.log("ECONOMY_EMULATOR_LOG_AUDIT_OK");
