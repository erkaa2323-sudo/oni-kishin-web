import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";

const RESUBMIT_BLOCK_MS = 10 * 60 * 1000;
const SUBMISSION_MARKER = "oni.v2.join.lastSubmission";
const REJECTED_STATUS = "Татгалзсан";

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

export function normalizeApplicationRecord(raw = {}, docId = "") {
  return {
    id: asText(docId),
    firstName: pickFirstText(raw.firstName, raw.first),
    lastName: pickFirstText(raw.lastName, raw.last),
    nickname: pickFirstText(raw.nickname, raw.nick),
    cpmId: pickFirstText(raw.cpmId, raw.cpmid),
    direction: pickFirstText(raw.direction),
    contactType: pickFirstText(raw.contactType),
    contact: pickFirstText(raw.contact),
    experience: pickFirstText(raw.experience),
    message: pickFirstText(raw.message),
    status: pickFirstText(raw.status, "Шинэ"),
    age: Number(raw.age || 0),
    gender: pickFirstText(raw.gender)
  };
}

export function normalizeJoinDraft(raw = {}) {
  const age = Number(raw.age || 0);
  return {
    first: asText(raw.first),
    last: asText(raw.last),
    age: Number.isFinite(age) ? age : 0,
    gender: asText(raw.gender),
    cpmid: asText(raw.cpmid).toUpperCase(),
    nick: asText(raw.nick),
    direction: asText(raw.direction),
    contactType: asText(raw.contactType),
    contact: asText(raw.contact),
    experience: asText(raw.experience),
    message: asText(raw.message)
  };
}

export function validateJoinDraft(draft) {
  const errors = [];

  if (!draft.last) errors.push("Овог шаардлагатай.");
  if (!draft.first) errors.push("Нэр шаардлагатай.");
  if (!Number.isFinite(draft.age) || draft.age < 17 || draft.age > 99) {
    errors.push("Нас 17-99 хооронд байх ёстой.");
  }
  if (!draft.gender) errors.push("Хүйсээ сонгоно уу.");

  if (!draft.cpmid) {
    errors.push("CPM ID шаардлагатай.");
  } else {
    if (draft.cpmid.length < 2 || draft.cpmid.length > 40) {
      errors.push("CPM ID 2-40 тэмдэгт байх ёстой.");
    }
    if (/\s{2,}/.test(draft.cpmid)) {
      errors.push("CPM ID давхар зайтай байж болохгүй.");
    }
  }

  if (!draft.nick) errors.push("CPM нэр шаардлагатай.");
  if (!draft.direction) errors.push("Чиглэлээ сонгоно уу.");
  if (!draft.contactType) errors.push("Холбоо барих төрлөө сонгоно уу.");
  if (!draft.contact) errors.push("Холбоо барих хаягаа оруулна уу.");
  if (!draft.experience) errors.push("Туршлагаа сонгоно уу.");

  if (draft.first.length > 40) errors.push("Нэр хэт урт байна.");
  if (draft.last.length > 40) errors.push("Овог хэт урт байна.");
  if (draft.nick.length > 50) errors.push("CPM нэр хэт урт байна.");
  if (draft.contact.length > 120) errors.push("Холбоо барих хаяг хэт урт байна.");
  if (draft.message.length > 500) errors.push("Зурвас хэт урт байна.");

  return {
    valid: errors.length === 0,
    errors
  };
}

export function buildApplicationPayload(draft) {
  return {
    first: draft.first,
    firstName: draft.first,
    last: draft.last,
    lastName: draft.last,
    age: draft.age,
    gender: draft.gender,
    cpmid: draft.cpmid,
    cpmId: draft.cpmid,
    nick: draft.nick,
    nickname: draft.nick,
    direction: draft.direction,
    contactType: draft.contactType,
    contact: draft.contact,
    experience: draft.experience,
    message: draft.message,
    status: "Шинэ",
    createdAt: serverTimestamp()
  };
}

function submissionKey(draft) {
  return `${draft.cpmid.toLowerCase()}::${draft.nick.toLowerCase()}`;
}

