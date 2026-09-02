import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";
const HTMLElementRef = globalThis.HTMLElement || class {};
const HTMLButtonElementRef = globalThis.HTMLButtonElement || class {};
const HTMLSelectElementRef = globalThis.HTMLSelectElement || class {};
const HTMLInputElementRef = globalThis.HTMLInputElement || class {};
const HTMLImageElementRef = globalThis.HTMLImageElement || class {};
const ElementRef = globalThis.Element || class {};


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

  const collections = [raw.images, raw.gallery, raw.photos, raw.media];
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

function hasListenerApi(node) {
  return !!node && typeof node.addEventListener === "function" && typeof node.removeEventListener === "function";
}

function badge(label, value) {
  const text = asText(value);
  if (!text) return "";
  return `<span class="oni-garage-badge"><small>${escapeHtml(label)}</small>${escapeHtml(text)}</span>`;
}

function toSearchBlob(record) {
  return [
    record.buildName,
    record.brand,
    record.model,
    record.owner,
    record.type,
    record.category,
    record.status,
    record.animeTheme,
    record.cpmId,
    record.layer
  ].join(" ").toLowerCase();
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
  const owner = pickFirstText(raw.owner, raw.nick, raw.nickname, raw.cpmNick, raw.driver, raw.memberNick);
  const type = pickFirstText(raw.type, raw.buildType, raw.style);
  const category = pickFirstText(raw.category, raw.segment);
  const status = pickFirstText(raw.status, raw.saleStatus, raw.state);
  const animeTheme = pickFirstText(raw.anime, raw.theme, raw.series, raw.franchise, raw.animeTheme);
  const cpmId = pickFirstText(raw.cpmid, raw.cpmId, raw.cpm, raw.playerId);
  const layer = pickFirstText(raw.layer, raw.buildLayer, raw.stage, raw.tier);
  const images = uniqImageList(raw);
  const createdAtMs = toMillis(raw.updatedAt) || toMillis(raw.createdAt);

  const record = {
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
    animeTheme,
    cpmId,
    layer,
    images,
    image: images[0] || "",
    createdAtMs
  };

  return {
    ...record,
    searchBlob: toSearchBlob(record)
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

function buildCardMarkup(record, index = 0, showcase = false) {
  const brandModel = [record.brand, record.model].filter(Boolean).join(" ");
  const chips = [
    badge("Төрөл", record.type),
    badge("Ангилал", record.category),
    badge("Сэдэв", record.animeTheme)
  ].filter(Boolean).join("");

  return `
    <button type="button" class="oni-garage-build${showcase ? " is-showcase" : ""}" data-garage-open="${escapeHtml(record.id)}" style="--oni-stagger:${Math.min(index, 10)};">
      <div class="oni-garage-build-media${record.image ? "" : " is-fallback"}">
        ${record.image ? `<img src="${escapeHtml(record.image)}" alt="${escapeHtml(record.buildName)} зураг" loading="lazy" decoding="async" data-garage-image>` : ""}
        <span class="oni-garage-build-fallback" aria-hidden="true">${escapeHtml(initials(record.buildName))}</span>
      </div>
      <div class="oni-garage-build-overlay">
        <h3>${escapeHtml(record.buildName)}</h3>
        ${brandModel ? `<p class="oni-garage-build-sub">${escapeHtml(brandModel)}</p>` : ""}
        ${record.owner ? `<p class="oni-garage-build-owner">Эзэн · ${escapeHtml(record.owner)}</p>` : ""}
        ${chips ? `<div class="oni-garage-build-badges">${chips}</div>` : ""}
      </div>
    </button>
  `;
}

function skeletonMarkup() {
  return Array.from({ length: 5 }, () => `
    <article class="oni-garage-build oni-garage-build-skeleton" aria-hidden="true">
      <div class="oni-garage-build-media"></div>
      <div class="oni-garage-build-overlay">
        <p class="oni-garage-line"></p>
        <p class="oni-garage-line short"></p>
      </div>
    </article>
  `).join("");
}

export function renderGarageCards(records) {
  return records.map((record, index) => buildCardMarkup(record, index, false)).join("");
}

function selectMarkup(type, label, options) {
  const nodes = options.map(
    option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
  ).join("");

  return `
    <label class="oni-garage-filter-field">
      <span>${escapeHtml(label)}</span>
      <select class="oni-garage-select" data-garage-filter="${escapeHtml(type)}" aria-label="${escapeHtml(label)} шүүх">
        <option value="all">Бүгд</option>
        ${nodes}
      </select>
    </label>
  `;
}

function detailMeta(label, value) {
  const text = asText(value);
  if (!text) return "";
  return `<li><small>${escapeHtml(label)}</small><b>${escapeHtml(text)}</b></li>`;
}

export function garageRouteMarkup() {
  return `
    <section class="oni-garage-view" data-garage-view>
      <header class="oni-garage-head oni-panel-reveal">
        <div>
          <p class="oni-garage-kicker">ONI GARAGE</p>
          <h1>ONI GARAGE</h1>
          <p class="oni-garage-sub">JDM × Anime build цуглуулга</p>
        </div>
        <p class="oni-garage-state" data-garage-state role="status" aria-live="polite"></p>
      </header>

      <section class="oni-garage-top-controls oni-panel-reveal" aria-label="ONI GARAGE хайлт">
        <label class="oni-garage-search-wrap">
          <span class="oni-sr-only">Build хайх</span>
          <input
            type="search"
            class="oni-garage-search"
            data-garage-search
            autocomplete="off"
            spellcheck="false"
            placeholder="Build, эзэмшигч, загвар, сэдвээр хайх"
            aria-label="ONI GARAGE хайх"
          >
        </label>
        <div class="oni-garage-top-actions">
          <button type="button" class="oni-btn oni-btn-ghost" data-garage-filter-toggle aria-expanded="false">ШҮҮЛТ</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-garage-retry>ДАХИН</button>
        </div>
      </section>

      <section class="oni-garage-filter-panel" data-garage-filter-panel hidden>
        <div class="oni-garage-filter-grid" data-garage-filter-grid></div>
      </section>

      <section class="oni-garage-showcase-wrap oni-panel-reveal" data-garage-showcase-wrap>
        <div class="oni-section-header">
          <h2>ОНЦЛОХ BUILD</h2>
        </div>
        <div class="oni-garage-showcase" data-garage-showcase></div>
      </section>

      <section class="oni-garage-grid" data-garage-grid aria-live="polite"></section>

      <section class="oni-garage-detail" data-garage-detail hidden>
        <div class="oni-garage-detail-backdrop" data-garage-detail-close></div>
        <article class="oni-garage-detail-card" role="dialog" aria-modal="true" aria-label="Build дэлгэрэнгүй">
          <button type="button" class="oni-btn oni-btn-ghost oni-garage-detail-close" data-garage-detail-close>БУЦАХ</button>
          <div class="oni-garage-detail-body" data-garage-detail-body></div>
        </article>
      </section>
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
  let selectedId = "";
  let filtersOpen = false;
  const dispose = [];

  let searchInput;
  let filterGrid;
  let filterPanel;
  let filterToggle;
  let retryButton;
  let stateEl;
  let showcaseWrap;
  let showcaseEl;
  let gridEl;
  let detailEl;
  let detailBody;
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

  function toggleFilters(force) {
    filtersOpen = typeof force === "boolean" ? force : !filtersOpen;
    if (filterPanel) filterPanel.hidden = !filtersOpen;
    if (filterToggle && typeof filterToggle.setAttribute === "function") {
      filterToggle.setAttribute("aria-expanded", filtersOpen ? "true" : "false");
    }
  }

  function revealCards(container, selector = ".oni-garage-build") {
    if (!container || typeof container.querySelectorAll !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...container.querySelectorAll(selector)];
    requestAnimationFrame(() => {
      items.forEach(item => item.classList.add("is-ready"));
    });
  }

  function updateSelect(name, options, currentValue) {
    let select;
    if (name === "type") select = typeSelect;
    if (name === "category") select = categorySelect;
    if (name === "status") select = statusSelect;
    if (!select || typeof select !== "object" || !("value" in select) || typeof select.innerHTML !== "string") return "all";

    const allowed = new Set(options.map(option => option.value));
    const selected = allowed.has(currentValue) ? currentValue : "all";

    const body = options.map(
      option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    ).join("");
    select.innerHTML = `<option value="all">Бүгд</option>${body}`;
    select.value = selected;
    return selected;
  }

  function renderFilterOptions() {
    if (!filterGrid) return;

    const typeOptions = collectFacetOptions(records, "type", "typeKey");
    const categoryOptions = collectFacetOptions(records, "category", "categoryKey");
    const statusOptions = collectFacetOptions(records, "status", "statusKey");

    filterGrid.innerHTML = [
      selectMarkup("type", "Төрөл", typeOptions),
      selectMarkup("category", "Ангилал", categoryOptions),
      selectMarkup("status", "Төлөв", statusOptions)
    ].join("");

    typeSelect = filterGrid.querySelector('[data-garage-filter="type"]');
    categorySelect = filterGrid.querySelector('[data-garage-filter="category"]');
    statusSelect = filterGrid.querySelector('[data-garage-filter="status"]');
    typeFilter = updateSelect("type", typeOptions, typeFilter);
    categoryFilter = updateSelect("category", categoryOptions, categoryFilter);
    statusFilter = updateSelect("status", statusOptions, statusFilter);
  }

  function currentVisibleRecords() {
    return filterGarageRecords(records, searchQuery, {
      type: typeFilter,
      category: categoryFilter,
      status: statusFilter
    });
  }

  function detailMarkup(record) {
    const gallery = record.images.length
      ? `
        <div class="oni-garage-detail-gallery" data-garage-gallery>
          ${record.images.map(image => `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(record.buildName)} зураг" loading="lazy" decoding="async"></figure>`).join("")}
        </div>
      `
      : `<div class="oni-garage-detail-empty-media">${escapeHtml(initials(record.buildName))}</div>`;

    const brandModel = [record.brand, record.model].filter(Boolean).join(" ");
    const meta = [
      detailMeta("Эзэн", record.owner),
      detailMeta("Төрөл", record.type),
      detailMeta("Ангилал", record.category),
      detailMeta("Сэдэв", record.animeTheme),
      detailMeta("CPM ID", record.cpmId),
      detailMeta("Давхарга", record.layer),
      detailMeta("Төлөв", record.status)
    ].filter(Boolean).join("");

    return `
      ${gallery}
      <div class="oni-garage-detail-copy">
        <h3>${escapeHtml(record.buildName)}</h3>
        ${brandModel ? `<p>${escapeHtml(brandModel)}</p>` : ""}
        ${meta ? `<ul>${meta}</ul>` : ""}
      </div>
    `;
  }

  function openDetail(recordId) {
    selectedId = asText(recordId);
    const target = records.find(item => item.id === selectedId);
    if (!target || !detailEl || !detailBody) {
      closeDetail();
      return;
    }

    detailBody.innerHTML = detailMarkup(target);
    detailEl.hidden = false;
    if (typeof document !== "undefined") {
      document.body.classList.add("oni-modal-open");
    }
  }

  function closeDetail() {
    selectedId = "";
    if (detailEl) detailEl.hidden = true;
    if (typeof document !== "undefined") {
      document.body.classList.remove("oni-modal-open");
    }
  }

  function renderState() {
    if (!stateEl || !gridEl) return;

    if (loading) {
      stateEl.textContent = "ONI GARAGE ачаалж байна…";
      if (showcaseWrap) showcaseWrap.hidden = false;
      if (showcaseEl) showcaseEl.innerHTML = skeletonMarkup();
      gridEl.innerHTML = skeletonMarkup();
      return;
    }

    if (errorMessage) {
      stateEl.textContent = "ONI GARAGE ачаалж чадсангүй.";
      if (showcaseWrap) showcaseWrap.hidden = true;
      gridEl.innerHTML = `
        <article class="oni-card oni-garage-empty" role="alert">
          <h2>GARAGE одоогоор боломжгүй</h2>
          <p>${escapeHtml(errorMessage)}</p>
          <button type="button" class="oni-btn oni-btn-primary" data-garage-inline-retry>ДАХИН ОРОЛДОХ</button>
        </article>
      `;
      return;
    }

    const visible = currentVisibleRecords();

    if (!visible.length) {
      stateEl.textContent = records.length
        ? "Таны шүүлтүүрт тохирох build олдсонгүй."
        : "ONI GARAGE-д хараахан build алга.";
      if (showcaseWrap) showcaseWrap.hidden = true;
      gridEl.innerHTML = `
        <article class="oni-card oni-garage-empty">
          <h2>${records.length ? "Build олдсонгүй" : "GARAGE хоосон байна"}</h2>
          <p>${records.length ? "Өөр түлхүүр үг эсвэл шүүлтүүр сонгоно уу." : "Firestore холбоо хэвийн боловч одоогоор мэдээлэл алга."}</p>
        </article>
      `;
      return;
    }

    stateEl.textContent = `${visible.length} / ${records.length} BUILD`;

    const showcase = visible.slice(0, 6);
    if (showcaseWrap) showcaseWrap.hidden = false;
    if (showcaseEl) showcaseEl.innerHTML = showcase.map((record, index) => buildCardMarkup(record, index, true)).join("");

    gridEl.innerHTML = renderGarageCards(visible);
    revealCards(showcaseEl);
    revealCards(gridEl);

    if (selectedId && !visible.some(item => item.id === selectedId)) {
      closeDetail();
    }
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
        .map(docSnap => normalizeGarageRecord(docSnap.data(), docSnap.id))
        .sort((a, b) => (b.createdAtMs - a.createdAtMs) || a.buildName.localeCompare(b.buildName));

      loading = false;
      renderFilterOptions();
      renderState();
    } catch (error) {
      if (!isMounted || token !== requestId) return;
      loading = false;
      errorMessage = error instanceof Error ? error.message : "Firestore уншилтын алдаа";
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
      if (!target || typeof target !== "object" || !("value" in target) || !target.dataset) return;
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

    const onToggle = () => toggleFilters();
    if (typeof filterToggle?.addEventListener === "function") {
      filterToggle.addEventListener("click", onToggle, { passive: true });
      dispose.push(() => filterToggle?.removeEventListener?.("click", onToggle));
    }

    const onGridClick = event => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      const inlineRetry = target.closest("[data-garage-inline-retry]");
      if (inlineRetry) {
        loadGarage();
        return;
      }

      const openButton = target.closest("[data-garage-open]");
      if (openButton && openButton.dataset) {
        openDetail(openButton.dataset.garageOpen || "");
      }
    };
    if (hasListenerApi(gridEl)) {
      gridEl.addEventListener("click", onGridClick);
      dispose.push(() => gridEl?.removeEventListener?.("click", onGridClick));
    }

    const onShowcaseClick = event => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      const openButton = target.closest("[data-garage-open]");
      if (openButton && openButton.dataset) {
        openDetail(openButton.dataset.garageOpen || "");
      }
    };
    if (hasListenerApi(showcaseEl)) {
      showcaseEl.addEventListener("click", onShowcaseClick);
      dispose.push(() => showcaseEl?.removeEventListener?.("click", onShowcaseClick));
    }

    const onCloseDetail = event => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (!target.closest("[data-garage-detail-close]")) return;
      closeDetail();
    };
    if (typeof detailEl?.addEventListener === "function") {
      detailEl.addEventListener("click", onCloseDetail);
      dispose.push(() => detailEl?.removeEventListener?.("click", onCloseDetail));
    }

    const onImageError = event => {
      const target = event.target;
      if (!target || typeof target.matches !== "function") return;
      if (!target.matches("[data-garage-image]")) return;
      target.closest(".oni-garage-build-media")?.classList.add("is-fallback");
      target.remove?.();
    };
    if (typeof host?.addEventListener === "function") {
      host.addEventListener("error", onImageError, true);
      dispose.push(() => host?.removeEventListener?.("error", onImageError, true));
    }
  }

  return {
    key: "garage",
    title: "ONI GARAGE",
    description: "Cinematic гараж маршрут нь Firestore garage цуглуулгын real build өгөгдлийг зураг төвтэй харуулна.",
    status: "live",

    mount(root) {
      if (!root || typeof root.querySelector !== "function") return;
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
      selectedId = "";
      filtersOpen = false;

      host.innerHTML = garageRouteMarkup();
      searchInput = host.querySelector("[data-garage-search]");
      filterGrid = host.querySelector("[data-garage-filter-grid]");
      filterPanel = host.querySelector("[data-garage-filter-panel]");
      filterToggle = host.querySelector("[data-garage-filter-toggle]");
      retryButton = host.querySelector("[data-garage-retry]");
      stateEl = host.querySelector("[data-garage-state]");
      showcaseWrap = host.querySelector("[data-garage-showcase-wrap]");
      showcaseEl = host.querySelector("[data-garage-showcase]");
      gridEl = host.querySelector("[data-garage-grid]");
      detailEl = host.querySelector("[data-garage-detail]");
      detailBody = host.querySelector("[data-garage-detail-body]");

      toggleFilters(false);
      renderFilterOptions();
      bindListeners();
      loadGarage();
    },

    unmount() {
      isMounted = false;
      requestId += 1;
      closeDetail();
      removeListeners();
      host = null;
      searchInput = null;
      filterGrid = null;
      filterPanel = null;
      filterToggle = null;
      retryButton = null;
      stateEl = null;
      showcaseWrap = null;
      showcaseEl = null;
      gridEl = null;
      detailEl = null;
      detailBody = null;
      typeSelect = null;
      categorySelect = null;
      statusSelect = null;
    }
  };
}
