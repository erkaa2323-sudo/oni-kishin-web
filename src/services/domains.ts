/**
 * Domain service adapters over the legacy ONI Firebase project.
 *
 * Typed boundaries for Members, Garage, Applications, Meet, Music/AI.
 * Row-level security is enforced in the database — these helpers never
 * assume authority, they simply surface normalized results.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firebaseDb } from "@/integrations/firebase/client";
import { fail, normalizeError, ok, type ServiceResult } from "@/lib/backend/errors";

export const TABLES = {
  profiles: "profiles",
  userRoles: "user_roles",
  members: "members",
  garage: "garage_vehicles",
  applications: "applications",
  meets: "meets",
  meetCredentials: "meet_credentials",
  meetRegistrations: "meet_registrations",
  music: "music_tracks",
  aiConfig: "ai_config",
  auditLogs: "audit_logs",
} as const;

export type BaseRecord = {
  id: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const opt = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const firebaseDate = (v: unknown): string | undefined => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "toDate" in v) {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
};

async function firebaseRows(name: string): Promise<Row[]> {
  const snapshot = await getDocs(collection(firebaseDb, name));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function compact(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

async function firebaseCreate(
  name: string,
  data: Record<string, unknown>,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const ref = await addDoc(
      collection(firebaseDb, name),
      compact({ ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    return ok({ id: ref.id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

async function firebaseUpdate(
  name: string,
  id: string,
  data: Record<string, unknown>,
): Promise<ServiceResult<{ id: string }>> {
  try {
    await updateDoc(doc(firebaseDb, name, id), compact({ ...data, updatedAt: serverTimestamp() }));
    return ok({ id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

async function firebaseRemove(name: string, id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    await deleteDoc(doc(firebaseDb, name, id));
    return ok({ id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

/* ── Members ──────────────────────────────────────────────────── */

export type MemberRecord = BaseRecord & {
  cpmNickname: string;
  cpmId: string;
  role?: string | undefined;
  status: "active" | "inactive" | "archived";
  joinedAt?: string | undefined;
};