function readLastSubmission() {
  try {
    const raw = localStorage.getItem(SUBMISSION_MARKER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.key !== "string" || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLastSubmission(key) {
  try {
    localStorage.setItem(SUBMISSION_MARKER, JSON.stringify({ key, at: Date.now() }));
  } catch {
    // Ignore storage write failure.
  }
}

async function hasRecentDuplicate(db, draft) {
  const byCpmid = query(collection(db, "applications"), where("cpmid", "==", draft.cpmid), limit(20));
  const byLegacy = query(collection(db, "applications"), where("cpmId", "==", draft.cpmid), limit(20));

  const [newDocs, legacyDocs] = await Promise.all([getDocs(byCpmid), getDocs(byLegacy)]);
  const records = [
    ...newDocs.docs.map(docSnap => normalizeApplicationRecord(docSnap.data(), docSnap.id)),
    ...legacyDocs.docs.map(docSnap => normalizeApplicationRecord(docSnap.data(), docSnap.id))
  ];

  const targetNick = draft.nick.toLowerCase();
  const targetCpmId = draft.cpmid.toLowerCase();

  return records.some(record => {
    if (!record.nickname || !record.cpmId) return false;
    if (record.status === REJECTED_STATUS) return false;
    return record.nickname.toLowerCase() === targetNick && record.cpmId.toLowerCase() === targetCpmId;
  });
}

function fieldMarkup(config) {
  return `
    <label class="oni-join-field">
      <span>${escapeHtml(config.label)}</span>
      ${config.type === "select"
        ? `<select data-join-field="${escapeHtml(config.name)}">${config.options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option || "Select")}</option>`).join("")}</select>`
        : config.type === "textarea"
          ? `<textarea data-join-field="${escapeHtml(config.name)}" maxlength="${config.max || 500}" placeholder="${escapeHtml(config.placeholder || "")}"></textarea>`
          : `<input data-join-field="${escapeHtml(config.name)}" type="${escapeHtml(config.type || "text")}" maxlength="${config.max || 120}" inputmode="${escapeHtml(config.inputmode || "text")}" autocomplete="off" placeholder="${escapeHtml(config.placeholder || "")}">`
      }
    </label>
  `;
}

export function joinRouteMarkup() {
  const fields = [
    { name: "last", label: "Овог *", max: 40, placeholder: "Овог" },
    { name: "first", label: "Нэр *", max: 40, placeholder: "Нэр" },
    { name: "age", label: "Нас *", type: "number", max: 2, inputmode: "numeric", placeholder: "17" },
    { name: "gender", label: "Хүйс *", type: "select", options: ["", "Эрэгтэй", "Эмэгтэй"] },
    { name: "cpmid", label: "CPM ID *", max: 40, placeholder: "ONI0001" },
    { name: "nick", label: "CPM нэр *", max: 50, placeholder: "Kitsune" },
    {
      name: "direction",
      label: "Чиглэл *",
      type: "select",
      options: ["", "Цэвэр машин", "Анимэ машин", "Уралдаан / Дрифт", "Драг", "Контент бүтээгч", "Бусад"]
    },
    {
      name: "experience",
      label: "Туршлага *",
      type: "select",
      options: ["", "6 сараас бага", "6 сар – 1 жил", "1 – 2 жил", "2 жилээс дээш"]
    },
    { name: "contactType", label: "Холбоо барих төрөл *", type: "select", options: ["", "Instagram", "Discord", "Утас"] },
    { name: "contact", label: "Холбоо барих хаяг *", max: 120, placeholder: "@username / утас / discord" },
    { name: "message", label: "Нэмэлт зурвас", type: "textarea", max: 500, placeholder: "Өөрийн талаар товч бичнэ үү" }
  ];

  return `
    <section class="oni-join-view" data-join-view>
      <header class="oni-section-head oni-route-head">
        <p class="oni-route-kicker">ONI RECRUITMENT GATE</p>
        <h1 class="oni-route-title">ONI &amp; KISHIN-Д НЭГДЭХ</h1>
        <p class="oni-route-copy">Кланд элсэх хүсэлтээ илгээнэ үү. Энэ бол application submit бөгөөд автоматаар accepted гэсэн утга биш.</p>
      </header>

      <article class="oni-card oni-join-card">
        <form data-join-form novalidate>
          <div class="oni-join-grid">${fields.map(fieldMarkup).join("")}</div>
          <div class="oni-join-actions">
            <button class="oni-btn oni-btn-primary" type="submit" data-join-submit>ИЛГЭЭХ</button>
            <button class="oni-btn oni-btn-ghost" type="button" data-join-reset>ЦЭВЭРЛЭХ</button>
            <a class="oni-btn oni-btn-ghost oni-join-return" href="#garage">ГАРАЖ РУУ ОРОХ</a>
          </div>
          <p class="oni-join-state" data-join-state role="status" aria-live="polite"></p>
          <p class="oni-join-error" data-join-error role="alert"></p>
        </form>
      </article>
    </section>
  `;
}

export function createJoinModule() {
  let host = null;
  let isMounted = false;
  let requestId = 0;
  let submitting = false;
  let stateMessage = "";
  let errorMessage = "";
  let submitted = false;
  const dispose = [];

  function removeListeners() {
    while (dispose.length) {
      const fn = dispose.pop();
      try {
        fn();
      } catch {
        // Ignore cleanup failures.
      }
    }
  }

  function getNodes() {
    if (!(host instanceof HTMLElement)) return {};
    return {
      form: host.querySelector("[data-join-form]"),
      state: host.querySelector("[data-join-state]"),
      error: host.querySelector("[data-join-error]"),
      submit: host.querySelector("[data-join-submit]"),
      reset: host.querySelector("[data-join-reset]")
    };
  }

  function readDraftFromDom() {
    if (!(host instanceof HTMLElement)) return normalizeJoinDraft({});

    const valueOf = name => {
      const node = host.querySelector(`[data-join-field="${name}"]`);
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
        return "";
      }
      return node.value;
    };

    return normalizeJoinDraft({
      first: valueOf("first"),
      last: valueOf("last"),
      age: valueOf("age"),
      gender: valueOf("gender"),
      cpmid: valueOf("cpmid"),
      nick: valueOf("nick"),
      direction: valueOf("direction"),
      contactType: valueOf("contactType"),
      contact: valueOf("contact"),
      experience: valueOf("experience"),
      message: valueOf("message")
    });
  }

  function preserveIdentityFields() {
    if (!(host instanceof HTMLElement)) return;
    const keep = ["first", "last", "cpmid", "nick"];
    const cache = new Map();

    for (const name of keep) {
      const node = host.querySelector(`[data-join-field="${name}"]`);
      if (node instanceof HTMLInputElement) cache.set(name, node.value);
    }

    const form = host.querySelector("[data-join-form]");
    if (form instanceof HTMLFormElement) form.reset();

    for (const [name, value] of cache.entries()) {
      const node = host.querySelector(`[data-join-field="${name}"]`);
      if (node instanceof HTMLInputElement) node.value = value;
    }
  }

  function render() {
    if (!isMounted || !(host instanceof HTMLElement)) return;
    const { state, error, submit } = getNodes();

    if (state) state.textContent = stateMessage;
    if (error) error.textContent = errorMessage;
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = submitting || submitted;
      submit.textContent = submitting ? "Илгээж байна..." : submitted ? "Илгээгдсэн" : "ИЛГЭЭХ";
    }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!isMounted || submitting || submitted) return;
    submitting = true;

    const token = ++requestId;
    const draft = readDraftFromDom();
    const validation = validateJoinDraft(draft);

    errorMessage = "";
    stateMessage = "";

    if (!validation.valid) {
      errorMessage = validation.errors[0] || "Маягтын мэдээллээ шалгана уу.";
      submitting = false;
      render();
      return;
    }

    const key = submissionKey(draft);
    const local = readLastSubmission();
    if (local && local.key === key && Date.now() - local.at < RESUBMIT_BLOCK_MS) {
      errorMessage = "Та саяхан илгээсэн байна. Түр хүлээгээд дахин оролдоно уу.";
      submitting = false;
      render();
      return;
    }

    stateMessage = "Илгээж байна...";
    render();

    try {
      const db = getFirestoreDb();
      const duplicate = await hasRecentDuplicate(db, draft);
      if (!isMounted || token !== requestId) return;

      if (duplicate) {
        throw new Error("DUPLICATE_APPLICATION");
      }

      await addDoc(collection(db, "applications"), buildApplicationPayload(draft));
      if (!isMounted || token !== requestId) return;

      writeLastSubmission(key);
      submitted = true;
      preserveIdentityFields();
      stateMessage = "Хүсэлт илгээгдлээ. Энэ нь зөвшөөрөгдсөн гэсэн үг биш — crew review хүлээгдэж байна.";
      errorMessage = "";
      const submitButton = host?.querySelector("[data-join-submit]");
      if (submitButton instanceof HTMLElement) {
        window.dispatchEvent(new CustomEvent("oni:success-burst", { detail: { target: submitButton } }));
      }
    } catch (error) {
      if (!isMounted || token !== requestId) return;

      if (error instanceof Error && error.message === "DUPLICATE_APPLICATION") {
        errorMessage = "Ижил CPM ID болон nick-тэй идэвхтэй хүсэлт байна.";
      } else {
        errorMessage = "Мэдээлэлтэй холбогдож чадсангүй.";
      }
      stateMessage = "";
      submitted = false;
    } finally {
      if (!isMounted || token !== requestId) return;
      submitting = false;
      render();
    }
  }

  function resetForm() {
    if (!isMounted || !(host instanceof HTMLElement)) return;
    const form = host.querySelector("[data-join-form]");
    if (form instanceof HTMLFormElement) form.reset();
    submitted = false;
    stateMessage = "";
    errorMessage = "";
    render();
  }

  function bindListeners() {
    const { form, reset } = getNodes();

    if (form instanceof HTMLFormElement) {
      form.addEventListener("submit", submitApplication);
      dispose.push(() => form.removeEventListener("submit", submitApplication));
    }

    if (reset instanceof HTMLButtonElement) {
      reset.addEventListener("click", resetForm, { passive: true });
      dispose.push(() => reset.removeEventListener("click", resetForm));
    }
  }

  return {
    key: "join",
    title: "Join",
    description: "Clan application route with production-compatible applications payload and duplicate-submit protections.",
    status: "live",

    mount(root) {
      if (!(root instanceof HTMLElement)) return;
      if (isMounted && host === root) return;

      this.unmount();

      host = root;
      isMounted = true;
      requestId += 1;
      submitting = false;
      submitted = false;
      stateMessage = "";
      errorMessage = "";

      host.innerHTML = joinRouteMarkup();
      bindListeners();
      render();
    },

    unmount() {
      isMounted = false;
      requestId += 1;
      submitting = false;
      removeListeners();
      host = null;
      stateMessage = "";
      errorMessage = "";
      submitted = false;
    }
  };
}
