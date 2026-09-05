/**
 * Domain service adapters over Lovable Cloud (Supabase/Postgres).
 *
 * Typed boundaries for Members, Garage, Applications, Meet, Music/AI.
 * Row-level security is enforced in the database — these helpers never
 * assume authority, they simply surface normalized results.
 */

import { supabase } from "@/integrations/supabase/client";
import { collection, getDocs } from "firebase/firestore";
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

async function legacyRows(name: "members" | "garage"): Promise<Row[]> {
  const snapshot = await getDocs(collection(firebaseDb, name));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function base(r: Row): BaseRecord {
  return { id: str(r["id"]), createdAt: opt(r["created_at"]), updatedAt: opt(r["updated_at"]) };
}

async function run<T>(
  promise: PromiseLike<{ data: unknown; error: unknown }>,
  map: (r: Row) => T,
): Promise<ServiceResult<T[]>> {
  try {
    const { data, error } = await promise;
    if (error) return { ok: false, error: normalizeError(error) };
    return ok(((data ?? []) as Row[]).map(map));
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

async function mutate(
  promise: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { data, error } = await promise;
    if (error) return { ok: false, error: normalizeError(error) };
    const row = (Array.isArray(data) ? data[0] : data) as Row | null;
    return ok({ id: row ? str(row["id"]) : "" });
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

const mapMember = (r: Row): MemberRecord => ({
  ...base(r),
  cpmNickname: str(r["cpm_nickname"]),
  cpmId: str(r["cpm_id"]),
  role: opt(r["role"]),
  status: (str(r["status"]) || "active") as MemberRecord["status"],
  joinedAt: opt(r["joined_at"]),
});

export const membersService = {
  list: () =>
    run(supabase.from("members").select("*").order("created_at", { ascending: false }), mapMember),
  listActive: () =>
    run(
      supabase
        .from("members")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      mapMember,
    ),
  /** Public projection: active members only, no admin-only columns. */
  listPublic: async (): Promise<ServiceResult<MemberRecord[]>> => {
    try {
      const rows = await legacyRows("members");
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
  create: (data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("members")
        .insert(data as never)
        .select("id")
        .single(),
    ),
  update: (id: string, data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("members")
        .update(data as never)
        .eq("id", id)
        .select("id")
        .single(),
    ),
  archive: (id: string) =>
    mutate(
      supabase.from("members").update({ status: "archived" }).eq("id", id).select("id").single(),
    ),
  remove: (id: string) =>
    mutate(supabase.from("members").delete().eq("id", id).select("id").single()),
};

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

const mapVehicle = (r: Row): VehicleRecord => ({
  ...base(r),
  model: str(r["model"]),
  ownerName: opt(r["owner_name"]),
  ownerMemberId: opt(r["owner_member_id"]),
  category: opt(r["category"]),
  build: opt(r["build"]),
  imagePath: opt(r["image_path"]),
  status: (str(r["status"]) || "draft") as VehicleRecord["status"],
});

export const garageService = {
  list: () =>
    run(
      supabase.from("garage_vehicles").select("*").order("created_at", { ascending: false }),
      mapVehicle,
    ),
  listPublished: async (): Promise<ServiceResult<VehicleRecord[]>> => {
    try {
      const rows = await legacyRows("garage");
      return ok(
        rows.map((r) => ({
          id: str(r["id"]),
          model: str(r["name"]),
          ownerName: opt(r["owner"]),
          category: opt(r["category"]),
          build: opt(r["build"] || r["description"] || r["anime"]),
          imagePath: opt(r["image"] || (Array.isArray(r["images"]) ? r["images"][0] : undefined)),
          status: "published",
          createdAt: firebaseDate(r["createdAt"]),
          updatedAt: firebaseDate(r["updatedAt"]),
        })),
      );
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  archive: (id: string) =>
    mutate(
      supabase
        .from("garage_vehicles")
        .update({ status: "archived" })
        .eq("id", id)
        .select("id")
        .single(),
    ),
  create: (data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("garage_vehicles")
        .insert(data as never)
        .select("id")
        .single(),
    ),
  update: (id: string, data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("garage_vehicles")
        .update(data as never)
        .eq("id", id)
        .select("id")
        .single(),
    ),
  remove: (id: string) =>
    mutate(supabase.from("garage_vehicles").delete().eq("id", id).select("id").single()),
};

/* ── Applications (public submit-only) ────────────────────────── */

export type ApplicationRecord = BaseRecord & {
  cpmNickname: string;
  cpmId: string;
  contact: string;
  message?: string | undefined;
  experience?: string | undefined;
  state: "pending" | "accepted" | "rejected";
};

const mapApplication = (r: Row): ApplicationRecord => ({
  ...base(r),
  cpmNickname: str(r["cpm_nickname"]),
  cpmId: str(r["cpm_id"]),
  contact: str(r["contact"]),
  message: opt(r["message"]),
  experience: opt(r["experience"]),
  state: (str(r["state"]) || "pending") as ApplicationRecord["state"],
});

export const applicationsService = {
  /** Anyone may submit; RLS forbids reading applications back. */
  submit: (input: {
    cpm_nickname: string;
    cpm_id: string;
    contact: string;
    message?: string | undefined;
    experience?: string | undefined;
  }) =>
    mutate(
      supabase
        .from("applications")
        .insert(input as never)
        .select("id")
        .single(),
    ),
  list: () =>
    run(
      supabase.from("applications").select("*").order("created_at", { ascending: false }),
      mapApplication,
    ),
  review: (id: string, state: "accepted" | "rejected", actorId: string) =>
    mutate(
      supabase
        .from("applications")
        .update({ state, reviewed_by: actorId })
        .eq("id", id)
        .select("id")
        .single(),
    ),
};

/* ── Meet ─────────────────────────────────────────────────────── */

export type MeetRecord = BaseRecord & {
  title: string;
  scheduledAt?: string | undefined;
  registrationClosesAt?: string | undefined;
  capacity?: number | undefined;
  status: "draft" | "scheduled" | "live" | "ended" | "closed";
};

const mapMeet = (r: Row): MeetRecord => ({
  ...base(r),
  title: str(r["title"]),
  scheduledAt: opt(r["scheduled_at"]),
  registrationClosesAt: opt(r["registration_closes_at"]),
  capacity: typeof r["capacity"] === "number" ? r["capacity"] : undefined,
  status: (str(r["status"]) || "draft") as MeetRecord["status"],
});

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
  list: () =>
    run(supabase.from("meets").select("*").order("scheduled_at", { ascending: true }), mapMeet),
  listPublic: () =>
    run(
      supabase
        .from("meets")
        .select("id,title,scheduled_at,capacity,status,created_at,updated_at")
        .in("status", ["scheduled", "live"]),
      mapMeet,
    ),
  create: (data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("meets")
        .insert(data as never)
        .select("id")
        .single(),
    ),
  update: (id: string, data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("meets")
        .update(data as never)
        .eq("id", id)
        .select("id")
        .single(),
    ),
  setLifecycle: (id: string, status: MeetRecord["status"]) =>
    mutate(supabase.from("meets").update({ status }).eq("id", id).select("id").single()),
  /** Admin-only: RLS blocks every non-admin read of credentials. */
  getCredentials: async (meetId: string): Promise<ServiceResult<MeetCredentialsRecord>> => {
    try {
      const { data, error } = await supabase
        .from("meet_credentials")
        .select("*")
        .eq("meet_id", meetId)
        .maybeSingle();
      if (error) return { ok: false, error: normalizeError(error) };
      if (!data) return fail("not_found");
      const r = data as Row;
      return ok({ meetId, roomId: str(r["room_id"]), password: str(r["room_password"]) });
    } catch (err) {
      return { ok: false, error: normalizeError(err) };
    }
  },
  listRegistrations: (meetId: string) =>
    run(
      supabase.from("meet_registrations").select("*").eq("meet_id", meetId),
      (r): MeetRegistrationRecord => ({
        ...base(r),
        meetId: str(r["meet_id"]),
        cpmNickname: str(r["cpm_nickname"]),
        cpmId: str(r["cpm_id"]),
        verified: r["verified"] === true,
      }),
    ),
  removeRegistration: (id: string) =>
    mutate(supabase.from("meet_registrations").delete().eq("id", id).select("id").single()),
  /** Admin-only credential write. Values are never logged or echoed elsewhere. */
  setCredentials: (meetId: string, roomId: string, password: string) =>
    mutate(
      supabase
        .from("meet_credentials")
        .upsert({ meet_id: meetId, room_id: roomId, room_password: password } as never, {
          onConflict: "meet_id",
        })
        .select("meet_id")
        .single(),
    ),

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

/* ── Music / AI config ────────────────────────────────────────── */

export type TrackRecord = BaseRecord & {
  title: string;
  artist?: string | undefined;
  sourceUrl?: string | undefined;
  status: "published" | "draft";
  sortOrder: number;
  durationSeconds?: number | undefined;
};

const mapTrack = (r: Row): TrackRecord => ({
  ...base(r),
  title: str(r["title"]),
  artist: opt(r["artist"]),
  sourceUrl: opt(r["source_url"]),
  sortOrder: typeof r["sort_order"] === "number" ? r["sort_order"] : 0,
  durationSeconds: typeof r["duration_seconds"] === "number" ? r["duration_seconds"] : undefined,
  status: (str(r["status"]) || "draft") as TrackRecord["status"],
});

export const musicService = {
  list: () =>
    run(
      supabase.from("music_tracks").select("*").order("created_at", { ascending: false }),
      mapTrack,
    ),
  listPublished: () =>
    run(
      supabase
        .from("music_tracks")
        .select(
          "id,title,artist,source_url,status,sort_order,duration_seconds,created_at,updated_at",
        )
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      mapTrack,
    ),
  create: (data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("music_tracks")
        .insert(data as never)
        .select("id")
        .single(),
    ),
  update: (id: string, data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("music_tracks")
        .update(data as never)
        .eq("id", id)
        .select("id")
        .single(),
    ),
  remove: (id: string) =>
    mutate(supabase.from("music_tracks").delete().eq("id", id).select("id").single()),
};

export type AiConfigRecord = BaseRecord & {
  key: string;
  prompt?: string | undefined;
  knowledge?: string | undefined;
  enabled: boolean;
};

export const aiConfigService = {
  list: () =>
    run(
      supabase.from("ai_config").select("*").order("key", { ascending: true }),
      (r): AiConfigRecord => ({
        ...base(r),
        key: str(r["key"]),
        prompt: opt(r["prompt"]),
        knowledge: opt(r["knowledge"]),
        enabled: r["enabled"] === true,
      }),
    ),
  update: (id: string, data: Record<string, unknown>) =>
    mutate(
      supabase
        .from("ai_config")
        .update(data as never)
        .eq("id", id)
        .select("id")
        .single(),
    ),
};
