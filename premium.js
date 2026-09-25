const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const WHATSAPP_NUMBER = "5567998034726";
const formatPrice = (value) => Number.isFinite(Number(value)) && Number(value) > 0
  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))
  : "";
const formatStock = (value) => Number.isInteger(Number(value)) && Number(value) >= 0
  ? Number(value) === 0 ? "Indisponível" : `${Number(value)} ${Number(value) === 1 ? "unidade disponível" : "unidades disponíveis"}`
  : "";

class PremiumApp {
  constructor() {
    this.grid = document.getElementById("premium-grid");
    this.count = document.getElementById("premium-count");
    this.modal = document.getElementById("modal");
    this.init();
  }

  async init() {
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("Seleção indisponível");
      const catalog = await response.json();
      this.products = (Array.isArray(catalog) ? catalog : catalog.products || []).filter((item) => item.premium === true && item.disponivel !== false);
      this.render();
    } catch {
      this.grid.innerHTML = '<div class="loading">Não foi possível carregar a seleção premium.</div>';
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

  render() {
    this.count.textContent = `${this.products.length} ${this.products.length === 1 ? "fragrância selecionada" : "fragrâncias selecionadas"}`;
    this.grid.innerHTML = this.products.length ? this.products.map((item) => `<article class="card" data-id="${esc(item.id)}" tabindex="0" role="button" aria-label="Ver ${esc(item.nome)}"><div class="card-img-box"><img src="${esc(item.img)}" alt="${esc(item.nome)}" loading="lazy" decoding="async" width="640" height="800"></div><div class="card-info"><span class="card-brand">${esc(item.marca)}</span><h2 class="card-title">${esc(item.nome)}</h2>${formatPrice(item.preco) ? `<span class="premium-price">${formatPrice(item.preco)}</span>` : ""}${formatStock(item.estoque) ? `<span class="premium-stock ${Number(item.estoque) === 0 ? "is-sold-out" : ""}">${formatStock(item.estoque)}</span>` : ""}<span class="btn-discover">Conhecer a Seleção</span></div></article>`).join("") : '<div class="loading">Nenhum produto está na seleção premium no momento.</div>';
  }

  openModal(id) {
    const item = this.products.find((product) => String(product.id) === String(id));
    if (!item) return;
    document.getElementById("modal-img").src = item.img;
    document.getElementById("modal-img").alt = item.nome;
    document.getElementById("modal-brand").textContent = item.marca;
    document.getElementById("modal-title").textContent = item.nome;
    document.getElementById("modal-desc").textContent = item.desc;
    document.getElementById("product-contact").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá! Tenho interesse no perfume ${item.nome}. Poderia me ajudar com mais informações?`)}`;
    document.getElementById("modal-notes").innerHTML = `${formatPrice(item.preco) ? `<li class="modal-price"><strong>Preço:</strong> ${formatPrice(item.preco)}</li>` : ""}${formatStock(item.estoque) ? `<li class="modal-stock"><strong>Estoque:</strong> ${formatStock(item.estoque)}</li>` : ""}<li><strong>Saída:</strong> ${esc(item.notas?.saida || "--")}</li><li><strong>Coração:</strong> ${esc(item.notas?.coracao || "--")}</li><li><strong>Fundo:</strong> ${esc(item.notas?.fundo || "--")}</li>`;
    this.modal.showModal();
  }
}
new PremiumApp();
