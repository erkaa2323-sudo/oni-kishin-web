import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { firebaseDb } from "@/integrations/firebase/client";
import { fail, normalizeError, ok, type ServiceResult } from "@/lib/backend/errors";
import { applicationsService } from "@/services/domains";

type PublicApplicationState = "pending" | "accepted" | "rejected";

export type PublicApplicationStatus = {
  state: PublicApplicationState;
  memberId?: string;
};

export type SecureApplicationInput = {
  last: string;
  first: string;
  age: number;
  gender: "Эрэгтэй" | "Эмэгтэй";
  cpm_nickname: string;
  cpm_id: string;
  direction: string;
  contact_type: "Instagram" | "Discord" | "Phone";
  contact: string;
  message?: string;
  experience?: string;
  interests?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("mn-MN");
}

function memberIndexId(cpmId: string): string {
  return encodeURIComponent(normalized(cpmId)).replace(/\./g, "%2E");
}

function createStatusToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function submitSecureApplication(
  input: SecureApplicationInput,
): Promise<ServiceResult<{ id: string; statusToken: string }>> {
  try {
    const applicationRef = doc(collection(firebaseDb, "applications"));
    const statusToken = createStatusToken();
    const reference = applicationRef.id.slice(0, 8).toUpperCase();
    const statusRef = doc(firebaseDb, "applicationStatus", statusToken);
    const batch = writeBatch(firebaseDb);

    batch.set(applicationRef, {
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
      statusToken,
      createdAt: serverTimestamp(),
    });

    batch.set(statusRef, {
      applicationId: applicationRef.id,
      reference,
      state: "pending",
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return ok({ id: applicationRef.id, statusToken });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

export async function readPublicApplicationStatus(
  statusToken: string,
): Promise<ServiceResult<PublicApplicationStatus>> {
  try {
    if (!/^[a-f0-9]{48}$/i.test(statusToken)) {
      return fail("INVALID_INPUT", "Хүсэлтийн төлөвийн түлхүүр буруу байна.");
    }

    const snapshot = await getDoc(doc(firebaseDb, "applicationStatus", statusToken));
    if (!snapshot.exists()) return ok({ state: "pending" });

    const data = snapshot.data() as Record<string, unknown>;
    const rawState = text(data.state).toLowerCase();
    const memberId = text(data.memberId);

    if (rawState === "rejected") return ok({ state: "rejected" });
    if (rawState === "accepted" && memberId) return ok({ state: "accepted", memberId });
    return ok({ state: "pending" });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

async function reviewWithProjection(
  id: string,
  state: "accepted" | "rejected",
  actorId: string,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const applicationRef = doc(firebaseDb, "applications", id);
    const application = await getDoc(applicationRef);
    if (!application.exists()) return fail("NOT_FOUND", "Анкет олдсонгүй.");

    const statusToken = text(application.data().statusToken);
    const batch = writeBatch(firebaseDb);
    batch.update(applicationRef, {
      status: state === "accepted" ? "Зөвшөөрсөн" : "Татгалзсан",
      reviewedBy: actorId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (statusToken) {
      batch.set(
        doc(firebaseDb, "applicationStatus", statusToken),
        {
          state,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    await batch.commit();
    return ok({ id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

async function acceptAndPromoteUnique(
  id: string,
  member: { cpmNickname: string; cpmId: string },
  actorId: string,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const applicationRef = doc(firebaseDb, "applications", id);
    const application = await getDoc(applicationRef);
    if (!application.exists()) return fail("NOT_FOUND", "Анкет олдсонгүй.");

    const applicationData = application.data() as Record<string, unknown>;
    const cpmId = text(applicationData.cpmid) || member.cpmId.trim();
    const nickname = text(applicationData.nick) || member.cpmNickname.trim();
    const statusToken = text(applicationData.statusToken);
    const normalizedCpmId = normalized(cpmId);
    const normalizedNickname = normalized(nickname);

    if (!normalizedCpmId || !normalizedNickname) {
      return fail("INVALID_INPUT", "Анкетын CPM мэдээлэл дутуу байна.");
    }

    // Clan size is intentionally small, so this one admin-only scan safely
    // backfills protection for historical members created before the index.
    const membersSnapshot = await getDocs(collection(firebaseDb, "members"));
    const historical = membersSnapshot.docs.find((entry) => {
      const data = entry.data() as Record<string, unknown>;
      return normalized(text(data.cpmid) || text(data.cpmId)) === normalizedCpmId;
    });

    if (historical) {
      const historicalData = historical.data() as Record<string, unknown>;
      const historicalNickname = normalized(
        text(historicalData.nick) || text(historicalData.nickname) || text(historicalData.name),
      );
      if (historicalNickname && historicalNickname !== normalizedNickname) {
        return fail(
          "CONFLICT",
          "Энэ CPM ID өөр Crew гишүүн дээр бүртгэлтэй байна. Давхар гишүүн үүсгэсэнгүй.",
        );
      }
    }

    const indexRef = doc(firebaseDb, "memberCpmIndex", memberIndexId(cpmId));
    const generatedMemberRef = doc(collection(firebaseDb, "members"));

    const memberId = await runTransaction(firebaseDb, async (transaction) => {
      const indexSnapshot = await transaction.get(indexRef);
      const indexedMemberId = indexSnapshot.exists() ? text(indexSnapshot.data().memberId) : "";
      const resolvedMemberId = indexedMemberId || historical?.id || generatedMemberRef.id;
      const memberRef = doc(firebaseDb, "members", resolvedMemberId);
      const memberSnapshot = await transaction.get(memberRef);

      if (memberSnapshot.exists()) {
        const existing = memberSnapshot.data() as Record<string, unknown>;
        const existingCpmId = normalized(text(existing.cpmid) || text(existing.cpmId));
        const existingNickname = normalized(
          text(existing.nick) || text(existing.nickname) || text(existing.name),
        );
        if (existingCpmId && existingCpmId !== normalizedCpmId) {
          throw new Error("ONI_CPM_INDEX_CONFLICT");
        }
        if (existingNickname && existingNickname !== normalizedNickname) {
          throw new Error("ONI_CPM_NICKNAME_CONFLICT");
        }
      }

      transaction.set(
        memberRef,
        {
          nick: nickname,
          cpmid: cpmId,
          status: "active",
          ...(memberSnapshot.exists()
            ? {}
            : {
                joinedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                createdBy: actorId,
              }),
          updatedAt: serverTimestamp(),
          updatedBy: actorId,
        },
        { merge: true },
      );

      transaction.set(
        indexRef,
        {
          memberId: resolvedMemberId,
          cpmIdNormalized: normalizedCpmId,
          ...(indexSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      transaction.update(applicationRef, {
        status: "Зөвшөөрсөн",
        reviewedBy: actorId,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (statusToken) {
        transaction.set(
          doc(firebaseDb, "applicationStatus", statusToken),
          {
            state: "accepted",
            memberId: resolvedMemberId,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      return resolvedMemberId;
    });

    return ok({ id: memberId });
  } catch (err) {
    if (err instanceof Error && /ONI_CPM_(INDEX|NICKNAME)_CONFLICT/.test(err.message)) {
      return fail(
        "CONFLICT",
        "Энэ CPM ID өөр Crew гишүүн дээр бүртгэлтэй байна. Давхар гишүүн үүсгэсэнгүй.",
      );
    }
    return { ok: false, error: normalizeError(err) };
  }
}

/**
 * Admin data/actions already depend on the exported applicationsService object.
 * Replacing only these two mutation functions keeps every existing caller and UI
 * intact while adding public-safe status projection + uniqueness guarantees.
 */
applicationsService.review = reviewWithProjection;
applicationsService.acceptAndPromote = acceptAndPromoteUnique;
