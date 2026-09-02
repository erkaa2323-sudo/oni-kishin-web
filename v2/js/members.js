import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";
const HTMLElementRef = globalThis.HTMLElement || class {};
const HTMLButtonElementRef = globalThis.HTMLButtonElement || class {};
const HTMLSelectElementRef = globalThis.HTMLSelectElement || class {};
const HTMLInputElementRef = globalThis.HTMLInputElement || class {};
const HTMLImageElementRef = globalThis.HTMLImageElement || class {};
const ElementRef = globalThis.Element || class {};

import { normalizeGarageRecord } from "./garage.js";

const ROLE_LABELS = {
  leader: "Ахлагч",
  "co-leader": "Дэд ахлагч",
  special: "Тусгай",
  member: "Гишүүн"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function normalizeRole(rawRole) {
  const value = String(rawRole ?? "").trim().toLowerCase();
  if (value === "leader" || value === "co-leader" || value === "special") return value;
  return "member";
}

function toMillis(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt?.toMillis === "function") return createdAt.toMillis();
  if (typeof createdAt?.seconds === "number") return createdAt.seconds * 1000;
  if (typeof createdAt === "number") return createdAt < 1e12 ? createdAt * 1000 : createdAt;
  const parsed = Date.parse(String(createdAt));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSafeImageUrl(value) {
  const text = asText(value);
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return true;
  if (/^data:image\//i.test(text)) return true;
  if (text.startsWith("/")) return true;
  if (text.startsWith("./") || text.startsWith("../")) return true;
  return false;
}

function initials(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map(word => word.charAt(0)).join("").toUpperCase() || "ON";
}

function hasListenerApi(node) {
  return !!node && typeof node.addEventListener === "function" && typeof node.removeEventListener === "function";
}

export function normalizeMemberRecord(raw = {}, docId = "") {
  const nameFromParts = [asText(raw.first), asText(raw.last)].filter(Boolean).join(" ");
  const nickname = pickFirstText(raw.nick, raw.nickname, raw.cpmNick, raw.displayName, raw.name, nameFromParts, "ONI MEMBER");
  const cpmId = pickFirstText(raw.cpmid, raw.cpmId, raw.cpm_id, raw.cpm, raw.playerId, raw.id, "CPM ID");
  const title = pickFirstText(raw.title, raw.roleTitle, raw.rank, "");
  const direction = pickFirstText(raw.direction, raw.style, raw.specialty, "");
  const role = normalizeRole(raw.role);
  const avatarUrl = pickFirstText(
    raw.image,
    raw.avatar,
    raw.avatarUrl,
    raw.photo,
    raw.photoURL,
    raw.profileImage,
    raw.profilePhoto,
    raw.thumbnail
  );
  const fullName = pickFirstText(raw.name, nameFromParts, nickname);

  const searchBlob = [nickname, fullName, cpmId, role, title, direction]
    .join(" ")
    .toLowerCase();

  return {
    id: asText(docId) || `member-${Math.random().toString(36).slice(2, 10)}`,
    nickname,
    cpmId,
    title,
    direction,
    role,
    roleLabel: ROLE_LABELS[role],
    fullName,
    avatarUrl: isSafeImageUrl(avatarUrl) ? avatarUrl : "",
    createdAtMs: toMillis(raw.createdAt),
    searchBlob
  };
}

export function filterMembers(records, searchQuery, roleFilter) {
  const query = asText(searchQuery).toLowerCase();
  const role = asText(roleFilter).toLowerCase();

  return records.filter(member => {
    if (role && role !== "all" && member.role !== role) return false;
    if (!query) return true;
    return member.searchBlob.includes(query);
  });
}

function cardMarkup(member, index = 0) {
  const roleClass = member.role === "member" ? "" : ` oni-role-${member.role}`;
  const metaParts = [member.title, member.direction].filter(Boolean);
  const meta = metaParts.length ? escapeHtml(metaParts.join(" • ")) : "ONI CREW";

  const avatar = member.avatarUrl
    ? `<img class="oni-member-avatar-image" src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.nickname)} avatar" loading="lazy" decoding="async">`
    : `<span class="oni-member-avatar-fallback" aria-hidden="true">${escapeHtml(initials(member.nickname))}</span>`;

  return `
    <button type="button" class="oni-member-card${roleClass}" data-member-open="${escapeHtml(member.id)}" style="--oni-stagger:${Math.min(index, 12)};">
      <div class="oni-member-avatar">${avatar}</div>
      <div class="oni-member-copy">
        <h3>${escapeHtml(member.nickname)}</h3>
        <p class="oni-member-id">CPM ID · ${escapeHtml(member.cpmId)}</p>
        <p class="oni-member-meta">${meta}</p>
      </div>
      <span class="oni-member-role">${escapeHtml(member.roleLabel)}</span>
    </button>
  `;
}

function skeletonMarkup() {
  return Array.from({ length: 6 }, () => `
    <article class="oni-member-card oni-member-card-skeleton" aria-hidden="true">
      <div class="oni-member-avatar"></div>
      <div class="oni-member-copy">
        <p class="oni-member-line"></p>
        <p class="oni-member-line short"></p>
        <p class="oni-member-line"></p>
      </div>
    </article>
  `).join("");
}

export function renderMembersCards(records) {
  return records.map((member, index) => cardMarkup(member, index)).join("");
}

export function membersRouteMarkup() {
  return `
    <section class="oni-members-view" data-members-view>
      <header class="oni-members-head oni-panel-reveal">
        <div>
          <p class="oni-members-kicker">ONI CREW</p>
          <h1>ONI CREW</h1>
          <p class="oni-members-sub">Рольт бүтэцтэй үндсэн roster</p>
        </div>
        <p class="oni-members-state" data-members-state role="status" aria-live="polite"></p>
      </header>

      <section class="oni-members-controls oni-panel-reveal" aria-label="ONI CREW хайлт">
        <label class="oni-members-field oni-members-search-wrap">
          <span class="oni-sr-only">Гишүүн хайх</span>
          <input
            type="search"
            class="oni-members-search"
            data-members-search
            autocomplete="off"
            spellcheck="false"
            placeholder="Nick, CPM ID, role, чиглэлээр хайх"
            aria-label="ONI CREW хайх"
          >
        </label>
        <label class="oni-members-field oni-members-select-wrap">
          <span class="oni-sr-only">Роль сонгох</span>
          <select class="oni-members-select" data-members-role aria-label="ONI CREW роль шүүх">
            <option value="all">Бүх роль</option>
            <option value="leader">Ахлагч</option>
            <option value="co-leader">Дэд ахлагч</option>
            <option value="special">Тусгай</option>
            <option value="member">Гишүүн</option>
          </select>
        </label>
        <button type="button" class="oni-btn oni-btn-ghost" data-members-retry>ДАХИН</button>
      </section>

      <section class="oni-members-grid" data-members-grid aria-live="polite"></section>

      <section class="oni-member-profile" data-member-profile hidden>
        <div class="oni-member-profile-backdrop" data-member-profile-close></div>
        <article class="oni-member-profile-card" role="dialog" aria-modal="true" aria-label="Гишүүний профайл">
          <button type="button" class="oni-btn oni-btn-ghost oni-member-profile-close" data-member-profile-close>БУЦАХ</button>
          <div class="oni-member-profile-body" data-member-profile-body></div>
        </article>
      </section>
    </section>
  `;
}

export function createMembersModule() {
  let host = null;
  let isMounted = false;
  let requestId = 0;
  let records = [];
  let garageRecords = [];
  let garageLoaded = false;
  let searchQuery = "";
  let roleFilter = "all";
  let loading = false;
  let errorMessage = "";
  let selectedMemberId = "";
  const dispose = [];

  let searchInput;
  let roleSelect;
  let retryButton;
  let stateEl;
  let gridEl;
  let profileEl;
  let profileBody;

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

  function revealCards() {
    if (!gridEl || typeof gridEl.querySelectorAll !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    requestAnimationFrame(() => {
      gridEl.querySelectorAll(".oni-member-card").forEach(node => node.classList.add("is-ready"));
    });
  }

  function relatedBuilds(member) {
    if (!member) return [];
    const nick = asText(member.nickname).toLowerCase();
    const cpmId = asText(member.cpmId).toLowerCase();
    return garageRecords
      .filter(build => {
        const owner = asText(build.owner).toLowerCase();
        const ownerCpm = asText(build.cpmId).toLowerCase();
        if (nick && owner === nick) return true;
        if (cpmId && ownerCpm && ownerCpm === cpmId) return true;
        return false;
      })
      .slice(0, 6);
  }

  function profileMeta(label, value) {
    const text = asText(value);
    if (!text) return "";
    return `<li><small>${escapeHtml(label)}</small><b>${escapeHtml(text)}</b></li>`;
  }

  function profileMarkup(member) {
    const avatar = member.avatarUrl
      ? `<img src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.nickname)} avatar" loading="lazy" decoding="async">`
      : `<span>${escapeHtml(initials(member.nickname))}</span>`;

    const related = relatedBuilds(member);
    return `
      <div class="oni-member-profile-top oni-role-${escapeHtml(member.role)}">
        <div class="oni-member-profile-avatar${member.avatarUrl ? "" : " is-fallback"}">${avatar}</div>
        <div>
          <h3>${escapeHtml(member.nickname)}</h3>
          <p>CPM ID · ${escapeHtml(member.cpmId)}</p>
          <span class="oni-member-role">${escapeHtml(member.roleLabel)}</span>
        </div>
      </div>
      <ul class="oni-member-profile-meta">
        ${profileMeta("Роль", member.roleLabel)}
        ${profileMeta("Цол", member.title)}
        ${profileMeta("Чиглэл", member.direction)}
      </ul>
      <section class="oni-member-related">
        <h4>Холбоотой BUILD</h4>
        ${related.length ? `<div class="oni-member-related-list">${related.map(build => `<article><b>${escapeHtml(build.buildName)}</b><small>${escapeHtml(build.category || build.type || "ONI BUILD")}</small></article>`).join("")}</div>` : '<p>Холбох найдвартай build олдсонгүй.</p>'}
      </section>
    `;
  }

  async function ensureGarageRecords() {
    if (garageLoaded) return;
    try {
      const db = getFirestoreDb();
      const garageSnap = await getDocs(collection(db, "garage"));
      if (!isMounted) return;
      garageRecords = garageSnap.docs
        .map(docSnap => normalizeGarageRecord(docSnap.data(), docSnap.id))
        .sort((a, b) => (b.createdAtMs - a.createdAtMs) || a.buildName.localeCompare(b.buildName));
      garageLoaded = true;
    } catch {
      garageRecords = [];
      garageLoaded = true;
    }
  }

  async function openProfile(memberId) {
    selectedMemberId = asText(memberId);
    await ensureGarageRecords();
    const target = records.find(member => member.id === selectedMemberId);
    if (!target || !profileEl || !profileBody) {
      closeProfile();
      return;
    }

    profileBody.innerHTML = profileMarkup(target);
    profileEl.hidden = false;
    if (typeof document !== "undefined") {
      document.body.classList.add("oni-modal-open");
    }
  }

  function closeProfile() {
    selectedMemberId = "";
    if (profileEl) profileEl.hidden = true;
    if (typeof document !== "undefined") {
      document.body.classList.remove("oni-modal-open");
    }
  }

  function renderState() {
    if (!stateEl || !gridEl) return;

    if (loading) {
      stateEl.textContent = "ONI CREW ачаалж байна…";
      gridEl.innerHTML = skeletonMarkup();
      return;
    }

    if (errorMessage) {
      stateEl.textContent = "ONI CREW ачаалж чадсангүй.";
      gridEl.innerHTML = `
        <article class="oni-card oni-members-empty" role="alert">
          <h2>CREW мэдээлэл боломжгүй</h2>
          <p>${escapeHtml(errorMessage)}</p>
          <button type="button" class="oni-btn oni-btn-primary" data-members-inline-retry>ДАХИН ОРОЛДОХ</button>
        </article>
      `;
      return;
    }

    const visible = filterMembers(records, searchQuery, roleFilter);
    if (!visible.length) {
      stateEl.textContent = records.length
        ? "Тохирох гишүүн олдсонгүй."
        : "ONI CREW-д одоогоор гишүүн алга.";
      gridEl.innerHTML = `
        <article class="oni-card oni-members-empty">
          <h2>${records.length ? "Үр дүн алга" : "CREW хоосон байна"}</h2>
          <p>${records.length ? "Өөр түлхүүр үг эсвэл роль сонгоно уу." : "Firestore холбоо хэвийн боловч roster одоогоор хоосон байна."}</p>
        </article>
      `;
      return;
    }

    stateEl.textContent = `${visible.length} / ${records.length} гишүүн`;
    gridEl.innerHTML = renderMembersCards(visible);
    revealCards();

    if (selectedMemberId && !visible.some(item => item.id === selectedMemberId)) {
      closeProfile();
    }
  }

  async function loadMembers() {
    if (!host || !isMounted) return;

    const token = ++requestId;
    loading = true;
    errorMessage = "";
    renderState();

    try {
      const db = getFirestoreDb();
      const membersSnap = await getDocs(collection(db, "members"));

      if (token !== requestId || !isMounted) return;

      records = membersSnap.docs
        .map(docSnap => normalizeMemberRecord(docSnap.data(), docSnap.id))
        .sort((a, b) => (a.createdAtMs - b.createdAtMs) || a.nickname.localeCompare(b.nickname));
      loading = false;
      renderState();
    } catch (error) {
      if (token !== requestId || !isMounted) return;

      loading = false;
      errorMessage = error instanceof Error ? error.message : "Firestore уншилтын алдаа";
      renderState();
    }
  }

  function bindInputs() {
    if (!searchInput || !roleSelect || !retryButton) return;

    const onSearch = event => {
      searchQuery = event.target.value || "";
      renderState();
    };
    searchInput.addEventListener("input", onSearch, { passive: true });
    dispose.push(() => searchInput.removeEventListener("input", onSearch));

    const onRole = event => {
      roleFilter = event.target.value || "all";
      renderState();
    };
    roleSelect.addEventListener("change", onRole, { passive: true });
    dispose.push(() => roleSelect.removeEventListener("change", onRole));

    retryButton.addEventListener("click", loadMembers, { passive: true });
    dispose.push(() => retryButton.removeEventListener("click", loadMembers));

    const onClick = event => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      const inlineRetry = target.closest("[data-members-inline-retry]");
      if (inlineRetry) {
        loadMembers();
        return;
      }

      const card = target.closest("[data-member-open]");
      if (card && card.dataset) {
        openProfile(card.dataset.memberOpen || "");
      }
    };
    if (hasListenerApi(host)) {
      host.addEventListener("click", onClick);
      dispose.push(() => host?.removeEventListener?.("click", onClick));
    }

    const onProfileClose = event => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (!target.closest("[data-member-profile-close]")) return;
      closeProfile();
    };
    if (hasListenerApi(profileEl)) {
      profileEl.addEventListener("click", onProfileClose);
      dispose.push(() => profileEl?.removeEventListener?.("click", onProfileClose));
    }
  }

  return {
    key: "members",
    title: "ONI CREW",
    description: "ONI CREW маршрут нь Firestore members roster-ийг роль hierarchy болон profile панельтэй харуулна.",
    status: "live",

    mount(root) {
      if (!root || typeof root.querySelector !== "function") return;
      if (isMounted && host === root) return;

      this.unmount();

      host = root;
      isMounted = true;
      requestId += 1;
      records = [];
      garageRecords = [];
      garageLoaded = false;
      searchQuery = "";
      roleFilter = "all";
      loading = false;
      errorMessage = "";
      selectedMemberId = "";

      host.innerHTML = membersRouteMarkup();
      searchInput = host.querySelector("[data-members-search]");
      roleSelect = host.querySelector("[data-members-role]");
      retryButton = host.querySelector("[data-members-retry]");
      stateEl = host.querySelector("[data-members-state]");
      gridEl = host.querySelector("[data-members-grid]");
      profileEl = host.querySelector("[data-member-profile]");
      profileBody = host.querySelector("[data-member-profile-body]");

      bindInputs();
      loadMembers();
    },

    unmount() {
      isMounted = false;
      requestId += 1;
      closeProfile();
      removeListeners();
      host = null;
      searchInput = null;
      roleSelect = null;
      retryButton = null;
      stateEl = null;
      gridEl = null;
      profileEl = null;
      profileBody = null;
    }
  };
}
