const $ = (id) => document.getElementById(id);
const trigger = $("trigger");
const flag = $("flag");
const nameEl = $("name");
const valueEl = $("country-value");
const form = $("demo-form");
const dialog = $("picker");
const search = $("search");
const results = $("results");

let countries = [];
let selected;
let lastFocus;

const languageFallback = {
  ar: "SA", de: "DE", en: "US", es: "ES", fr: "FR", hi: "IN", it: "IT",
  ja: "JP", ko: "KR", nl: "NL", pl: "PL", pt: "BR", sv: "SE", tr: "TR",
  uk: "UA", vi: "VN", zh: "CN",
};

const norm = (value) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const esc = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const guess = () => {
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language || ""];
  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region;
      const direct = countries.find((country) => country.iso2 === region);
      if (direct) return direct;
    } catch {}
    const fallback = countries.find((country) => country.iso2 === languageFallback[locale.split("-")[0].toLowerCase()]);
    if (fallback) return fallback;
  }
};

const setTrigger = (country) => {
  selected = country;
  flag.textContent = country?.flag || "🌍";
  nameEl.textContent = country?.common || "Select country...";
  valueEl.value = country?.iso2 || "";
};

const card = (country, suggested) => {
  const full = country.full && country.full !== country.common ? `<small>${esc(country.full)}</small>` : "";
  const state = [
    "country",
    selected?.iso2 === country.iso2 ? "selected" : "",
    suggested === country.iso2 ? "suggested" : "",
  ].filter(Boolean).join(" ");
  return `<li><button class="${state}" type="button" data-iso2="${country.iso2}">
    <span aria-hidden="true">${country.flag}</span>
    <span><strong>${esc(country.common)}</strong>${full}</span>
  </button></li>`;
};

const section = (title, items, suggested) => `
  <section>
    <h3>${title}</h3>
    <ul class="grid">${items.map((country) => card(country, suggested)).join("")}</ul>
  </section>
`;

function render(query = "") {
  const q = norm(query.trim());
  if (q) {
    const found = countries.filter((country) =>
      [country.common, country.full, country.iso2, ...(country.aliases || [])]
        .filter(Boolean)
        .some((value) => norm(value).includes(q))
    );
    results.innerHTML = found.length
      ? section("Results", found)
      : `<p class="empty">No matches for "${esc(query)}".</p>`;
    return;
  }

  const suggested = guess();
  results.innerHTML =
    (suggested ? section("Suggested for you", [suggested], suggested.iso2) : "") +
    section(
      "All countries and regions",
      countries.filter((country) => country.iso2 !== suggested?.iso2)
    );
}

function open() {
  if (trigger.disabled) return;
  lastFocus = document.activeElement;
  trigger.setAttribute("aria-expanded", "true");
  search.value = "";
  render();
  dialog.showModal();
  requestAnimationFrame(() => search.focus());
}

trigger.addEventListener("click", open);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Array.from(new FormData(form), ([name, value]) => `${name}: ${value || "(empty)"}`);
  alert(values.join("\n"));
});
search.addEventListener("input", () => render(search.value));
results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-iso2]");
  if (!button) return;
  setTrigger(countries.find((country) => country.iso2 === button.dataset.iso2));
  dialog.close();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  trigger.setAttribute("aria-expanded", "false");
  lastFocus?.focus?.();
});

fetch("./countries.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Failed to load countries.json: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    countries = data.slice().sort((a, b) => (b.pop || 0) - (a.pop || 0) || a.common.localeCompare(b.common));
    trigger.disabled = false;
    valueEl.value = "";
    nameEl.textContent = "Select country...";
  })
  .catch((error) => {
    console.error(error);
    flag.textContent = "⚠️";
    nameEl.textContent = "Country list unavailable";
  });
