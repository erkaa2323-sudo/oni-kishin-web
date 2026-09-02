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

  if (!draft.last) errors.push("Last name is required.");
  if (!draft.first) errors.push("First name is required.");
  if (!Number.isFinite(draft.age) || draft.age < 17 || draft.age > 99) {
    errors.push("Age must be between 17 and 99.");
  }
  if (!draft.gender) errors.push("Gender is required.");

  if (!draft.cpmid) {
    errors.push("CPM ID is required.");
  } else {
    if (draft.cpmid.length < 2 || draft.cpmid.length > 40) {
      errors.push("CPM ID must be 2-40 characters.");
    }
    if (/\s{2,}/.test(draft.cpmid)) {
      errors.push("CPM ID cannot contain repeated spaces.");
    }
  }

  if (!draft.nick) errors.push("CPM Nick is required.");
  if (!draft.direction) errors.push("Direction is required.");
  if (!draft.contactType) errors.push("Contact type is required.");
  if (!draft.contact) errors.push("Contact value is required.");
  if (!draft.experience) errors.push("Experience is required.");

  if (draft.first.length > 40) errors.push("First name is too long.");
  if (draft.last.length > 40) errors.push("Last name is too long.");
  if (draft.nick.length > 50) errors.push("CPM Nick is too long.");
  if (draft.contact.length > 120) errors.push("Contact value is too long.");
  if (draft.message.length > 500) errors.push("Message is too long.");

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
    { name: "last", label: "Last name *", max: 40, placeholder: "Family name" },
    { name: "first", label: "First name *", max: 40, placeholder: "Given name" },
    { name: "age", label: "Age *", type: "number", max: 2, inputmode: "numeric", placeholder: "17" },
    { name: "gender", label: "Gender *", type: "select", options: ["", "Эрэгтэй", "Эмэгтэй"] },
    { name: "cpmid", label: "CPM ID *", max: 40, placeholder: "ONI0001" },
    { name: "nick", label: "CPM Nick *", max: 50, placeholder: "Kitsune" },
    {
      name: "direction",
      label: "Direction *",
      type: "select",
      options: ["", "Clean Car", "Anime Car", "Racer / Drifter", "Drag Racer", "Content Creator", "Other"]
    },
    {
      name: "experience",
      label: "Experience *",
      type: "select",
      options: ["", "6 сараас бага", "6 сар – 1 жил", "1 – 2 жил", "2 жилээс дээш"]
    },
    { name: "contactType", label: "Contact type *", type: "select", options: ["", "Instagram", "Discord", "Phone"] },
    { name: "contact", label: "Contact *", max: 120, placeholder: "@username / phone / discord" },
    { name: "message", label: "Message", type: "textarea", max: 500, placeholder: "Optional note about your profile" }
  ];

  return `
    <section class="oni-join-view" data-join-view>
      <header class="oni-section-head">
        <h1>Join ONI &amp; KISHIN</h1>
        <p>Application writes to Firestore <code>applications</code> with production-compatible fields for Admin review.</p>
      </header>

      <article class="oni-card oni-join-card">
        <form data-join-form novalidate>
          <div class="oni-join-grid">${fields.map(fieldMarkup).join("")}</div>
          <div class="oni-join-actions">
            <button class="oni-btn oni-btn-primary" type="submit" data-join-submit>Submit application</button>
            <button class="oni-btn oni-btn-ghost" type="button" data-join-reset>Reset</button>
            <a class="oni-btn oni-btn-ghost oni-join-return" href="#garage">Go to Garage</a>
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
      submit.textContent = submitting ? "Submitting..." : submitted ? "Application submitted" : "Submit application";
    }
  }

  async function submitApplication(event) {
    event.preventDefault();
    if (!isMounted || submitting || submitted) return;

    const token = ++requestId;
    const draft = readDraftFromDom();
    const validation = validateJoinDraft(draft);

    errorMessage = "";
    stateMessage = "";

    if (!validation.valid) {
      errorMessage = validation.errors[0] || "Invalid submission.";
      render();
      return;
    }

    const key = submissionKey(draft);
    const local = readLastSubmission();
    if (local && local.key === key && Date.now() - local.at < RESUBMIT_BLOCK_MS) {
      errorMessage = "You already submitted recently. Please wait before retrying.";
      render();
      return;
    }

    submitting = true;
    stateMessage = "Submitting application...";
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
      stateMessage = "Application submitted successfully. Admin will review it soon.";
      errorMessage = "";
      const submitButton = host?.querySelector("[data-join-submit]");
      if (submitButton instanceof HTMLElement) {
        window.dispatchEvent(new CustomEvent("oni:success-burst", { detail: { target: submitButton } }));
      }
    } catch (error) {
      if (!isMounted || token !== requestId) return;

      if (error instanceof Error && error.message === "DUPLICATE_APPLICATION") {
        errorMessage = "An active application with the same CPM ID and nick already exists.";
      } else {
        errorMessage = "Unable to submit application right now. Please retry.";
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
