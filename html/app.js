const trigger = document.getElementById("country-trigger");
const triggerFlag = document.getElementById("trigger-flag");
const triggerName = document.getElementById("trigger-name");
const triggerChevron = document.getElementById("trigger-chevron");
const pickerStatus = document.getElementById("picker-status");
const overlay = document.getElementById("modal-overlay");
const dialog = document.getElementById("country-dialog");
const closeButton = document.getElementById("modal-close");
const searchInput = document.getElementById("modal-search");
const modalBody = document.getElementById("modal-body");

let countries = [];
let selectedCountry = null;
let loadError = null;
let lastFocusedElement = null;

const languageFallbackMap = {
  ar: "SA",
  de: "DE",
  en: "US",
  es: "ES",
  fr: "FR",
  hi: "IN",
  it: "IT",
  ja: "JP",
  ko: "KR",
  nl: "NL",
  pl: "PL",
  pt: "BR",
  sv: "SE",
  tr: "TR",
  uk: "UA",
  vi: "VN",
  zh: "CN",
};

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function findCountryByIso2(iso2) {
  return countries.find((country) => country.iso2 === iso2) || null;
}

function guessCountry() {
  const locales = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ""];

  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      if (region) {
        const regionMatch = findCountryByIso2(region.toUpperCase());
        if (regionMatch) return regionMatch;
      }
    } catch {
      // Ignore invalid locale strings and fall back to language matching.
    }

    const language = locale.split("-")[0].toLowerCase();
    const fallbackIso2 = languageFallbackMap[language];
    if (fallbackIso2) {
      const fallbackCountry = findCountryByIso2(fallbackIso2);
      if (fallbackCountry) return fallbackCountry;
    }
  }

  return null;
}

function computeCardMinWidth(items) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 180;

  context.font = "600 13px sans-serif";
  let maxWidth = 0;

  items.forEach((country) => {
    const label = country.full || country.common;
    const width = context.measureText(label).width;
    if (width > maxWidth) maxWidth = width;
  });

  return Math.min(260, Math.max(140, Math.ceil(maxWidth) + 56));
}

function setStatus(message, tone = "muted") {
  pickerStatus.textContent = message;
  pickerStatus.classList.toggle("is-error", tone === "error");
}

function setLoadingState() {
  trigger.disabled = true;
  trigger.setAttribute("aria-expanded", "false");
  triggerFlag.textContent = "🌍";
  triggerName.textContent = "Loading countries...";
  triggerChevron.textContent = "▾";
  trigger.classList.remove("is-ready");
  setStatus("Loading the full country and region list...");
}

function setReadyState() {
  trigger.disabled = false;
  triggerChevron.textContent = selectedCountry ? "✓" : "▾";
  trigger.classList.toggle("is-ready", Boolean(selectedCountry));
  if (!selectedCountry) {
    triggerFlag.textContent = "🌍";
    triggerName.textContent = "Select country...";
    setStatus("Search the full list or use the locale-based suggestion.");
    return;
  }

  triggerFlag.textContent = selectedCountry.flag;
  triggerName.textContent = selectedCountry.common;
  setStatus(`Selected ${selectedCountry.common}.`);
}

function setErrorState(message) {
  loadError = message;
  trigger.disabled = true;
  trigger.setAttribute("aria-expanded", "false");
  triggerFlag.textContent = "⚠️";
  triggerName.textContent = "Country list unavailable";
  triggerChevron.textContent = "!";
  trigger.classList.remove("is-ready");
  setStatus(message, "error");
}

function clearModalBody() {
  modalBody.replaceChildren();
}

function createEmptyState(message) {
  const empty = document.createElement("p");
  empty.className = "no-results";
  empty.setAttribute("role", "status");
  empty.textContent = message;
  return empty;
}

