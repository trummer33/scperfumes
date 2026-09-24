const BRAND_ORDER = ["Maison Alhambra", "Lattafa", "Al Wataniah", "French Avenue", "Sahari", "Jacques Bogart", "Orientica", "Fragrance World", "Ard Al Zaafaran"];
const CATEGORY_ORDER = ["Feminina", "Masculina", "Compartilhável"];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

class CatalogApp {
  constructor() {
    this.brand = "Todas";
    this.category = "Todas";
    this.grid = document.getElementById("perfume-grid");
    this.modal = document.getElementById("modal");
    this.init();
  }

  async init() {
    try {
      const response = await fetch("catalog.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Catálogo indisponível");
      this.products = await response.json();
      this.renderFilters();
      this.applyFilters();
    } catch {
      this.grid.innerHTML = '<div class="loading">Não foi possível carregar o catálogo.</div>';
    }
    this.grid.addEventListener("click", (event) => {
      const card = event.target.closest(".card");
      if (card) this.openModal(card.dataset.id);
    });
    this.grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".card");
      if (card) { event.preventDefault(); this.openModal(card.dataset.id); }
    });
    this.modal.addEventListener("click", (event) => {
      if (event.target === this.modal || event.target.closest("[data-close]")) this.modal.close();
    });
  }

  values(key, order, allLabel) {
    const present = [...new Set(this.products.map((item) => item[key]).filter(Boolean))];
    return [allLabel, ...order.filter((value) => present.includes(value)), ...present.filter((value) => !order.includes(value))];
  }

  renderFilters() {
    const render = (id, values, active, key) => {
      document.getElementById(id).innerHTML = values.map((value) => `<button type="button" class="${key === "brand" ? "btn-brand" : "btn-cat"} ${value === active ? "active" : ""}" data-${key}="${esc(value)}">${esc(value)}</button>`).join("");
    };
    render("brand-filters", this.values("marca", BRAND_ORDER, "Todas"), this.brand, "brand");
    render("category-filters", this.values("categoria", CATEGORY_ORDER, "Todas"), this.category, "category");
    document.getElementById("brand-filters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-brand]");
      if (!button) return;
      this.brand = button.dataset.brand;
      this.renderFilters(); this.applyFilters();
    });
    document.getElementById("category-filters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      this.category = button.dataset.category;
      this.renderFilters(); this.applyFilters();
    });
  }

  applyFilters() {
    const filtered = this.products.filter((item) => (this.brand === "Todas" || item.marca === this.brand) && (this.category === "Todas" || item.categoria === this.category));
    document.getElementById("catalog-count").textContent = `${filtered.length} ${filtered.length === 1 ? "fragrância encontrada" : "fragrâncias encontradas"}`;
    this.grid.innerHTML = filtered.length ? filtered.map((item) => `<article class="card" data-id="${esc(item.id)}" tabindex="0" role="button" aria-label="Ver ${esc(item.nome)}"><div class="card-img-box"><img src="${esc(item.img)}" alt="${esc(item.nome)}" loading="lazy" decoding="async" fetchpriority="low" width="640" height="800"></div><div class="card-info"><span class="card-brand">${esc(item.marca)}</span><h2 class="card-title">${esc(item.nome)}</h2><span class="btn-discover">Descobrir Essência</span></div></article>`).join("") : '<div class="loading">Nenhuma fragrância encontrada com esses filtros.</div>';
    this.grid.querySelectorAll("img").forEach((img) => { if (img.complete && img.naturalWidth) img.classList.add("loaded"); });
    this.grid.querySelectorAll("img").forEach((img) => img.addEventListener("load", () => img.classList.add("loaded"), { once: true }));
  }

  openModal(id) {
    const item = this.products.find((product) => String(product.id) === String(id));
    if (!item) return;
    document.getElementById("modal-img").src = item.img;
    document.getElementById("modal-img").alt = item.nome;
    document.getElementById("modal-brand").textContent = item.marca;
    document.getElementById("modal-title").textContent = item.nome;
    document.getElementById("modal-desc").textContent = item.desc;
    document.getElementById("modal-notes").innerHTML = `<li><strong>Saída:</strong> ${esc(item.notas?.saida || "--")}</li><li><strong>Coração:</strong> ${esc(item.notas?.coracao || "--")}</li><li><strong>Fundo:</strong> ${esc(item.notas?.fundo || "--")}</li>`;
    this.modal.showModal();
  }
}
new CatalogApp();
