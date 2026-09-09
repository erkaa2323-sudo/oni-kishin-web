import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { firebaseDb } from "@/integrations/firebase/client";

const CURRENT_MEET_COLLECTIONS = ["meetParticipants", "meetRoster", "meetSlots"] as const;

/**
 * Clear state that is scoped to the single `meets/current` slot before a new
 * Meet replaces it. This prevents stale riders/slots from leaking into the
 * next Meet and removes the previous room credentials.
 *
 * This is intentionally admin-only by Firestore Rules. Historical attendance,
 * progression claims and audit records are separate collections and are not
 * touched here.
 */
export async function resetCurrentMeetState(): Promise<void> {
  for (const collectionName of CURRENT_MEET_COLLECTIONS) {
    const snapshot = await getDocs(collection(firebaseDb, collectionName));
    const docs = snapshot.docs.filter((entry) => entry.id !== "__counter__");

    // Firestore batches support at most 500 writes. ONI Meet is capped at 20,
    // but chunking keeps this helper safe if stale data has accumulated.
    for (let offset = 0; offset < docs.length; offset += 450) {
      const batch = writeBatch(firebaseDb);
      for (const entry of docs.slice(offset, offset + 450)) batch.delete(entry.ref);
      await batch.commit();
    }
  }

  await deleteDoc(doc(firebaseDb, "meetCredentials", "current")).catch(() => undefined);
}
