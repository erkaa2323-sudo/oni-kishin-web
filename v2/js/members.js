import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";

const ROLE_LABELS = {
  leader: "CLAN LEADER",
  "co-leader": "CO-LEADER",
  special: "SPECIAL MEMBER",
  member: "MEMBER"
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
    avatarUrl,
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

function initials(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map(word => word.charAt(0)).join("").toUpperCase() || "ON";
}

function cardMarkup(member) {
  const roleClass = member.role === "member" ? "" : ` oni-role-${member.role}`;
  const metaParts = [member.title, member.direction].filter(Boolean);
  const meta = metaParts.length ? escapeHtml(metaParts.join(" • ")) : "ONI &amp; KISHIN MEMBER";

  const avatar = member.avatarUrl
    ? `<img class="oni-member-avatar-image" src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(member.nickname)} avatar" loading="lazy" decoding="async">`
    : `<span class="oni-member-avatar-fallback" aria-hidden="true">${escapeHtml(initials(member.nickname))}</span>`;

  return `
    <article class="oni-member-card${roleClass}">
      <div class="oni-member-avatar">${avatar}</div>
      <div class="oni-member-copy">
        <h3>${escapeHtml(member.nickname)}</h3>
        <p class="oni-member-id">${escapeHtml(member.cpmId)}</p>
        <p class="oni-member-meta">${meta}</p>
      </div>
      <span class="oni-member-role">${escapeHtml(member.roleLabel)}</span>
    </article>
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
  return records.map(cardMarkup).join("");
}

export function membersRouteMarkup() {
  return `
    <section class="oni-members-view" data-members-view>
      <header class="oni-section-head">
        <h1>Members</h1>
        <p>Live ONI &amp; KISHIN roster sourced from the existing Firestore <code>members</code> collection.</p>
      </header>

      <section class="oni-card oni-members-controls" aria-label="Members search and filters">
        <label class="oni-members-field">
          <span>Search</span>
          <input
            type="search"
            class="oni-members-search"
            data-members-search
            autocomplete="off"
            spellcheck="false"
            placeholder="Search by nick, CPM ID, role, title, direction"
            aria-label="Search members"
          >
        </label>
        <label class="oni-members-field oni-members-select-wrap">
          <span>Role filter</span>
          <select class="oni-members-select" data-members-role aria-label="Filter members by role">
            <option value="all">All roles</option>
            <option value="leader">Leader</option>
            <option value="co-leader">Co-Leader</option>
            <option value="special">Special</option>
            <option value="member">Member</option>
          </select>
        </label>
        <button type="button" class="oni-btn oni-btn-ghost" data-members-retry>Retry</button>
      </section>

      <p class="oni-members-state" data-members-state role="status" aria-live="polite"></p>
      <section class="oni-members-grid" data-members-grid aria-live="polite"></section>
    </section>
  `;
}

export function createMembersModule() {
  let host = null;
  let isMounted = false;
  let requestId = 0;
  let records = [];
  let searchQuery = "";
  let roleFilter = "all";
  let loading = false;
  let errorMessage = "";
  const dispose = [];

  let searchInput;
  let roleSelect;
  let retryButton;
  let stateEl;
  let gridEl;

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

  function renderState() {
    if (!stateEl || !gridEl) return;

    if (loading) {
      stateEl.textContent = "Loading members…";
      gridEl.innerHTML = skeletonMarkup();
      return;
    }

    if (errorMessage) {
      stateEl.textContent = "Unable to load members.";
      gridEl.innerHTML = `
        <article class="oni-card oni-members-empty" role="alert">
          <h2>Members unavailable</h2>
          <p>${escapeHtml(errorMessage)}</p>
          <button type="button" class="oni-btn oni-btn-primary" data-members-inline-retry>Retry</button>
        </article>
      `;

      const inlineRetry = gridEl.querySelector("[data-members-inline-retry]");
      inlineRetry?.addEventListener("click", loadMembers, { passive: true });
      return;
    }

    const visible = filterMembers(records, searchQuery, roleFilter);
    if (!visible.length) {
      stateEl.textContent = records.length
        ? "No members matched the current filters."
        : "No members are currently available.";
      gridEl.innerHTML = `
        <article class="oni-card oni-members-empty">
          <h2>${records.length ? "No matches" : "No roster data"}</h2>
          <p>${records.length ? "Try a different keyword or role filter." : "Members collection is reachable but currently empty."}</p>
        </article>
      `;
      return;
    }

    stateEl.textContent = `${visible.length} / ${records.length} members`;
    gridEl.innerHTML = renderMembersCards(visible);
  }

  async function loadMembers() {
    if (!host || !isMounted) return;

    const token = ++requestId;
    loading = true;
    errorMessage = "";
    renderState();

    try {
      const db = getFirestoreDb();
      const snapshot = await getDocs(collection(db, "members"));

      if (token !== requestId || !isMounted) return;

      records = snapshot.docs
        .map(doc => normalizeMemberRecord(doc.data(), doc.id))
        .sort((a, b) => (a.createdAtMs - b.createdAtMs) || a.nickname.localeCompare(b.nickname));
      loading = false;
      renderState();
    } catch (error) {
      if (token !== requestId || !isMounted) return;

      loading = false;
      errorMessage = error instanceof Error ? error.message : "Unknown Firestore read error";
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
  }

  return {
    key: "members",
    title: "Members",
    description: "Members route reads the existing Firestore roster with defensive legacy compatibility.",
    status: "live",

    mount(root) {
      if (!(root instanceof HTMLElement)) return;
      if (isMounted && host === root) return;

      this.unmount();

      host = root;
      isMounted = true;
      requestId += 1;
      records = [];
      searchQuery = "";
      roleFilter = "all";
      loading = false;
      errorMessage = "";

      host.innerHTML = membersRouteMarkup();
      searchInput = host.querySelector("[data-members-search]");
      roleSelect = host.querySelector("[data-members-role]");
      retryButton = host.querySelector("[data-members-retry]");
      stateEl = host.querySelector("[data-members-state]");
      gridEl = host.querySelector("[data-members-grid]");

      bindInputs();
      loadMembers();
    },

    unmount() {
      isMounted = false;
      requestId += 1;
      removeListeners();
      host = null;
      searchInput = null;
      roleSelect = null;
      retryButton = null;
      stateEl = null;
      gridEl = null;
    }
  };
}
