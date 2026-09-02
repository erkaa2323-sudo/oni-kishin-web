import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirebase } from "./firebase.js";

const ADMIN_EMAIL = "erkaa130@gmail.com";
const MEET_DOC_ID = "current";

const state = {
  authLoading: true,
  user: null,
  activeTab: "dashboard",
  members: [],
  garage: [],
  applications: [],
  meet: null,
  participants: [],
  editingMemberId: "",
  editingGarageId: "",
  loading: false,
  actionLocks: new Set(),
  status: ""
};

const refs = {};

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function nowLocalDateTime() {
  const now = new Date();
  const p = v => String(v).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    time: `${p(now.getHours())}:${p(now.getMinutes())}`
  };
}

function meetTimeMs(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function memberRecord(raw = {}, id = "") {
  return {
    id,
    name: pickFirstText(raw.name, [raw.first, raw.last].filter(Boolean).join(" ")),
    nick: pickFirstText(raw.nick, raw.nickname),
    cpmid: pickFirstText(raw.cpmid, raw.cpmId),
    role: pickFirstText(raw.role, "member").toLowerCase(),
    title: pickFirstText(raw.title, raw.roleTitle),
    raw
  };
}

function garageRecord(raw = {}, id = "") {
  return {
    id,
    name: pickFirstText(raw.name, raw.title, raw.build),
    owner: pickFirstText(raw.owner, raw.nick),
    category: pickFirstText(raw.category, "anime"),
    image: pickFirstText(raw.image, raw.imageUrl),
    anime: pickFirstText(raw.anime, raw.theme),
    cpmId: pickFirstText(raw.cpmId, raw.cpmid),
    layer: pickFirstText(raw.layer),
    description: pickFirstText(raw.description),
    raw
  };
}

function appRecord(raw = {}, id = "") {
  return {
    id,
    first: pickFirstText(raw.first, raw.firstName),
    last: pickFirstText(raw.last, raw.lastName),
    nick: pickFirstText(raw.nick, raw.nickname),
    cpmid: pickFirstText(raw.cpmid, raw.cpmId),
    direction: pickFirstText(raw.direction),
    contactType: pickFirstText(raw.contactType),
    contact: pickFirstText(raw.contact),
    experience: pickFirstText(raw.experience),
    message: pickFirstText(raw.message),
    status: pickFirstText(raw.status, "Шинэ"),
    age: raw.age,
    gender: pickFirstText(raw.gender),
    raw
  };
}

function meetRecord(raw = {}) {
  const startAt = raw.startAt || null;
  const durationMinutes = Math.max(1, Number(raw.durationMinutes || 20) || 20);
  const startMs = meetTimeMs(startAt);
  const endMs = Number.isFinite(startMs) ? startMs + durationMinutes * 60_000 : NaN;
  return {
    name: pickFirstText(raw.name, "ONI NIGHT MEET"),
    roomLabel: pickFirstText(raw.roomLabel),
    roomId: pickFirstText(raw.roomId, raw.meetId),
    password: pickFirstText(raw.password, raw.pass),
    enabled: raw.enabled !== false,
    durationMinutes,
    maxPlayers: Math.max(1, Number(raw.maxPlayers || 20) || 20),
    startAt,
    startMs,
    endMs,
    raw
  };
}

function queryNode(selector) {
  return document.querySelector(selector);
}

function setStatus(message, kind = "") {
  state.status = message;
  const el = refs.status;
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.className = `oni-admin-status ${kind}`.trim();
}

function isAuthorizedUser(user) {
  return !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;
}

function setButtonBusy(button, busy, busyText) {
  if (!(button instanceof HTMLButtonElement)) return;
  if (!button.dataset.idleText) button.dataset.idleText = button.textContent || "";
  button.disabled = !!busy;
  button.textContent = busy ? busyText : button.dataset.idleText;
}

async function withActionLock(key, action, onBusyChange = null) {
  if (state.actionLocks.has(key)) {
    setStatus("Action is already in progress.", "error");
    return false;
  }
  state.actionLocks.add(key);
  if (typeof onBusyChange === "function") onBusyChange(true);
  try {
    await action();
    return true;
  } finally {
    state.actionLocks.delete(key);
    if (typeof onBusyChange === "function") onBusyChange(false);
  }
}

function resetMemberForm() {
  state.editingMemberId = "";
  refs.memberName.value = "";
  refs.memberNick.value = "";
  refs.memberCpmid.value = "";
  refs.memberRole.value = "member";
  refs.memberTitle.value = "";
  refs.memberSave.textContent = "Add member";
}

function resetGarageForm() {
  state.editingGarageId = "";
  refs.garageName.value = "";
  refs.garageOwner.value = "";
  refs.garageCategory.value = "anime";
  refs.garageAnime.value = "";
  refs.garageCpmid.value = "";
  refs.garageLayer.value = "";
  refs.garageImage.value = "";
  refs.garageDescription.value = "";
  refs.garageSave.textContent = "Add build";
}

function populateMeetForm() {
  const current = state.meet;
  if (!current) {
    const base = nowLocalDateTime();
    refs.meetName.value = "ONI NIGHT MEET";
    refs.meetRoomLabel.value = "";
    refs.meetDate.value = base.date;
    refs.meetTime.value = base.time;
    refs.meetDuration.value = "20";
    refs.meetMax.value = "20";
    refs.meetRoomId.value = "";
    refs.meetPass.value = "";
    return;
  }

  refs.meetName.value = current.name || "";
  refs.meetRoomLabel.value = current.roomLabel || "";
  refs.meetDuration.value = String(current.durationMinutes || 20);
  refs.meetMax.value = String(current.maxPlayers || 20);
  refs.meetRoomId.value = current.roomId || "";
  refs.meetPass.value = current.password || "";

  const ms = meetTimeMs(current.startAt);
  if (Number.isFinite(ms)) {
    const d = new Date(ms);
    const p = value => String(value).padStart(2, "0");
    refs.meetDate.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    refs.meetTime.value = `${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

function renderDashboard() {
  refs.statMembers.textContent = String(state.members.length);
  refs.statGarage.textContent = String(state.garage.length);
  refs.statApplications.textContent = String(state.applications.filter(item => !["Зөвшөөрсөн", "Татгалзсан"].includes(item.status)).length);
  refs.statMeet.textContent = state.meet?.enabled ? "ACTIVE" : "INACTIVE";
  refs.statParticipants.textContent = String(state.participants.length);
}

function renderMembers() {
  refs.memberCount.textContent = String(state.members.length);
  const query = asText(refs.memberSearch.value).toLowerCase();
  const list = state.members.filter(item => {
    const blob = `${item.name} ${item.nick} ${item.cpmid} ${item.role}`.toLowerCase();
    return !query || blob.includes(query);
  });

  if (!list.length) {
    refs.memberList.innerHTML = '<div class="oni-admin-empty">Member олдсонгүй.</div>';
    return;
  }

  refs.memberList.innerHTML = list.map(item => `
    <article class="oni-admin-item">
      <div>
        <b>${escapeHtml(item.nick || "Unnamed")}</b>
        <small>${escapeHtml(item.name || "")}</small>
        <small>${escapeHtml(item.cpmid || "")}</small>
      </div>
      <div class="oni-admin-actions">
        <span class="oni-admin-badge">${escapeHtml(item.role.toUpperCase())}</span>
        <button type="button" class="oni-btn oni-btn-ghost" data-member-edit="${escapeHtml(item.id)}">Edit</button>
        <button type="button" class="oni-btn oni-btn-ghost" data-member-delete="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderGarage() {
  refs.garageCount.textContent = String(state.garage.length);
  const query = asText(refs.garageSearch.value).toLowerCase();
  const list = state.garage.filter(item => {
    const blob = `${item.name} ${item.owner} ${item.category}`.toLowerCase();
    return !query || blob.includes(query);
  });

  if (!list.length) {
    refs.garageList.innerHTML = '<div class="oni-admin-empty">Garage build олдсонгүй.</div>';
    return;
  }

  refs.garageList.innerHTML = list.map(item => `
    <article class="oni-admin-item">
      <div>
        <b>${escapeHtml(item.name || "Untitled")}</b>
        <small>${escapeHtml(item.owner || "")}</small>
        <small>${escapeHtml(item.category.toUpperCase())}</small>
      </div>
      <div class="oni-admin-actions">
        <button type="button" class="oni-btn oni-btn-ghost" data-garage-edit="${escapeHtml(item.id)}">Edit</button>
        <button type="button" class="oni-btn oni-btn-ghost" data-garage-delete="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderApplications() {
  const list = state.applications;
  refs.appCount.textContent = String(list.length);

  if (!list.length) {
    refs.applicationList.innerHTML = '<div class="oni-admin-empty">Application алга.</div>';
    return;
  }

  refs.applicationList.innerHTML = list.map(item => `
    <article class="oni-admin-item is-vertical">
      <div>
        <b>${escapeHtml([item.first, item.last].filter(Boolean).join(" ") || "Unknown")}</b>
        <small>${escapeHtml(item.nick)} · ${escapeHtml(item.cpmid)}</small>
        <small>${escapeHtml(item.direction)} · ${escapeHtml(item.contactType)} ${escapeHtml(item.contact)}</small>
      </div>
      <p>${escapeHtml(item.message || "No message")}</p>
      <div class="oni-admin-actions">
        <span class="oni-admin-badge">${escapeHtml(item.status)}</span>
        <button type="button" class="oni-btn oni-btn-ghost" data-app-approve="${escapeHtml(item.id)}">Approve</button>
        <button type="button" class="oni-btn oni-btn-ghost" data-app-reject="${escapeHtml(item.id)}">Reject</button>
      </div>
    </article>
  `).join("");
}

function renderMeet() {
  populateMeetForm();
  const meet = state.meet;
  const now = Date.now();

  if (!meet || !meet.enabled || !Number.isFinite(meet.startMs)) {
    refs.meetState.textContent = "NO ACTIVE MEET";
    refs.meetCountdown.textContent = "—";
    refs.meetParticipantsCount.textContent = String(state.participants.length);
    return;
  }

  refs.meetParticipantsCount.textContent = String(state.participants.length);

  if (now < meet.startMs) {
    refs.meetState.textContent = "UPCOMING";
    refs.meetCountdown.textContent = `${Math.max(0, Math.floor((meet.startMs - now) / 1000))}s`;
  } else if (now < meet.endMs) {
    refs.meetState.textContent = "ACTIVE";
    refs.meetCountdown.textContent = `${Math.max(0, Math.floor((meet.endMs - now) / 1000))}s`;
  } else {
    refs.meetState.textContent = "ENDED";
    refs.meetCountdown.textContent = "00s";
  }
}

function renderTabs() {
  const tabs = [...document.querySelectorAll("[data-admin-tab]")];
  const views = [...document.querySelectorAll("[data-admin-view]")];
  tabs.forEach(tab => {
    const active = tab.dataset.adminTab === state.activeTab;
    tab.classList.toggle("is-active", active);
  });
  views.forEach(view => {
    const active = view.dataset.adminView === state.activeTab;
    view.hidden = !active;
  });
}

function renderAuthState() {
  refs.authLoading.hidden = !state.authLoading;
  refs.authSignedOut.hidden = state.authLoading || !!state.user;
  refs.authUnauthorized.hidden = state.authLoading || !state.user || isAuthorizedUser(state.user);
  refs.adminShell.hidden = state.authLoading || !state.user || !isAuthorizedUser(state.user);
  refs.signedInEmail.textContent = state.user?.email || "";

  if (state.user && isAuthorizedUser(state.user)) {
    renderTabs();
    renderDashboard();
    renderMembers();
    renderGarage();
    renderApplications();
    renderMeet();
  }
}

async function refreshMembers() {
  const db = getFirebase().db;
  const snapshot = await getDocs(collection(db, "members"));
  state.members = snapshot.docs.map(item => memberRecord(item.data(), item.id));
}

async function refreshGarage() {
  const db = getFirebase().db;
  const snapshot = await getDocs(collection(db, "garage"));
  state.garage = snapshot.docs.map(item => garageRecord(item.data(), item.id));
}

async function refreshApplications() {
  const db = getFirebase().db;
  const snapshot = await getDocs(collection(db, "applications"));
  state.applications = snapshot.docs
    .map(item => appRecord(item.data(), item.id))
    .sort((a, b) => {
      const at = Number(a.raw?.createdAt?.seconds || 0);
      const bt = Number(b.raw?.createdAt?.seconds || 0);
      return bt - at;
    });
}

async function refreshMeet() {
  const db = getFirebase().db;
  const [meetSnap, participantsSnap] = await Promise.all([
    getDoc(doc(db, "meets", MEET_DOC_ID)),
    getDocs(query(collection(db, "meetParticipants"), where("meetId", "==", MEET_DOC_ID)))
  ]);

  state.meet = meetSnap.exists() ? meetRecord(meetSnap.data()) : null;

  const meetStart = state.meet?.startAt;
  state.participants = participantsSnap.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => item.id !== "__counter__")
    .filter(item => {
      if (!meetStart) return true;
      if (item.meetStartAt == null) return true;
      return String(item.meetStartAt) === String(meetStart);
    });
}

async function refreshAll() {
  state.loading = true;
  setStatus("Loading admin data…");
  try {
    await Promise.all([refreshMembers(), refreshGarage(), refreshApplications(), refreshMeet()]);
    renderDashboard();
    renderMembers();
    renderGarage();
    renderApplications();
    renderMeet();
    setStatus("Live data loaded", "ok");
  } catch (error) {
    setStatus(`Load failed: ${toErrorText(error)}`, "error");
  } finally {
    state.loading = false;
  }
}

function validateMemberDraft(draft) {
  if (!draft.nick) return "Nick шаардлагатай.";
  if (!draft.cpmid) return "CPM ID шаардлагатай.";
  return "";
}

function readMemberDraft() {
  return {
    name: asText(refs.memberName.value),
    nick: asText(refs.memberNick.value),
    cpmid: asText(refs.memberCpmid.value).toUpperCase(),
    role: asText(refs.memberRole.value) || "member",
    title: asText(refs.memberTitle.value)
  };
}

async function submitMember(event) {
  event.preventDefault();
  const draft = readMemberDraft();
  const error = validateMemberDraft(draft);
  if (error) {
    setStatus(error, "error");
    return;
  }

  const lockId = `member:${state.editingMemberId || "new"}`;
  await withActionLock(lockId, async () => {
    const db = getFirebase().db;
    const payload = {
      name: draft.name,
      nick: draft.nick,
      cpmid: draft.cpmid,
      role: draft.role,
      title: draft.title,
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_EMAIL
    };

    if (state.editingMemberId) {
      await setDoc(doc(db, "members", state.editingMemberId), payload, { merge: true });
      setStatus("Member шинэчлэгдлээ.", "ok");
    } else {
      await addDoc(collection(db, "members"), {
        ...payload,
        source: "manual",
        createdAt: serverTimestamp(),
        createdBy: ADMIN_EMAIL
      });
      setStatus("Member нэмэгдлээ.", "ok");
    }

    resetMemberForm();
    await refreshMembers();
    renderDashboard();
    renderMembers();
  }, busy => setButtonBusy(refs.memberSave, busy, "Saving…"));
}

async function deleteMember(id) {
  if (!id) return;
  if (!confirm("Энэ member-г устгах уу?")) return;

  await withActionLock(`member:delete:${id}`, async () => {
    const db = getFirebase().db;
    await deleteDoc(doc(db, "members", id));
    await refreshMembers();
    renderDashboard();
    renderMembers();
    setStatus("Member устгагдлаа.", "ok");
  });
}

function openMemberEditor(id) {
  const target = state.members.find(item => item.id === id);
  if (!target) return;
  state.editingMemberId = id;
  refs.memberName.value = target.name || "";
  refs.memberNick.value = target.nick || "";
  refs.memberCpmid.value = target.cpmid || "";
  refs.memberRole.value = target.role || "member";
  refs.memberTitle.value = target.title || "";
  refs.memberSave.textContent = "Save member";
}

function validateGarageDraft(draft) {
  if (!draft.name) return "Build name шаардлагатай.";
  if (draft.image) {
    try {
      const url = new URL(draft.image);
      if (!/^https?:$/i.test(url.protocol)) throw new Error("invalid");
    } catch {
      return "Image URL зөвхөн http/https байна.";
    }
  }
  return "";
}

function readGarageDraft() {
  return {
    name: asText(refs.garageName.value),
    owner: asText(refs.garageOwner.value),
    category: asText(refs.garageCategory.value) || "anime",
    anime: asText(refs.garageAnime.value),
    cpmId: asText(refs.garageCpmid.value),
    layer: asText(refs.garageLayer.value),
    image: asText(refs.garageImage.value),
    description: asText(refs.garageDescription.value)
  };
}

async function submitGarage(event) {
  event.preventDefault();
  const draft = readGarageDraft();
  const error = validateGarageDraft(draft);
  if (error) {
    setStatus(error, "error");
    return;
  }

  const lockId = `garage:${state.editingGarageId || "new"}`;
  await withActionLock(lockId, async () => {
    const db = getFirebase().db;
    const payload = {
      ...draft,
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_EMAIL
    };

    if (state.editingGarageId) {
      await setDoc(doc(db, "garage", state.editingGarageId), payload, { merge: true });
      setStatus("Garage build шинэчлэгдлээ.", "ok");
    } else {
      await addDoc(collection(db, "garage"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: ADMIN_EMAIL
      });
      setStatus("Garage build нэмэгдлээ.", "ok");
    }

    resetGarageForm();
    await refreshGarage();
    renderDashboard();
    renderGarage();
  }, busy => setButtonBusy(refs.garageSave, busy, "Saving…"));
}

function openGarageEditor(id) {
  const target = state.garage.find(item => item.id === id);
  if (!target) return;
  state.editingGarageId = id;
  refs.garageName.value = target.name || "";
  refs.garageOwner.value = target.owner || "";
  refs.garageCategory.value = target.category || "anime";
  refs.garageAnime.value = target.anime || "";
  refs.garageCpmid.value = target.cpmId || "";
  refs.garageLayer.value = target.layer || "";
  refs.garageImage.value = target.image || "";
  refs.garageDescription.value = target.description || "";
  refs.garageSave.textContent = "Save build";
}

async function deleteGarageItem(id) {
  if (!id) return;
  if (!confirm("Энэ garage build-ийг устгах уу?")) return;

  await withActionLock(`garage:delete:${id}`, async () => {
    const db = getFirebase().db;
    await deleteDoc(doc(db, "garage", id));
    await refreshGarage();
    renderDashboard();
    renderGarage();
    setStatus("Garage build устгагдлаа.", "ok");
  });
}

async function approveApplication(id) {
  if (!id) return;

  await withActionLock(`application:approve:${id}`, async () => {
    const db = getFirebase().db;
    const duplicate = await getDocs(query(collection(db, "members"), where("applicationId", "==", id)));

    await runTransaction(db, async transaction => {
      const appRef = doc(db, "applications", id);
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists()) throw new Error("Application not found");

      const data = appRecord(appSnap.data(), id);
      if (data.status === "Зөвшөөрсөн") return;

      if (!duplicate.empty) {
        transaction.update(appRef, {
          status: "Зөвшөөрсөн",
          reviewedAt: serverTimestamp(),
          reviewedBy: ADMIN_EMAIL
        });
        return;
      }

      const memberRef = doc(collection(db, "members"));
      transaction.set(memberRef, {
        name: [data.first, data.last].filter(Boolean).join(" "),
        nick: data.nick,
        cpmid: data.cpmid,
        role: "member",
        title: "MEMBER",
        source: "application",
        applicationId: id,
        createdAt: serverTimestamp(),
        createdBy: ADMIN_EMAIL,
        updatedAt: serverTimestamp(),
        updatedBy: ADMIN_EMAIL
      });
      transaction.update(appRef, {
        status: "Зөвшөөрсөн",
        reviewedAt: serverTimestamp(),
        reviewedBy: ADMIN_EMAIL
      });
    });

    await Promise.all([refreshApplications(), refreshMembers()]);
    renderDashboard();
    renderApplications();
    renderMembers();
    setStatus("Application approve хийгдлээ.", "ok");
  });
}

async function rejectApplication(id) {
  if (!id) return;
  await withActionLock(`application:reject:${id}`, async () => {
    const db = getFirebase().db;
    await updateDoc(doc(db, "applications", id), {
      status: "Татгалзсан",
      reviewedAt: serverTimestamp(),
      reviewedBy: ADMIN_EMAIL
    });
    await refreshApplications();
    renderDashboard();
    renderApplications();
    setStatus("Application татгалзлаа.", "ok");
  });
}

async function saveMeet(event) {
  event.preventDefault();
  const name = asText(refs.meetName.value);
  const date = asText(refs.meetDate.value);
  const time = asText(refs.meetTime.value);
  const roomId = asText(refs.meetRoomId.value);
  const password = asText(refs.meetPass.value);
  const roomLabel = asText(refs.meetRoomLabel.value);
  const durationMinutes = Math.min(120, Math.max(1, Number(refs.meetDuration.value || 20) || 20));
  const maxPlayers = Math.min(200, Math.max(1, Number(refs.meetMax.value || 20) || 20));

  if (!name || !date || !time || !roomId || !password) {
    setStatus("Meet name, date, time, room ID, PASS заавал оруулна.", "error");
    return;
  }

  const startAt = new Date(`${date}T${time}`);
  if (!Number.isFinite(startAt.getTime())) {
    setStatus("Meet эхлэх огноо/цаг буруу байна.", "error");
    return;
  }

  await withActionLock("meet:save", async () => {
    const db = getFirebase().db;
    await setDoc(doc(db, "meets", MEET_DOC_ID), {
      name,
      roomLabel,
      roomId,
      password,
      durationMinutes,
      maxPlayers,
      enabled: true,
      startAt: startAt.toISOString(),
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_EMAIL
    }, { merge: true });

    await refreshMeet();
    renderDashboard();
    renderMeet();
    setStatus("Meet хадгалагдлаа.", "ok");
  }, busy => {
    const submitButton = refs.meetForm?.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, busy, "Saving meet…");
  });
}

async function disableMeet() {
  await withActionLock("meet:disable", async () => {
    const db = getFirebase().db;
    await setDoc(doc(db, "meets", MEET_DOC_ID), {
      enabled: false,
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_EMAIL
    }, { merge: true });

    await refreshMeet();
    renderDashboard();
    renderMeet();
    setStatus("Meet inactive боллоо.", "ok");
  }, busy => setButtonBusy(refs.meetDisable, busy, "Disabling…"));
}

function collectRefs() {
  Object.assign(refs, {
    authLoading: queryNode("[data-admin-auth-loading]"),
    authSignedOut: queryNode("[data-admin-auth-signed-out]"),
    authUnauthorized: queryNode("[data-admin-auth-unauthorized]"),
    adminShell: queryNode("[data-admin-shell]"),
    signedInEmail: queryNode("[data-admin-signed-email]"),
    status: queryNode("[data-admin-status]"),

    email: queryNode("[data-admin-email]"),
    password: queryNode("[data-admin-password]"),
    loginButton: queryNode("[data-admin-login]"),
    resetButton: queryNode("[data-admin-reset]"),
    logoutButton: queryNode("[data-admin-logout]"),

    statMembers: queryNode("[data-admin-stat-members]"),
    statGarage: queryNode("[data-admin-stat-garage]"),
    statApplications: queryNode("[data-admin-stat-applications]"),
    statMeet: queryNode("[data-admin-stat-meet]"),
    statParticipants: queryNode("[data-admin-stat-participants]"),

    memberSearch: queryNode("[data-member-search]"),
    memberCount: queryNode("[data-member-count]"),
    memberList: queryNode("[data-member-list]"),
    memberForm: queryNode("[data-member-form]"),
    memberName: queryNode("[data-member-name]"),
    memberNick: queryNode("[data-member-nick]"),
    memberCpmid: queryNode("[data-member-cpmid]"),
    memberRole: queryNode("[data-member-role]"),
    memberTitle: queryNode("[data-member-title]"),
    memberSave: queryNode("[data-member-save]"),
    memberCancel: queryNode("[data-member-cancel]"),

    garageSearch: queryNode("[data-garage-search]"),
    garageCount: queryNode("[data-garage-count]"),
    garageList: queryNode("[data-garage-list]"),
    garageForm: queryNode("[data-garage-form]"),
    garageName: queryNode("[data-garage-name]"),
    garageOwner: queryNode("[data-garage-owner]"),
    garageCategory: queryNode("[data-garage-category]"),
    garageAnime: queryNode("[data-garage-anime]"),
    garageCpmid: queryNode("[data-garage-cpmid]"),
    garageLayer: queryNode("[data-garage-layer]"),
    garageImage: queryNode("[data-garage-image]"),
    garageDescription: queryNode("[data-garage-description]"),
    garageSave: queryNode("[data-garage-save]"),
    garageCancel: queryNode("[data-garage-cancel]"),

    appCount: queryNode("[data-application-count]"),
    applicationList: queryNode("[data-application-list]"),

    meetForm: queryNode("[data-meet-form]"),
    meetName: queryNode("[data-meet-name]"),
    meetRoomLabel: queryNode("[data-meet-room-label]"),
    meetDate: queryNode("[data-meet-date]"),
    meetTime: queryNode("[data-meet-time]"),
    meetDuration: queryNode("[data-meet-duration]"),
    meetMax: queryNode("[data-meet-max]"),
    meetRoomId: queryNode("[data-meet-room-id]"),
    meetPass: queryNode("[data-meet-password]"),
    meetState: queryNode("[data-meet-state]"),
    meetCountdown: queryNode("[data-meet-countdown]"),
    meetParticipantsCount: queryNode("[data-meet-participants-count]"),
    meetDisable: queryNode("[data-meet-disable]"),

    refreshButton: queryNode("[data-admin-refresh]")
  });
}

function bindEvents() {
  refs.loginButton?.addEventListener("click", async () => {
    const email = asText(refs.email.value).toLowerCase();
    const password = refs.password.value;
    if (!email || !password) {
      setStatus("Email болон password шаардлагатай.", "error");
      return;
    }
    await withActionLock("auth:login", async () => {
      await signInWithEmailAndPassword(getAuth(getFirebase().app), email, password);
      setStatus("Signed in.", "ok");
    }, busy => setButtonBusy(refs.loginButton, busy, "Signing in…")).catch(error => {
      setStatus(`Login failed: ${toErrorText(error)}`, "error");
    });
  });

  refs.resetButton?.addEventListener("click", async () => {
    const email = asText(refs.email.value).toLowerCase();
    if (!email) {
      setStatus("Reset хийх email оруулна уу.", "error");
      return;
    }
    await withActionLock("auth:reset", async () => {
      await sendPasswordResetEmail(getAuth(getFirebase().app), email);
      setStatus("Reset email илгээлээ.", "ok");
    }, busy => setButtonBusy(refs.resetButton, busy, "Sending…"))
      .catch(error => setStatus(`Reset failed: ${toErrorText(error)}`, "error"));
  });

  refs.logoutButton?.addEventListener("click", () => {
    signOut(getAuth(getFirebase().app));
  });

  refs.refreshButton?.addEventListener("click", () => {
    if (!state.user || !isAuthorizedUser(state.user)) return;
    refreshAll();
  });

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const tab = target.closest("[data-admin-tab]");
    if (tab instanceof HTMLElement) {
      state.activeTab = tab.dataset.adminTab || "dashboard";
      renderTabs();
      return;
    }

    const memberEdit = target.closest("[data-member-edit]");
    if (memberEdit instanceof HTMLElement) {
      openMemberEditor(memberEdit.dataset.memberEdit || "");
      return;
    }

    const memberDelete = target.closest("[data-member-delete]");
    if (memberDelete instanceof HTMLElement) {
      deleteMember(memberDelete.dataset.memberDelete || "").catch(error => {
        setStatus(`Member delete failed: ${toErrorText(error)}`, "error");
      });
      return;
    }

    const garageEdit = target.closest("[data-garage-edit]");
    if (garageEdit instanceof HTMLElement) {
      openGarageEditor(garageEdit.dataset.garageEdit || "");
      return;
    }

    const garageDelete = target.closest("[data-garage-delete]");
    if (garageDelete instanceof HTMLElement) {
      deleteGarageItem(garageDelete.dataset.garageDelete || "").catch(error => {
        setStatus(`Garage delete failed: ${toErrorText(error)}`, "error");
      });
      return;
    }

    const appApprove = target.closest("[data-app-approve]");
    if (appApprove instanceof HTMLElement) {
      approveApplication(appApprove.dataset.appApprove || "").catch(error => {
        setStatus(`Approve failed: ${toErrorText(error)}`, "error");
      });
      return;
    }

    const appReject = target.closest("[data-app-reject]");
    if (appReject instanceof HTMLElement) {
      rejectApplication(appReject.dataset.appReject || "").catch(error => {
        setStatus(`Reject failed: ${toErrorText(error)}`, "error");
      });
    }
  });

  refs.memberSearch?.addEventListener("input", renderMembers, { passive: true });
  refs.garageSearch?.addEventListener("input", renderGarage, { passive: true });
  refs.memberCancel?.addEventListener("click", resetMemberForm);
  refs.garageCancel?.addEventListener("click", resetGarageForm);
  refs.memberForm?.addEventListener("submit", event => {
    submitMember(event).catch(error => setStatus(`Member save failed: ${toErrorText(error)}`, "error"));
  });
  refs.garageForm?.addEventListener("submit", event => {
    submitGarage(event).catch(error => setStatus(`Garage save failed: ${toErrorText(error)}`, "error"));
  });

  refs.meetForm?.addEventListener("submit", event => {
    saveMeet(event).catch(error => setStatus(`Meet save failed: ${toErrorText(error)}`, "error"));
  });
  refs.meetDisable?.addEventListener("click", () => {
    disableMeet().catch(error => setStatus(`Meet disable failed: ${toErrorText(error)}`, "error"));
  });
}

function boot() {
  collectRefs();
  bindEvents();

  const auth = getAuth(getFirebase().app);
  onAuthStateChanged(auth, async user => {
    state.user = user || null;
    state.authLoading = false;
    renderAuthState();

    if (!user || !isAuthorizedUser(user)) {
      return;
    }

    await refreshAll();
    renderAuthState();
  });
}

boot();
