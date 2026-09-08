export const ONI_REWARDS = {
  meetAttendance: { xp: 100, coin: 50 },
  creatorApproved: { xp: 150, coin: 100 },
  eventParticipation: { xp: 250, coin: 150 },
  eventThird: { xp: 500, coin: 300 },
  eventSecond: { xp: 750, coin: 500 },
  eventFirst: { xp: 1200, coin: 800 },
} as const;

export type ProgressionLedgerEntry = {
  id: string;
  uid: string;
  sourceType: string;
  sourceKey: string;
  xp: number;
  coin: number;
  balanceAfter?: number | null;
  createdAt: string | null;
};

export type WeeklyMissionKind = "meet" | "creator" | "activity";
export type WeeklyMissionId = "meet-2" | "creator-1" | "activity-3";

export type WeeklyProgress = {
  uid: string;
  weekId: string;
  meet: number;
  creator: number;
  activity: number;
};

export type WeeklyConfig = {
  weekId: string;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
};

export type SeasonConfig = {
  seasonId: string;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
};

export type ProgressionStats = {
  meets: number;
  creator: number;
  events: number;
  unlocked: number;
  lifetimeXp: number;
};

export type AchievementId =
  | "first-blood"
  | "night-rider"
  | "content-creator"
  | "collector"
  | "kishin"
  | "legend";

export const ONI_ACHIEVEMENTS = [
  { id: "first-blood", name: "FIRST BLOOD", description: "Анхны баталгаажсан Meet attendance reward ав.", test: (s: ProgressionStats) => s.meets >= 1 },
  { id: "night-rider", name: "NIGHT RIDER", description: "10 баталгаажсан Meet-д оролц.", test: (s: ProgressionStats) => s.meets >= 10 },
  { id: "content-creator", name: "CONTENT CREATOR", description: "5 Creator asset Gallery-д батлуул.", test: (s: ProgressionStats) => s.creator >= 5 },
  { id: "collector", name: "VAULT SEEKER", description: "5 cosmetic unlock хий.", test: (s: ProgressionStats) => s.unlocked >= 5 },
  { id: "kishin", name: "KISHIN", description: "8,500 lifetime XP хүр.", test: (s: ProgressionStats) => s.lifetimeXp >= 8500 },
  { id: "legend", name: "LEGEND", description: "26,000 lifetime XP хүр.", test: (s: ProgressionStats) => s.lifetimeXp >= 26000 },
] as const satisfies ReadonlyArray<{
  id: AchievementId;
  name: string;
  description: string;
  test: (stats: ProgressionStats) => boolean;
}>;

export function achievementById(id: string) {
  return ONI_ACHIEVEMENTS.find((achievement) => achievement.id === id) ?? null;
}

export const WEEKLY_MISSIONS = [
  { id: "meet-2", label: "2 Meet оролц", target: 2, rewardCoin: 300, kind: "meet" as const },
  { id: "creator-1", label: "1 Creator asset батлуулах", target: 1, rewardCoin: 200, kind: "creator" as const },
  { id: "activity-3", label: "3 clan activity дуусгах", target: 3, rewardCoin: 500, kind: "activity" as const },
] as const;

export const WEEKLY_MISSION_IDS = WEEKLY_MISSIONS.map((mission) => mission.id) as WeeklyMissionId[];

export function weeklyMissionById(id: string) {
  return WEEKLY_MISSIONS.find((mission) => mission.id === id) ?? null;
}

export function weeklyProgressValue(progress: WeeklyProgress | null, kind: WeeklyMissionKind) {
  if (!progress) return 0;
  return kind === "meet" ? progress.meet : kind === "creator" ? progress.creator : progress.activity;
}

export function startOfCurrentWeek(now = new Date()) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function statsFromLedger(entries: ProgressionLedgerEntry[], unlocked: number, lifetimeXp: number): ProgressionStats {
  return {
    meets: entries.filter((x) => x.sourceType === "meet_attendance").length,
    creator: entries.filter((x) => x.sourceType === "creator_approved").length,
    events: entries.filter((x) => x.sourceType.startsWith("event_")).length,
    unlocked,
    lifetimeXp,
  };
}

export function weeklyMissionProgress(entries: ProgressionLedgerEntry[], now = new Date()) {
  const week = startOfCurrentWeek(now).getTime();
  const rows = entries.filter((entry) => entry.createdAt && new Date(entry.createdAt).getTime() >= week);
  const meet = rows.filter((x) => x.sourceType === "meet_attendance").length;
  const creator = rows.filter((x) => x.sourceType === "creator_approved").length;
  const activity = rows.filter((x) => ["meet_attendance", "creator_approved", "event_participation", "event_first", "event_second", "event_third"].includes(x.sourceType)).length;
  return { meet, creator, activity };
}
