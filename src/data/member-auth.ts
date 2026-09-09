import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";

export type MemberAccountStatus = "pending" | "approved" | "rejected";

export type MemberAccount = {
  uid: string;
  email: string;
  memberId: string;
  nickname: string;
  cpmId: string;
  status: MemberAccountStatus;
};

export type MemberAuthSnapshot = {
  user: User | null;
  account: MemberAccount | null;
};

const accountFrom = (uid: string, row: Record<string, unknown>): MemberAccount => ({
  uid,
  email: String(row["email"] ?? ""),
  memberId: String(row["memberId"] ?? ""),
  nickname: String(row["nickname"] ?? ""),
  cpmId: String(row["cpmId"] ?? ""),
  status: row["status"] === "approved" || row["status"] === "rejected" ? row["status"] : "pending",
});

export async function fetchMemberAccount(uid: string): Promise<MemberAccount | null> {
  const snapshot = await getDoc(doc(firebaseDb, "memberAccounts", uid));
  return snapshot.exists() ? accountFrom(uid, snapshot.data()) : null;
}

export function watchMemberAuth(
  listener: (snapshot: MemberAuthSnapshot) => void,
  onError: () => void,
): () => void {
  let unsubscribeAccount: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(
    firebaseAuth,
    (user) => {
      unsubscribeAccount?.();
      unsubscribeAccount = null;

      if (!user) {
        listener({ user: null, account: null });
        return;
      }

      unsubscribeAccount = onSnapshot(
        doc(firebaseDb, "memberAccounts", user.uid),
        (snapshot) => {
          listener({
            user,
            account: snapshot.exists() ? accountFrom(user.uid, snapshot.data()) : null,
          });
        },
        onError,
      );
    },
    onError,
  );

  return () => {
    unsubscribeAccount?.();
    unsubscribeAuth();
  };
}

async function findCrewMember(
  nickname: string,
  cpmId: string,
): Promise<QueryDocumentSnapshot<DocumentData> | undefined> {
  const cleanNickname = nickname.trim();
  const cleanCpmId = cpmId.trim();
  const snapshots = await Promise.all([
    getDocs(query(collection(firebaseDb, "members"), where("cpmid", "==", cleanCpmId), limit(2))),
    getDocs(query(collection(firebaseDb, "members"), where("cpmId", "==", cleanCpmId), limit(2))),
  ]);
  const normalized = cleanNickname.toLocaleLowerCase("mn-MN");
  return snapshots
    .flatMap((snapshot) => snapshot.docs)
    .find((entry) => {
      const row = entry.data();
      const stored = String(row["nick"] || row["nickname"] || row["name"] || "")
        .trim()
        .toLocaleLowerCase("mn-MN");
      return stored === normalized && row["status"] !== "inactive" && row["status"] !== "archived";
    });
}

async function writePendingMemberAccount(
  user: User,
  member: QueryDocumentSnapshot<DocumentData>,
): Promise<MemberAccount> {
  const row = member.data();
  const canonicalNickname = String(row["nick"] || row["nickname"] || row["name"] || "").trim();
  const canonicalCpmId = String(row["cpmid"] || row["cpmId"] || "").trim();
  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email) throw new Error("email_required");

  await setDoc(doc(firebaseDb, "memberAccounts", user.uid), {
    email,
    memberId: member.id,
    nickname: canonicalNickname,
    cpmId: canonicalCpmId,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    uid: user.uid,
    email,
    memberId: member.id,
    nickname: canonicalNickname,
    cpmId: canonicalCpmId,
    status: "pending",
  };
}

export async function requestMemberAccount(
  user: User,
  nickname: string,
  cpmId: string,
): Promise<MemberAccount> {
  const member = await findCrewMember(nickname, cpmId);
  if (!member) throw new Error("crew_not_found");
  return writePendingMemberAccount(user, member);
}

export async function registerMemberAccount(
  email: string,
  password: string,
  nickname: string,
  cpmId: string,
): Promise<MemberAccount> {
  // Verify clan membership before creating a Firebase Auth user. This prevents
  // typo/invalid CPM data from leaving an unusable orphan auth account behind.
  const member = await findCrewMember(nickname, cpmId);
  if (!member) throw new Error("crew_not_found");

  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  try {
    return await writePendingMemberAccount(credential.user, member);
  } catch (error) {
    // If Firestore rejects the profile write, roll back the newly created auth
    // identity so the same email can be retried cleanly.
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
}

export async function signInMember(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
}

export async function resetMemberPassword(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) throw new Error("invalid_email");
  await sendPasswordResetEmail(firebaseAuth, normalized);
}

export async function signOutMember(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function listMemberAccounts(): Promise<MemberAccount[]> {
  const snapshot = await getDocs(collection(firebaseDb, "memberAccounts"));
  return snapshot.docs.map((entry) => accountFrom(entry.id, entry.data()));
}

export async function reviewMemberAccount(
  uid: string,
  status: "approved" | "rejected",
): Promise<void> {
  const accountRef = doc(firebaseDb, "memberAccounts", uid);
  const accountSnapshot = await getDoc(accountRef);
  if (!accountSnapshot.exists()) throw new Error("member_account_not_found");

  if (status === "approved") {
    const target = accountFrom(uid, accountSnapshot.data());
    const accountsForMember = await getDocs(
      query(collection(firebaseDb, "memberAccounts"), where("memberId", "==", target.memberId)),
    );
    const duplicate = accountsForMember.docs.find(
      (entry) => entry.id !== uid && entry.data()["status"] === "approved",
    );
    if (duplicate) throw new Error("member_already_has_approved_account");
  }

  await updateDoc(accountRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}
