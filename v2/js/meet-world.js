import { collection, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";
import { getMeetState, normalizeMeetParticipant, normalizeMeetRecord } from "./meet.js";

const MEET_DOC_ID = "current";
const COUNTER_DOC_ID = "__counter__";

const store = {
  meet: null,
  participants: [],
  listeners: new Set(),
  unsubscribeMeet: null,
  unsubscribeParticipants: null,
  refCount: 0
};

function participantBelongsToMeet(participant, meet) {
  if (!participant || !meet) return false;
  if (participant.meetId && participant.meetId !== MEET_DOC_ID) return false;
  if (Number.isFinite(participant.meetStartMs) && Number.isFinite(meet.startAtMs)) {
    return participant.meetStartMs === meet.startAtMs;
  }
  if (participant.meetStartRaw != null && meet.startAtRaw != null) {
    return String(participant.meetStartRaw) === String(meet.startAtRaw);
  }
  return true;
}

function worldState(meet, participants) {
  if (!meet || !meet.enabled) return "NONE";
  const base = getMeetState(meet);
  if (base === "none") return "NONE";
  if (base === "expired") return "ENDED";
  if (base === "upcoming") return "UPCOMING";

  const count = Math.max(0, Number(participants?.length || 0));
  const maxPlayers = Math.max(1, Number(meet.maxPlayers || 20) || 20);
  return count >= maxPlayers ? "FULL" : "LIVE";
}

function snapshot() {
  const meet = store.meet;
  const participants = [...store.participants];
  const maxPlayers = Math.max(1, Number(meet?.maxPlayers || 20) || 20);
  return {
    meet,
    participants,
    participantsCount: participants.length,
    maxPlayers,
    state: worldState(meet, participants)
  };
}

function notify() {
  const next = snapshot();
  for (const listener of store.listeners) {
    try {
      listener(next);
    } catch {
      // Ignore subscriber failures.
    }
  }
}

function stopWatch() {
  if (typeof store.unsubscribeMeet === "function") store.unsubscribeMeet();
  if (typeof store.unsubscribeParticipants === "function") store.unsubscribeParticipants();
  store.unsubscribeMeet = null;
  store.unsubscribeParticipants = null;
  store.meet = null;
  store.participants = [];
}

function startWatch() {
  if (typeof store.unsubscribeMeet === "function") return;
  const db = getFirestoreDb();

  store.unsubscribeMeet = onSnapshot(doc(db, "meets", MEET_DOC_ID), meetSnap => {
    store.meet = meetSnap.exists() ? normalizeMeetRecord(meetSnap.data(), meetSnap.id) : null;

    if (typeof store.unsubscribeParticipants === "function") {
      store.unsubscribeParticipants();
      store.unsubscribeParticipants = null;
    }
    store.participants = [];

    if (store.meet?.enabled) {
      store.unsubscribeParticipants = onSnapshot(
        query(collection(db, "meetParticipants"), where("meetId", "==", MEET_DOC_ID)),
        participantsSnap => {
          store.participants = participantsSnap.docs
            .map(item => normalizeMeetParticipant(item.data(), item.id))
            .filter(item => item.id !== COUNTER_DOC_ID)
            .filter(item => participantBelongsToMeet(item, store.meet))
            .sort((a, b) => (a.joinedAtMs || 0) - (b.joinedAtMs || 0));
          notify();
        },
        () => {
          store.participants = [];
          notify();
        }
      );
    }

    notify();
  }, () => {
    store.meet = null;
    store.participants = [];
    notify();
  });
}

export function startMeetWorldState() {
  store.refCount += 1;
  if (store.refCount === 1) startWatch();
}

export function stopMeetWorldState() {
  store.refCount = Math.max(0, store.refCount - 1);
  if (store.refCount > 0) return;
  stopWatch();
}

export function subscribeMeetWorldState(listener) {
  if (typeof listener !== "function") return () => {};
  store.listeners.add(listener);
  startMeetWorldState();
  listener(snapshot());
  return () => {
    store.listeners.delete(listener);
    stopMeetWorldState();
  };
}

export function getMeetWorldSnapshot() {
  return snapshot();
}

