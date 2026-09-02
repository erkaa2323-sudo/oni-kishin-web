import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";

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

function slug(value) {
  return asText(value).toLowerCase();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(String(value));
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

function uniqImageList(raw = {}) {
  const list = [];
  const push = value => {
    const text = asText(value);
    if (!text || !isSafeImageUrl(text) || list.includes(text)) return;
    list.push(text);
  };

  const collections = [raw.images, raw.gallery, raw.photos];
  for (const values of collections) {
    if (!Array.isArray(values)) continue;
    for (const value of values) push(value);
  }

  push(raw.image);
  push(raw.imageUrl);
  push(raw.photo);
  push(raw.cover);
  push(raw.thumbnail);
  return list;
}

function initials(text) {
  const words = asText(text).split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map(word => word.charAt(0)).join("").toUpperCase() || "ON";
}

function chip(label, value) {
  const text = asText(value);
  if (!text) return "";
  return `<span class="oni-garage-chip"><small>${escapeHtml(label)}</small>${escapeHtml(text)}</span>`;
}

export function normalizeGarageRecord(raw = {}, docId = "") {
  const buildName = pickFirstText(
    raw.name,
    raw.title,
    raw.build,
    raw.vehicle,
    raw.car,
    raw.model,
    raw.brand,
    "ONI BUILD"
  );
  const brand = pickFirstText(raw.brand, raw.make, raw.manufacturer);
  const model = pickFirstText(raw.model, raw.car, raw.vehicleModel, raw.variant);
  const owner = pickFirstText(raw.owner, raw.nick, raw.nickname, raw.cpmNick, raw.driver);
  const type = pickFirstText(raw.type, raw.buildType, raw.style);
  const category = pickFirstText(raw.category, raw.segment);
  const status = pickFirstText(raw.status, raw.saleStatus, raw.state);
  const images = uniqImageList(raw);
  const createdAtMs = toMillis(raw.updatedAt) || toMillis(raw.createdAt);

  const searchBlob = [buildName, brand, model, owner, type, category, status]
    .join(" ")
    .toLowerCase();

  return {
    id: asText(docId) || `garage-${Math.random().toString(36).slice(2, 10)}`,
    buildName,
    brand,
    model,
    owner,
    type,
    typeKey: slug(type),
    category,
    categoryKey: slug(category),
    status,
    statusKey: slug(status),
    images,
    image: images[0] || "",
    createdAtMs,
    searchBlob
  };
}

function collectFacetOptions(records, key, keyName) {
  const values = new Map();
  for (const record of records) {
    const itemKey = record[keyName];
    const label = asText(record[key]);
    if (!itemKey || !label || values.has(itemKey)) continue;
    values.set(itemKey, label);
  }
  return [...values.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterGarageRecords(records, searchQuery, filters = {}) {
  const query = asText(searchQuery).toLowerCase();
  const type = slug(filters.type);
  const category = slug(filters.category);
  const status = slug(filters.status);

  return records.filter(record => {
    if (type && type !== "all" && record.typeKey !== type) return false;
    if (category && category !== "all" && record.categoryKey !== category) return false;
    if (status && status !== "all" && record.statusKey !== status) return false;
    if (!query) return true;
    return record.searchBlob.includes(query);
  });
}

function cardMarkup(record) {
  const brandModel = [record.brand, record.model].filter(Boolean).join(" ");
  const chips = [
    chip("Type", record.type),
    chip("Category", record.category),
    chip("Status", record.status)
  ].filter(Boolean).join("");

  return `
    <article class="oni-garage-card">
      <div class="oni-garage-media${record.image ? "" : " is-fallback"}">
        ${record.image ? `<img src="${escapeHtml(record.image)}" alt="${escapeHtml(record.buildName)} image" loading="lazy" decoding="async" data-garage-image>` : ""}
        <span class="oni-garage-fallback" aria-hidden="true">${escapeHtml(initials(record.buildName))}</span>
      </div>
      <div class="oni-garage-copy">
        <h3>${escapeHtml(record.buildName)}</h3>
        ${brandModel ? `<p class="oni-garage-brand">${escapeHtml(brandModel)}</p>` : ""}
        ${record.owner ? `<p class="oni-garage-owner">${escapeHtml(record.owner)}</p>` : ""}
        ${chips ? `<div class="oni-garage-chips">${chips}</div>` : ""}
      </div>
    </article>
  `;
}

function skeletonMarkup() {
  return Array.from({ length: 6 }, () => `
    <article class="oni-garage-card oni-garage-card-skeleton" aria-hidden="true">
      <div class="oni-garage-media"></div>
      <div class="oni-garage-copy">
        <p class="oni-garage-line"></p>
        <p class="oni-garage-line short"></p>
        <p class="oni-garage-line"></p>
      </div>
    </article>
  `).join("");
}

export function renderGarageCards(records) {
  return records.map(cardMarkup).join("");
}

function selectMarkup(type, label, options) {
  const nodes = options.map(
    option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
  ).join("");

  return `
    <label class="oni-garage-field oni-garage-select-wrap">
      <span>${escapeHtml(label)}</span>
      <select class="oni-garage-select" data-garage-filter="${escapeHtml(type)}" aria-label="Filter garage by ${escapeHtml(label)}">
        <option value="all">All ${escapeHtml(label.toLowerCase())}</option>
        ${nodes}
      </select>
    </label>
  `;
}

export function garageRouteMarkup() {
  return `
    <section class="oni-garage-view" data-garage-view>
      <header class="oni-section-head">
        <h1>Garage</h1>
        <p>Live ONI &amp; KISHIN builds from the existing Firestore <code>garage</code> collection.</p>
      </header>

      <section class="oni-card oni-garage-controls" aria-label="Garage search and filters">
        <label class="oni-garage-field oni-garage-search-wrap">
          <span>Search</span>
          <input
            type="search"
            class="oni-garage-search"
            data-garage-search
            autocomplete="off"
            spellcheck="false"
            placeholder="Search build, brand, model, owner, type, category, status"
            aria-label="Search garage"
          >
        </label>
        <div class="oni-garage-filter-grid" data-garage-filter-grid></div>
        <button type="button" class="oni-btn oni-btn-ghost" data-garage-retry>Retry</button>
      </section>

      <p class="oni-garage-state" data-garage-state role="status" aria-live="polite"></p>
      <section class="oni-garage-grid" data-garage-grid aria-live="polite"></section>
    </section>
  `;
}

export function createGarageModule() {
  let host = null;
  let isMounted = false;
  let requestId = 0;
  let records = [];
  let loading = false;
  let errorMessage = "";
  let searchQuery = "";
  let typeFilter = "all";
  let categoryFilter = "all";
  let statusFilter = "all";
  const dispose = [];

  let searchInput;
  let filterGrid;
  let retryButton;
  let stateEl;
  let gridEl;
  let typeSelect;
  let categorySelect;
  let statusSelect;

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

  function updateSelect(name, options, currentValue) {
    let select;
    if (name === "type") select = typeSelect;
    if (name === "category") select = categorySelect;
    if (name === "status") select = statusSelect;
    if (!(select instanceof HTMLSelectElement)) return "all";

    const allowed = new Set(options.map(option => option.value));
    const selected = allowed.has(currentValue) ? currentValue : "all";

    const body = options.map(
      option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    ).join("");
    select.innerHTML = `<option value="all">All ${escapeHtml(name)}</option>${body}`;
    select.value = selected;
    return selected;
  }

  function renderFilterOptions() {
    if (!(filterGrid instanceof HTMLElement)) return;

    const typeOptions = collectFacetOptions(records, "type", "typeKey");
    const categoryOptions = collectFacetOptions(records, "category", "categoryKey");
    const statusOptions = collectFacetOptions(records, "status", "statusKey");

    filterGrid.innerHTML = [
      selectMarkup("type", "Type", typeOptions),
      selectMarkup("category", "Category", categoryOptions),
      selectMarkup("status", "Status", statusOptions)
    ].join("");

    typeSelect = filterGrid.querySelector('[data-garage-filter="type"]');
    categorySelect = filterGrid.querySelector('[data-garage-filter="category"]');
    statusSelect = filterGrid.querySelector('[data-garage-filter="status"]');
    typeFilter = updateSelect("type", typeOptions, typeFilter);
    categoryFilter = updateSelect("category", categoryOptions, categoryFilter);
    statusFilter = updateSelect("status", statusOptions, statusFilter);
  }

  function renderState() {
    if (!stateEl || !gridEl) return;

    if (loading) {
      stateEl.textContent = "Loading garage…";
      gridEl.innerHTML = skeletonMarkup();
      return;
    }

    if (errorMessage) {
      stateEl.textContent = "Unable to load garage.";
      gridEl.innerHTML = `
        <article class="oni-card oni-garage-empty" role="alert">
          <h2>Garage unavailable</h2>
          <p>${escapeHtml(errorMessage)}</p>
          <button type="button" class="oni-btn oni-btn-primary" data-garage-inline-retry>Retry</button>
        </article>
      `;
      const inlineRetry = gridEl.querySelector("[data-garage-inline-retry]");
      inlineRetry?.addEventListener("click", loadGarage, { passive: true });
      return;
    }

    const visible = filterGarageRecords(records, searchQuery, {
      type: typeFilter,
      category: categoryFilter,
      status: statusFilter
    });

    if (!visible.length) {
      stateEl.textContent = records.length
        ? "No garage builds matched the current filters."
        : "No garage builds are currently available.";
      gridEl.innerHTML = `
        <article class="oni-card oni-garage-empty">
          <h2>${records.length ? "No matches" : "No garage data"}</h2>
          <p>${records.length ? "Try a different keyword or filter combination." : "Garage collection is reachable but currently empty."}</p>
        </article>
      `;
      return;
    }

    stateEl.textContent = `${visible.length} / ${records.length} builds`;
    gridEl.innerHTML = renderGarageCards(visible);
  }

  async function loadGarage() {
    if (!host || !isMounted) return;

    const token = ++requestId;
    loading = true;
    errorMessage = "";
    renderState();

    try {
      const db = getFirestoreDb();
      const snapshot = await getDocs(collection(db, "garage"));
      if (!isMounted || token !== requestId) return;

      records = snapshot.docs
        .map(doc => normalizeGarageRecord(doc.data(), doc.id))
        .sort((a, b) => (b.createdAtMs - a.createdAtMs) || a.buildName.localeCompare(b.buildName));

      loading = false;
      renderFilterOptions();
      renderState();
    } catch (error) {
      if (!isMounted || token !== requestId) return;
      loading = false;
      errorMessage = error instanceof Error ? error.message : "Unknown Firestore read error";
      renderState();
    }
  }

  function bindListeners() {
    if (!searchInput || !retryButton || !filterGrid || !gridEl) return;

    const onSearch = event => {
      searchQuery = event.target.value || "";
      renderState();
    };
    searchInput.addEventListener("input", onSearch, { passive: true });
    dispose.push(() => searchInput.removeEventListener("input", onSearch));

    const onFilter = event => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const kind = target.dataset.garageFilter || "";
      if (kind === "type") typeFilter = target.value || "all";
      if (kind === "category") categoryFilter = target.value || "all";
      if (kind === "status") statusFilter = target.value || "all";
      renderState();
    };
    filterGrid.addEventListener("change", onFilter);
    dispose.push(() => filterGrid.removeEventListener("change", onFilter));

    retryButton.addEventListener("click", loadGarage, { passive: true });
    dispose.push(() => retryButton.removeEventListener("click", loadGarage));

    const onImageError = event => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.matches("[data-garage-image]")) return;
      target.closest(".oni-garage-media")?.classList.add("is-fallback");
      target.remove();
    };
    gridEl.addEventListener("error", onImageError, true);
    dispose.push(() => gridEl.removeEventListener("error", onImageError, true));
  }

  return {
    key: "garage",
    title: "Garage",
    description: "Garage route reads the existing Firestore garage collection with legacy-safe normalization.",
    status: "live",

    mount(root) {
      if (!(root instanceof HTMLElement)) return;
      if (isMounted && host === root) return;

      this.unmount();

      host = root;
      isMounted = true;
      requestId += 1;
      records = [];
      loading = false;
      errorMessage = "";
      searchQuery = "";
      typeFilter = "all";
      categoryFilter = "all";
      statusFilter = "all";

      host.innerHTML = garageRouteMarkup();
      searchInput = host.querySelector("[data-garage-search]");
      filterGrid = host.querySelector("[data-garage-filter-grid]");
      retryButton = host.querySelector("[data-garage-retry]");
      stateEl = host.querySelector("[data-garage-state]");
      gridEl = host.querySelector("[data-garage-grid]");
      renderFilterOptions();
      bindListeners();
      loadGarage();
    },

    unmount() {
      isMounted = false;
      requestId += 1;
      removeListeners();
      host = null;
      searchInput = null;
      filterGrid = null;
      retryButton = null;
      stateEl = null;
      gridEl = null;
      typeSelect = null;
      categorySelect = null;
      statusSelect = null;
    }
  };
}
