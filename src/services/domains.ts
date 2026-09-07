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
  Timestamp,
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

const firebaseTimestamp = (v: unknown): Timestamp | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (v instanceof Timestamp) return v;
  if (v && typeof v === "object" && "toDate" in v) {
    try {
      return Timestamp.fromDate((v as { toDate: () => Date }).toDate());
    } catch {
      return undefined;
    }
  }
  if (typeof v === "string" || typeof v === "number") {
    const date = new Date(v);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
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
  portraitUrl?: string | undefined;
  status: "active" | "inactive" | "archived";
  joinedAt?: string | undefined;
};

function memberPortrait(r: Row): string | undefined {
  return opt(
    r["portraitUrl"] ||
      r["portrait_url"] ||
      r["portrait"] ||
      r["image"] ||
      r["imageUrl"] ||
      r["image_url"] ||
      r["photo"] ||
      r["avatar"],
  );
}

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
  listPublic: async (): Promise<ServiceResult<MemberRecord[]>> => {
    try {
      const rows = await firebaseRows("members");
      return ok(
        rows
          .filter((r) => str(r["status"]) !== "archived" && str(r["status"]) !== "inactive")
          .map((r) => ({
            id: str(r["id"]),
            cpmNickname: str(r["nick"] || r["nickname"] || r["name"]),
            cpmId: str(r["cpmid"] || r["cpmId"] || r["cpm_id"]),
            role: opt(r["role"] || r["title"]),
            portraitUrl: memberPortrait(r),
            status: "active" as const,
            joinedAt: firebaseDate(r["joinedAt"] || r["joined_at"] || r["createdAt"]),
            createdAt: firebaseDate(r["createdAt"]),
            updatedAt: firebaseDate(r["updatedAt"]),
          })),
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  create: (data: Record<string, unknown>) => firebaseCreate("members", memberWrite(data)),
  update: (id: string, data: Record<string, unknown>) => firebaseUpdate("members", id, memberWrite(data)),
  archive: (id: string) => firebaseUpdate("members", id, { status: "archived" }),
  remove: (id: string) => firebaseRemove("members", id),
};

function mapFirebaseMember(r: Row): MemberRecord {
  return {
    id: str(r["id"]),
    cpmNickname: str(r["nick"] || r["nickname"] || r["name"]),
    cpmId: str(r["cpmid"] || r["cpmId"] || r["cpm_id"]),
    role: opt(r["role"] || r["title"]),
    portraitUrl: memberPortrait(r),
    status: (str(r["status"]) || "active") as MemberRecord["status"],
    joinedAt: firebaseDate(r["joinedAt"] || r["joined_at"] || r["createdAt"]),
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function memberWrite(data: Record<string, unknown>): Record<string, unknown> {
  const portraitUrl = data["portrait_url"] ?? data["portraitUrl"] ?? data["image_url"] ?? data["imageUrl"] ?? data["image"];
  const cpmId = data["cpm_id"] ?? data["cpmid"] ?? data["cpmId"];
  const joinedAt = data["joined_at"] ?? data["joinedAt"];
  return compact({
    nick: data["cpm_nickname"] ?? data["nick"] ?? data["nickname"] ?? data["name"],
    cpmid: cpmId,
    cpmId,
    role: data["role"],
    portraitUrl,
    portrait_url: portraitUrl,
    status: data["status"],
    joinedAt,
    joined_at: joinedAt,
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
  update: (id: string, data: Record<string, unknown>) => firebaseUpdate("garage", id, vehicleWrite(data)),
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
    ownerName: opt(r["owner"] || r["ownerName"] || r["owner_name"]),
    ownerMemberId: opt(r["ownerMemberId"] || r["owner_member_id"]),
    category: opt(r["category"]),
    build: opt(r["build"] || r["description"] || r["anime"]),
    imagePath: opt(
      r["image"] ||
        r["imagePath"] ||
        r["image_path"] ||
        r["imageUrl"] ||
        r["image_url"] ||
        (Array.isArray(r["images"]) ? r["images"][0] : undefined),
    ),
    status,
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function vehicleWrite(data: Record<string, unknown>): Record<string, unknown> {
  const owner = data["owner_name"] ?? data["ownerName"] ?? data["owner"];
  const ownerMemberId = data["owner_member_id"] ?? data["ownerMemberId"];
  const build = data["build"] ?? data["description"];
  const imagePath = data["image_path"] ?? data["imagePath"] ?? data["image_url"] ?? data["imageUrl"] ?? data["image"];
  return compact({
    name: data["model"] ?? data["name"],
    model: data["model"] ?? data["name"],
    owner,
    ownerName: owner,
    ownerMemberId,
    owner_member_id: ownerMemberId,
    category: data["category"],
    description: build,
    build,
    image: imagePath,
    imagePath,
    image_path: imagePath,
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
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return ok({ id: memberRef.id });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
};

function mapFirebaseApplication(r: Row): ApplicationRecord {
  const raw = str(r["status"]);
  const state: ApplicationRecord["state"] = /зөвшөөр|accept|approve/i.test(raw)
    ? "accepted"
    : /татгал|reject/i.test(raw)
      ? "rejected"
      : "pending";
  return {
    id: str(r["id"]),
    cpmNickname: str(r["nick"] || r["cpmNickname"]),
    cpmId: str(r["cpmid"] || r["cpmId"]),
    contact: str(r["contact"]),
    message: opt(r["message"]),
    experience: opt(r["experience"]),
    state,
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

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
  interests?: string | undefined;
}): Promise<ServiceResult<{ id: string }>> {
  try {
    const ref = await addDoc(collection(firebaseDb, "applications"), {
      last: input.last,
      first: input.first,
      age: input.age,
      gender: input.gender,
      cpmid: input.cpm_id,
      nick: input.cpm_nickname,
      direction: input.direction,
      contactType: input.contact_type,
      contact: input.contact,
      experience: input.experience ?? "",
      message: input.message ?? input.interests ?? "",
      status: "Шинэ",
      createdAt: serverTimestamp(),
    });
    return ok({ id: ref.id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
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

export type MeetRegistrationRecord = BaseRecord & {
  meetId: string;
  memberId?: string | undefined;
  cpmNickname: string;
  cpmId: string;
  status: "registered" | "cancelled" | "removed";
};

export type MeetCredentials = { roomId: string; password: string };

export const meetService = {
  list: async (): Promise<ServiceResult<MeetRecord[]>> => {
    try {
      return ok((await firebaseRows("meets")).map(mapFirebaseMeet));
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listPublic: async (): Promise<ServiceResult<MeetRecord[]>> => {
    const res = await meetService.list();
    return res.ok ? ok(res.data.filter((meet) => meet.status !== "draft")) : res;
  },
  create: async (data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> => {
    try {
      const meetRef = doc(firebaseDb, "meets", "current");
      const credentialsRef = doc(firebaseDb, "meetCredentials", "current");
      const scheduledAt = firebaseTimestamp(data["scheduled_at"] ?? data["scheduledAt"]);
      const endsAt = firebaseTimestamp(data["ends_at"] ?? data["endsAt"]);
      const registrationClosesAt = firebaseTimestamp(data["registration_closes_at"] ?? data["registrationClosesAt"]);
      const capacity = Number(data["capacity"] ?? 20);
      const roomId = str(data["room_id"] ?? data["roomId"]);
      const password = str(data["password"]);
      await setDoc(meetRef, compact({
        title: data["title"],
        startAt: scheduledAt,
        endsAt,
        registrationClosesAt,
        maxPlayers: Number.isFinite(capacity) ? capacity : 20,
        status: data["status"] ?? "scheduled",
        enabled: data["enabled"] ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      if (roomId || password) {
        await setDoc(credentialsRef, { roomId, password, updatedAt: serverTimestamp() });
      }
      return ok({ id: "current" });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  update: async (id: string, data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> => {
    try {
      const meetRef = doc(firebaseDb, "meets", id);
      const scheduledAt = firebaseTimestamp(data["scheduled_at"] ?? data["scheduledAt"]);
      const endsAt = firebaseTimestamp(data["ends_at"] ?? data["endsAt"]);
      const registrationClosesAt = firebaseTimestamp(data["registration_closes_at"] ?? data["registrationClosesAt"]);
      const capacity = Number(data["capacity"] ?? 20);
      await updateDoc(meetRef, compact({
        title: data["title"],
        startAt: scheduledAt,
        endsAt,
        registrationClosesAt,
        maxPlayers: Number.isFinite(capacity) ? capacity : 20,
        status: data["status"],
        enabled: data["enabled"],
        updatedAt: serverTimestamp(),
      }));
      const roomId = str(data["room_id"] ?? data["roomId"]);
      const password = str(data["password"]);
      if (roomId || password) {
        await setDoc(doc(firebaseDb, "meetCredentials", id), compact({ roomId: roomId || undefined, password: password || undefined, updatedAt: serverTimestamp() }), { merge: true });
      }
      return ok({ id });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  remove: (id: string) => firebaseRemove("meets", id),
  setStatus: (id: string, status: MeetRecord["status"]) => firebaseUpdate("meets", id, { status }),
  setLifecycle: (id: string, status: MeetRecord["status"]) => firebaseUpdate("meets", id, { status }),
  setCredentials: async (id: string, roomId: string, password: string): Promise<ServiceResult<{ id: string }>> => {
    try {
      await setDoc(
        doc(firebaseDb, "meetCredentials", id),
        { roomId, password, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return ok({ id });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listRegistrations: async (meetId: string): Promise<ServiceResult<MeetRegistrationRecord[]>> => {
    try {
      const rows = await firebaseRows("meetParticipants");
      return ok(
        rows
          .filter((r) => str(r["meetId"]) === meetId)
          .map((r) => ({
            id: str(r["id"]),
            meetId: str(r["meetId"]),
            memberId: opt(r["memberId"]),
            cpmNickname: str(r["nick"] || r["cpmNickname"]),
            cpmId: str(r["cpmId"] || r["cpmid"]),
            status: "registered" as const,
            createdAt: firebaseDate(r["joinedAt"] || r["createdAt"]),
          })),
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  removeRegistration: async (id: string): Promise<ServiceResult<{ id: string }>> => {
    try {
      const participantRef = doc(firebaseDb, "meetParticipants", id);
      const participant = await getDoc(participantRef);
      const slotId = participant.exists() ? str(participant.data()["slotId"]) : "";
      const batch = writeBatch(firebaseDb);
      batch.delete(participantRef);
      batch.delete(doc(firebaseDb, "meetRoster", id));
      if (slotId) batch.delete(doc(firebaseDb, "meetSlots", slotId));
      await batch.commit();
      return ok({ id });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  credentials: {
    reveal: async (meetId: string): Promise<ServiceResult<MeetCredentials>> => {
      try {
        const snapshot = await getDoc(doc(firebaseDb, "meetCredentials", meetId));
        if (!snapshot.exists()) return fail("NOT_FOUND", "Уулзалтын нууц мэдээлэл олдсонгүй.");
        return ok({ roomId: str(snapshot.data()["roomId"]), password: str(snapshot.data()["password"]) });
      } catch (err) {
        return { ok: false, error: normalizeError(err) };
      }
    },
  },
};

function mapFirebaseMeet(r: Row): MeetRecord {
  const raw = str(r["status"]);
  const status: MeetRecord["status"] = /live|active|ongoing/i.test(raw)
    ? "live"
    : /ended|дуус/i.test(raw)
      ? "ended"
      : /closed|хаа/i.test(raw)
        ? "closed"
        : /draft|ноорог/i.test(raw)
          ? "draft"
          : "scheduled";
  return {
    id: str(r["id"]),
    title: str(r["title"] || r["name"] || "ONI MEET"),
    scheduledAt: firebaseDate(r["startAt"] || r["scheduledAt"] || r["date"]),
    endsAt: firebaseDate(r["endsAt"] || r["endAt"]),
    registrationClosesAt: firebaseDate(r["registrationClosesAt"] || r["registrationCloseAt"]),
    capacity: Number(r["maxPlayers"] ?? r["capacity"] ?? 20),
    status,
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

/* ── Music / AI config ────────────────────────────────────────── */

export type MusicTrackRecord = BaseRecord & {
  title: string;
  artist?: string | undefined;
  audioPath?: string | undefined;
  coverPath?: string | undefined;
  sourceUrl?: string | undefined;
  sortOrder: number;
  durationSeconds?: number | undefined;
  status: "published" | "draft" | "archived";
};

export const musicService = {
  list: async (): Promise<ServiceResult<MusicTrackRecord[]>> => {
    try {
      return ok((await firebaseRows("music")).map(mapFirebaseTrack));
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listPublished: async (): Promise<ServiceResult<MusicTrackRecord[]>> => {
    const res = await musicService.list();
    return res.ok ? ok(res.data.filter((track) => track.status === "published").sort((a, b) => a.sortOrder - b.sortOrder)) : res;
  },
  create: (data: Record<string, unknown>) => firebaseCreate("music", trackWrite(data)),
  update: (id: string, data: Record<string, unknown>) => firebaseUpdate("music", id, trackWrite(data)),
  remove: (id: string) => firebaseRemove("music", id),
};

function mapFirebaseTrack(r: Row): MusicTrackRecord {
  const rawStatus = str(r["status"]);
  const audioPath = opt(r["audioPath"] || r["sourceUrl"] || r["audio"] || r["url"]);
  const sortOrder = Number(r["sortOrder"] ?? r["sort_order"] ?? 0);
  const durationSeconds = Number(r["durationSeconds"] ?? r["duration_seconds"] ?? 0);
  return {
    id: str(r["id"]),
    title: str(r["title"] || r["name"]),
    artist: opt(r["artist"]),
    audioPath,
    sourceUrl: audioPath,
    coverPath: opt(r["coverPath"] || r["cover"] || r["image"]),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined,
    status: /archiv/i.test(rawStatus) ? "archived" : /draft|hidden/i.test(rawStatus) ? "draft" : "published",
    createdAt: firebaseDate(r["createdAt"]),
    updatedAt: firebaseDate(r["updatedAt"]),
  };
}

function trackWrite(data: Record<string, unknown>): Record<string, unknown> {
  const audioPath = data["source_url"] ?? data["sourceUrl"] ?? data["audio_path"] ?? data["audioPath"];
  const duration = Number(data["duration_seconds"] ?? data["durationSeconds"] ?? 0);
  const sortOrder = Number(data["sort_order"] ?? data["sortOrder"] ?? 0);
  return compact({
    title: data["title"],
    artist: data["artist"],
    audioPath,
    sourceUrl: audioPath,
    coverPath: data["cover_path"] ?? data["coverPath"],
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    status: data["status"],
    createdBy: data["created_by"] ?? data["createdBy"],
    updatedBy: data["updated_by"] ?? data["updatedBy"],
  });
}

export type AiConfigRecord = BaseRecord & {
  provider?: string | undefined;
  model?: string | undefined;
  systemPrompt?: string | undefined;
  enabled: boolean;
};

export const aiConfigService = {
  get: async (): Promise<ServiceResult<AiConfigRecord | null>> => {
    try {
      const rows = await firebaseRows("aiConfig");
      const first = rows[0];
      if (!first) return ok(null);
      return ok({
        id: str(first["id"]),
        provider: opt(first["provider"]),
        model: opt(first["model"]),
        systemPrompt: opt(first["systemPrompt"]),
        enabled: first["enabled"] !== false,
        createdAt: firebaseDate(first["createdAt"]),
        updatedAt: firebaseDate(first["updatedAt"]),
      });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  update: (id: string, data: Record<string, unknown>) => firebaseUpdate("aiConfig", id, data),
};