export const membersService = {
  list: async (): Promise<ServiceResult<MemberRecord[]>> => {
    try {
      return ok((await firebaseRows("members")).map(mapFirebaseMember));
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listActive: async (): Promise<ServiceResult<MemberRecord[]>> => {
    const res = await membersService.list();
    return res.ok ? ok(res.data.filter((member) => member.status === "active")) : res;
  },
  /** Public projection: active members only, no admin-only columns. */
  listPublic: async (): Promise<ServiceResult<MemberRecord[]>> => {
    try {
      const rows = await firebaseRows("members");
      return ok(
        rows
          .filter((r) => str(r["status"]) !== "archived")
          .map((r) => ({
            id: str(r["id"]),
            cpmNickname: str(r["nick"] || r["name"]),
            cpmId: str(r["cpmid"]),
            role: opt(r["role"] || r["title"]),
            status: "active",
            joinedAt: firebaseDate(r["createdAt"]),
            createdAt: firebaseDate(r["createdAt"]),
            updatedAt: firebaseDate(r["updatedAt"]),
          })),
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  create: (data: Record<string, unknown>) => firebaseCreate("members", memberWrite(data)),
  update: (id: string, data: Record<string, unknown>) =>
    firebaseUpdate("members", id, memberWrite(data)),
  archive: (id: string) => firebaseUpdate("members", id, { status: "archived" }),
  remove: (id: string) => firebaseRemove("members", id),
};

function mapFirebaseMember(r: Row): MemberRecord {
  return {
    id: str(r["id"]),
    cpmNickname: str(r["nick"] || r["nickname"] || r["name"]),
    cpmId: str(r["cpmid"] || r["cpmId"]),
    role: opt(r["role"] || r["title"]),
    status: (str(r["status"]) || "active") as MemberRecord["status"],
    joinedAt: firebaseDate(r["joinedAt"] || r["createdAt"]),
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function memberWrite(data: Record<string, unknown>): Record<string, unknown> {
  return compact({
    nick: data["cpm_nickname"] ?? data["nick"],
    cpmid: data["cpm_id"] ?? data["cpmid"],
    role: data["role"],
    status: data["status"],
    joinedAt: data["joined_at"] ?? data["joinedAt"],
    createdBy: data["created_by"] ?? data["createdBy"],
    updatedBy: data["updated_by"] ?? data["updatedBy"],
  });
}

/* ── Garage ───────────────────────────────────────────────────── */

export type VehicleRecord = BaseRecord & {
  model: string;
  ownerName?: string | undefined;
  ownerMemberId?: string | undefined;
  category?: string | undefined;
  build?: string | undefined;
  imagePath?: string | undefined;
  status: "published" | "draft" | "archived";
};

export const garageService = {
  list: async (): Promise<ServiceResult<VehicleRecord[]>> => {
    try {
      return ok((await firebaseRows("garage")).map(mapFirebaseVehicle));
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listPublished: async (): Promise<ServiceResult<VehicleRecord[]>> => {
    const res = await garageService.list();
    return res.ok ? ok(res.data.filter((vehicle) => vehicle.status === "published")) : res;
  },
  archive: (id: string) => firebaseUpdate("garage", id, { status: "archived" }),
  create: (data: Record<string, unknown>) => firebaseCreate("garage", vehicleWrite(data)),
  update: (id: string, data: Record<string, unknown>) =>
    firebaseUpdate("garage", id, vehicleWrite(data)),
  remove: (id: string) => firebaseRemove("garage", id),
};

function mapFirebaseVehicle(r: Row): VehicleRecord {
  const rawStatus = str(r["status"]);
  const status: VehicleRecord["status"] = /archiv/i.test(rawStatus)
    ? "archived"
    : /draft|hidden/i.test(rawStatus)
      ? "draft"
      : "published";
  return {
    id: str(r["id"]),
    model: str(r["name"] || r["model"]),
    ownerName: opt(r["owner"] || r["ownerName"]),
    ownerMemberId: opt(r["ownerMemberId"]),
    category: opt(r["category"]),
    build: opt(r["build"] || r["description"] || r["anime"]),
    imagePath: opt(r["image"] || (Array.isArray(r["images"]) ? r["images"][0] : undefined)),
    status,
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function vehicleWrite(data: Record<string, unknown>): Record<string, unknown> {
  return compact({
    name: data["model"] ?? data["name"],
    owner: data["owner_name"] ?? data["owner"],
    ownerMemberId: data["owner_member_id"] ?? data["ownerMemberId"],
    category: data["category"],
    description: data["build"] ?? data["description"],
    image: data["image_path"] ?? data["image"],
    status: data["status"],
    createdBy: data["created_by"] ?? data["createdBy"],
    updatedBy: data["updated_by"] ?? data["updatedBy"],
  });
}

/* ── Applications (public submit-only) ────────────────────────── */

export type ApplicationRecord = BaseRecord & {
  cpmNickname: string;
  cpmId: string;
  contact: string;
  message?: string | undefined;
  experience?: string | undefined;
  state: "pending" | "accepted" | "rejected";
};

export const applicationsService = {
  /** Anyone may submit; Firestore rules forbid reading applications back. */
  submit: (input: {
    last: string;
    first: string;
    age: number;
    gender: "Эрэгтэй" | "Эмэгтэй";
    cpm_nickname: string;
    cpm_id: string;
    direction: string;
    contact_type: "Instagram" | "Discord" | "Phone";
    contact: string;
    message?: string | undefined;
    experience?: string | undefined;
    interests?: string | undefined;
  }) => submitFirebaseApplication(input),
  list: async (): Promise<ServiceResult<ApplicationRecord[]>> => {
    try {
      return ok((await firebaseRows("applications")).map(mapFirebaseApplication));
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  review: (id: string, state: "accepted" | "rejected", actorId: string) =>
    firebaseUpdate("applications", id, {
      status: state === "accepted" ? "Зөвшөөрсөн" : "Татгалзсан",
      reviewedBy: actorId,
      reviewedAt: new Date().toISOString(),
    }),
  acceptAndPromote: async (
    id: string,
    member: { cpmNickname: string; cpmId: string },
    actorId: string,
  ): Promise<ServiceResult<{ id: string }>> => {
    try {
      const batch = writeBatch(firebaseDb);
      const memberRef = doc(collection(firebaseDb, "members"));
      batch.set(memberRef, {
        nick: member.cpmNickname,
        cpmid: member.cpmId,
        status: "active",
        joinedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: actorId,
        updatedBy: actorId,
      });
      batch.update(doc(firebaseDb, "applications", id), {
        status: "Зөвшөөрсөн",
        reviewedBy: actorId,
        reviewedAt: serverTimestamp(),
        promotedMemberId: memberRef.id,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return ok({ id: memberRef.id });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
};

async function submitFirebaseApplication(input: {
  last: string;
  first: string;
  age: number;
  gender: "Эрэгтэй" | "Эмэгтэй";
  cpm_nickname: string;
  cpm_id: string;
  direction: string;
  contact_type: "Instagram" | "Discord" | "Phone";
  contact: string;
  message?: string | undefined;
  experience?: string | undefined;
}): Promise<ServiceResult<{ id: string }>> {
  try {
    const ref = await addDoc(collection(firebaseDb, "applications"), {
      last: input.last,
      first: input.first,
      age: input.age,
      gender: input.gender,
      nick: input.cpm_nickname,
      cpmid: input.cpm_id,
      direction: input.direction,
      contactType: input.contact_type,
      contact: input.contact,
      experience:
        input.experience === "rookie"
          ? "6 сараас бага"
          : input.experience === "veteran"
            ? "2 жилээс дээш"
            : "1 – 2 жил",
      message: input.message ?? "",
      status: "Шинэ",
      createdAt: serverTimestamp(),
    });
    return ok({ id: ref.id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

function mapFirebaseApplication(r: Row): ApplicationRecord {
  const status = str(r["state"] || r["status"]);
  const state: ApplicationRecord["state"] = /зөвшөөр|accept/i.test(status)
    ? "accepted"
    : /татгалз|reject/i.test(status)
      ? "rejected"
      : "pending";
  return {
    id: str(r["id"]),
    cpmNickname: str(r["nick"] || r["cpm_nickname"]),
    cpmId: str(r["cpmid"] || r["cpm_id"]),
    contact: str(r["contact"]),
    message: opt(r["message"]),
    experience: opt(r["experience"]),
    state,
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

/* ── Meet ─────────────────────────────────────────────────────── */

export type MeetRecord = BaseRecord & {
  title: string;
  scheduledAt?: string | undefined;
  endsAt?: string | undefined;
  registrationClosesAt?: string | undefined;
  capacity?: number | undefined;
  status: "draft" | "scheduled" | "live" | "ended" | "closed";
};

export type MeetCredentialsRecord = {
  meetId: string;
  roomId: string;
  password: string;
};

export type MeetRegistrationRecord = BaseRecord & {
  meetId: string;
  cpmNickname: string;
  cpmId: string;
  verified: boolean;
};

export const meetService = {
  list: async (): Promise<ServiceResult<MeetRecord[]>> => {
    try {
      const snapshot = await getDocs(collection(firebaseDb, "meets"));
      return ok(snapshot.docs.map((entry) => mapFirebaseMeet({ id: entry.id, ...entry.data() })));
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listPublic: async (): Promise<ServiceResult<MeetRecord[]>> => {
    const res = await meetService.list();
    return res.ok
      ? ok(res.data.filter((meet) => ["scheduled", "live"].includes(meet.status)))
      : res;
  },
  create: async (data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> => {
    try {
      const meetRef = doc(firebaseDb, "meets", "current");
      const [previous, participants, roster, slots, previousCredentials] = await Promise.all([
        getDoc(meetRef),
        getDocs(
          query(collection(firebaseDb, "meetParticipants"), where("meetId", "==", "current")),
        ),
        getDocs(query(collection(firebaseDb, "meetRoster"), where("meetId", "==", "current"))),
        getDocs(query(collection(firebaseDb, "meetSlots"), where("meetId", "==", "current"))),
        getDoc(doc(firebaseDb, "meetCredentials", "current")),
      ]);
      const batch = writeBatch(firebaseDb);
      if (previous.exists()) {
        const archiveRef = doc(collection(firebaseDb, "meetResults"));
        batch.set(archiveRef, {
          ...previous.data(),
          sourceMeetId: "current",
          participantCount: participants.docs.filter((entry) => entry.id !== "__counter__").length,
          archivedAt: serverTimestamp(),
        });
      }
      participants.docs.forEach((entry) => batch.delete(entry.ref));
      roster.docs.forEach((entry) => batch.delete(entry.ref));
      slots.docs.forEach((entry) => batch.delete(entry.ref));
      if (previousCredentials.exists()) batch.delete(previousCredentials.ref);
      batch.set(
        meetRef,
        compact({
          ...meetWrite(data),
          maxPlayers: Math.min(20, Math.max(1, Number(data["capacity"] ?? 20))),
          enabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
      await batch.commit();
      return ok({ id: "current" });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  update: (_id: string, data: Record<string, unknown>) =>
    firebaseUpdate("meets", "current", meetWrite(data)),
  setLifecycle: (_id: string, status: MeetRecord["status"]) =>
    firebaseUpdate("meets", "current", {
      status,
      enabled: status === "scheduled" || status === "live",
    }),
  /** Admin-only: RLS blocks every non-admin read of credentials. */
  getCredentials: async (meetId: string): Promise<ServiceResult<MeetCredentialsRecord>> => {
    try {
      const snapshot = await getDoc(doc(firebaseDb, "meetCredentials", meetId));
      if (!snapshot.exists()) return fail("not_found");
      const r = snapshot.data() as Row;
      return ok({ meetId, roomId: str(r["roomId"]), password: str(r["password"]) });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listRegistrations: async (meetId: string): Promise<ServiceResult<MeetRegistrationRecord[]>> => {
    try {
      const snapshot = await getDocs(
        query(collection(firebaseDb, "meetParticipants"), where("meetId", "==", meetId)),
      );
      return ok(
        snapshot.docs.map((entry) => {
          const r = entry.data() as Row;
          return {
            id: entry.id,
            meetId: str(r["meetId"]),
            cpmNickname: str(r["nick"] || r["name"]),
            cpmId: str(r["cpmId"]),
            verified: true,
            createdAt: firebaseDate(r["joinedAt"]),
          };
        }),
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  removeRegistration: async (id: string): Promise<ServiceResult<void>> => {
    try {
      await runTransaction(firebaseDb, async (tx) => {
        const registrationRef = doc(firebaseDb, "meetParticipants", id);
        const registration = await tx.get(registrationRef);
        if (!registration.exists()) return;
        const slotId = str(registration.data()["slotId"]);
        if (slotId) tx.delete(doc(firebaseDb, "meetSlots", slotId));
        tx.delete(doc(firebaseDb, "meetRoster", id));
        tx.delete(registrationRef);
      });
      return ok(undefined);
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  /** Admin-authenticated write. Firestore rules keep this document non-public. */
  setCredentials: async (
    meetId: string,
    roomId: string,
    password: string,
  ): Promise<ServiceResult<void>> => {
    try {
      await setDoc(doc(firebaseDb, "meetCredentials", meetId), {
        roomId: roomId.trim(),
        password,
        updatedAt: serverTimestamp(),
      });
      return ok(undefined);
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },

  /**
   * Verification must run on a trusted server path that checks the CPM
   * identity against real members before releasing credentials. No such
   * path exists yet, so this fails closed — never fake success.
   */
  verifyAndJoin: async (_input: {
    meetId: string;
    cpmNickname: string;
    cpmId: string;
  }): Promise<ServiceResult<{ roomId: string; password: string }>> =>
    fail("not_configured", "Уулзалтын баталгаажуулалтын сервер хараахан идэвхжээгүй."),
};

function mapFirebaseMeet(r: Row): MeetRecord {
  const enabled = r["enabled"] !== false;
  const rawStatus = str(r["status"] || r["state"]);
  return {
    id: str(r["id"]),
    title: str(r["title"] || r["name"] || "ONI MEET"),
    scheduledAt: firebaseDate(r["scheduledAt"] || r["startAt"] || r["start"]),
    endsAt: firebaseDate(r["endsAt"] || r["endAt"]),
    registrationClosesAt: firebaseDate(r["registrationClosesAt"] || r["registrationEndAt"]),
    capacity:
      typeof r["capacity"] === "number"
        ? r["capacity"]
        : typeof r["maxPlayers"] === "number"
          ? r["maxPlayers"]
          : 20,
    status: (!enabled ? "closed" : rawStatus || "scheduled") as MeetRecord["status"],
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function meetWrite(data: Record<string, unknown>): Record<string, unknown> {
  const status = str(data["status"]) || undefined;
  return compact({
    title: data["title"],
    startAt: data["scheduled_at"] ?? data["scheduledAt"],
    endsAt: data["ends_at"] ?? data["endsAt"],
    registrationClosesAt: data["registration_closes_at"] ?? data["registrationClosesAt"],
    maxPlayers: data["capacity"] ?? data["maxPlayers"],
    status,
    enabled: status ? status === "scheduled" || status === "live" : undefined,
    updatedBy: data["updated_by"] ?? data["updatedBy"],
  });
}

/* ── Music / AI config ────────────────────────────────────────── */

export type TrackRecord = BaseRecord & {
  title: string;
  artist?: string | undefined;
  sourceUrl?: string | undefined;
  status: "published" | "draft";
  sortOrder: number;
  durationSeconds?: number | undefined;
};

export const musicService = {
  list: async (): Promise<ServiceResult<TrackRecord[]>> => {
    try {
      return ok(
        (await firebaseRows("music"))
          .map(mapFirebaseTrack)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listPublished: async (): Promise<ServiceResult<TrackRecord[]>> => {
    const res = await musicService.list();
    return res.ok
      ? ok(res.data.filter((track) => track.status === "published" && !!track.sourceUrl))
      : res;
  },
  create: (data: Record<string, unknown>) => firebaseCreate("music", trackWrite(data)),
  update: (id: string, data: Record<string, unknown>) =>
    firebaseUpdate("music", id, trackWrite(data)),
  remove: (id: string) => firebaseRemove("music", id),
};

function mapFirebaseTrack(r: Row): TrackRecord {
  const rawStatus = str(r["status"]);
  return {
    id: str(r["id"]),
    title: str(r["title"]),
    artist: opt(r["artist"]),
    sourceUrl: opt(r["file"] || r["source"] || r["sourceUrl"]),
    sortOrder: typeof r["order"] === "number" ? r["order"] : 0,
    durationSeconds: typeof r["duration"] === "number" ? r["duration"] : undefined,
    status: (/hidden|draft/i.test(rawStatus) ? "draft" : "published") as TrackRecord["status"],
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function trackWrite(data: Record<string, unknown>): Record<string, unknown> {
  return compact({
    title: data["title"],
    artist: data["artist"],
    file: data["source_url"] ?? data["source"] ?? data["file"],
    order: data["sort_order"] ?? data["sortOrder"] ?? data["order"],
    duration: data["duration_seconds"] ?? data["durationSeconds"] ?? data["duration"],
    status: data["status"] === "draft" ? "hidden" : (data["status"] ?? "published"),
    createdBy: data["created_by"] ?? data["createdBy"],
    updatedBy: data["updated_by"] ?? data["updatedBy"],
  });
}

export type AiConfigRecord = BaseRecord & {
  key: string;
  prompt?: string | undefined;
  knowledge?: string | undefined;
  enabled: boolean;
};

export const aiConfigService = {
  list: async (): Promise<ServiceResult<AiConfigRecord[]>> => ok([]),
  update: async (_id: string, _data: Record<string, unknown>) =>
    fail("not_configured", "ONI Brain-ийн тохиргоо Cloudflare Worker дээр хамгаалагдсан."),
};