function buildCountryButton(country, suggestedIso2) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "country-btn";
  button.setAttribute("aria-label", `${country.common} (${country.iso2})`);

  if (selectedCountry && selectedCountry.iso2 === country.iso2) {
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
  }

  if (suggestedIso2 && country.iso2 === suggestedIso2) {
    button.classList.add("is-suggested");
  }

  const flag = document.createElement("span");
  flag.className = "country-flag";
  flag.setAttribute("aria-hidden", "true");
  flag.textContent = country.flag;

  const label = document.createElement("span");
  label.className = "country-label";

  const common = document.createElement("span");
  common.className = "country-common";
  common.textContent = country.common;

  label.append(common);

  if (country.full && country.full !== country.common) {
    const full = document.createElement("span");
    full.className = "country-full";
    full.textContent = country.full;
    label.append(full);
  }

  button.append(flag, label);
  button.addEventListener("click", () => {
    selectedCountry = country;
    setReadyState();
    closeModal();
  });

  return button;
}

function renderGrid(items, title, suggestedIso2) {
  const section = document.createElement("section");

  const label = document.createElement("h4");
  label.className = "section-label";
  label.textContent = title;
  section.append(label);

  const grid = document.createElement("div");
  grid.className = "country-grid";
  grid.setAttribute("role", "list");

  items.forEach((country) => {
    const item = document.createElement("div");
    item.setAttribute("role", "listitem");
    item.append(buildCountryButton(country, suggestedIso2));
    grid.append(item);
  });

  section.append(grid);
  return section;
}

function matchesQuery(country, normalizedQuery) {
  if (!normalizedQuery) return true;

  const haystacks = [
    country.common,
    country.full,
    country.iso2,
    ...(country.aliases || []),
  ].filter(Boolean);

  return haystacks.some((value) => {
    const normalizedValue = normalizeText(value);
    return normalizedValue.includes(normalizedQuery) || normalizedValue === normalizedQuery;
  });
}

function renderModal(query = "") {
  clearModalBody();

  if (loadError) {
    modalBody.append(createEmptyState(loadError));
    return;
  }

  const normalizedQuery = normalizeText(query.trim());

  if (normalizedQuery) {
    const results = countries.filter((country) => matchesQuery(country, normalizedQuery));

    if (!results.length) {
      modalBody.append(
        createEmptyState(`No countries or regions match "${query}".`)
      );
      return;
    }

    modalBody.append(renderGrid(results, "Results"));
    return;
  }

  const guessedCountry = guessCountry();
  if (guessedCountry) {
    modalBody.append(renderGrid([guessedCountry], "Suggested for you", guessedCountry.iso2));
  }

  const remainingCountries = countries.filter((country) => country.iso2 !== guessedCountry?.iso2);
  modalBody.append(renderGrid(remainingCountries, "All countries and regions"));
}

function getFocusableElements() {
  return Array.from(
    dialog.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  );
}

function openModal() {
  if (trigger.disabled || loadError) return;

  lastFocusedElement = document.activeElement;
  overlay.classList.add("is-active");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  trigger.setAttribute("aria-expanded", "true");
  searchInput.value = "";
  renderModal("");
  requestAnimationFrame(() => searchInput.focus());
}

function closeModal() {
  if (!overlay.classList.contains("is-active")) return;

  overlay.classList.remove("is-active");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  trigger.setAttribute("aria-expanded", "false");

  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  } else {
    trigger.focus();
  }
}

async function loadCountries() {
  setLoadingState();

  const response = await fetch("./countries.json");
  if (!response.ok) {
    throw new Error(`Failed to load countries.json: ${response.status}`);
  }

  const data = await response.json();
  countries = data
    .slice()
    .sort((a, b) => (b.pop || 0) - (a.pop || 0) || a.common.localeCompare(b.common));

  document.documentElement.style.setProperty(
    "--card-min-width",
    `${computeCardMinWidth(countries)}px`
  );

  setReadyState();
}

trigger.addEventListener("click", openModal);
closeButton.addEventListener("click", closeModal);
searchInput.addEventListener("input", () => renderModal(searchInput.value));
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (!overlay.classList.contains("is-active")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key !== "Tab") return;

  const focusableElements = getFocusableElements();
  if (!focusableElements.length) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
});

loadCountries().catch((error) => {
  console.error(error);
  clearModalBody();
  setErrorState(error.message);
});
