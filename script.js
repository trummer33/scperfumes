/**
 * S&C PERFUMES - Vitrine Local (Sem Firebase)
 * Lê os dados diretamente de catalog.json
 */

const FALLBACK_CATALOG = [
    {
        id: "1",
        marca: "Maison Alhambra",
        nome: "La Rouge Baroque Extreme",
        destaque: true,
        desc: "Luxo engarrafado em um frasco vermelho intenso. Uma fragrância amendoada e quente que exala poder, perfeitamente equilibrada com notas amadeiradas e doces.",
        notas: { saida: "Amêndoa Amarga e Açafrão", coracao: "Jasmim Egípcio e Cedro", fundo: "Âmbar Cinzento e Almíscar" },
        img: "https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "2",
        marca: "French Avenue",
        nome: "Liquid Brun",
        destaque: true,
        desc: "O epítome da sofisticação noturna. Uma fragrância quente, especiada e densa, formulada para quem aprecia o luxo absoluto e notas maduras.",
        notas: { saida: "Cardamomo e Canela", coracao: "Couro, Íris e Tabaco", fundo: "Madeiras Raras e Patchouli" },
        img: "https://images.unsplash.com/photo-1523293115678-d2900f52f5a8?q=80&w=800&auto=format&fit=crop"
    },
    {
        id: "3",
        marca: "Lattafa",
        nome: "Qaed Al Fursan",
        destaque: true,
        desc: "A essência de quem lidera. Destaca-se por uma abertura brilhante de abacaxi maduro envolvido em um coração de madeiras e fundo esfumaçado.",
        notas: { saida: "Abacaxi Selvagem e Bergamota", coracao: "Jasmim, Rosa e Madeiras", fundo: "Bétula e Musgo de Carvalho" },
        img: "https://images.unsplash.com/photo-1595535373192-fc89fea941c4?q=80&w=800&auto=format&fit=crop"
    }
];

const BRAND_ORDER = ["Maison Alhambra", "Lattafa", "Al Wataniah", "French Avenue", "Sahari", "Jacques Bogart", "Orientica", "Fragrance World", "Ard Al Zaafaran"];
const CATEGORY_ORDER = ["Feminina", "Masculina", "Compartilhável"];
const HIGHLIGHT_LIMIT = 6;
const WHATSAPP_NUMBER = "5567998034726";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const formatPrice = (value) => Number.isFinite(Number(value)) && Number(value) > 0
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))
    : "";
const formatStock = (value) => Number.isInteger(Number(value)) && Number(value) >= 0
    ? Number(value) === 0 ? "Indisponível" : `${Number(value)} ${Number(value) === 1 ? "unidade disponível" : "unidades disponíveis"}`
    : "";

class PerfumeApp {
    constructor() {
        this.catalog = [];
        this.currentBrand = "Destaques";
        this.currentCategory = "Todas";
        this.closing = false;
        this.init();
    }

    async init() {
        this.setupDOM();
        await this.loadCatalog();
        this.renderBrandFilters();
        this.renderCategoryFilters();
        this.renderPremium();
        this.applyFilters();
    }

    async loadCatalog() {
        try {
            const res = await fetch("/api/catalog", { cache: "no-store" });
            if (!res.ok) throw new Error("catalog.json não encontrado");
            const data = await res.json();
            const items = Array.isArray(data) ? data : data.products;
            this.catalog = (items && items.length > 0) ? items : FALLBACK_CATALOG;
        } catch (e) {
            console.warn("Carregando catálogo padrão local:", e.message);
            this.catalog = FALLBACK_CATALOG;
        }
    }

    /** Só mostra marcas que têm produto (ordem fixa + marcas novas que aparecerem no JSON). */
    getBrands() {
        const present = [...new Set(this.catalog.map(p => p.marca).filter(Boolean))];
        const ordered = BRAND_ORDER.filter(b => present.includes(b));
        const extra = present.filter(b => !BRAND_ORDER.includes(b));
        return ["Destaques", ...ordered, ...extra];
    }

    getCategories() {
        const present = [...new Set(this.catalog.map(p => p.categoria).filter(Boolean))];
        const ordered = CATEGORY_ORDER.filter(c => present.includes(c));
        const extra = present.filter(c => !CATEGORY_ORDER.includes(c));
        return ["Todas", ...ordered, ...extra];
    }

    setupDOM() {
        this.modal = document.getElementById("modal");
        this.perfumeGrid = document.getElementById("perfume-grid");
        this.brandFiltersContainer = document.getElementById("brand-filters");
        this.categoryFiltersContainer = document.getElementById("category-filters");
        this.premiumSection = document.getElementById("exclusivos");
        this.premiumGrid = document.getElementById("premium-grid");
        this.premiumNav = document.getElementById("nav-exclusivos");

        // Grid: clique, teclado e imagens (fallback + fade-in)
        this.perfumeGrid.addEventListener("click", (e) => {
            const card = e.target.closest(".card");
            if (card) this.openModal(card.dataset.id);
        });
        this.perfumeGrid.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const card = e.target.closest(".card");
            if (card) { e.preventDefault(); this.openModal(card.dataset.id); }
        });
        this.premiumGrid.addEventListener("click", (e) => {
            const card = e.target.closest(".card");
            if (card) this.openModal(card.dataset.id);
        });
        this.premiumGrid.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const card = e.target.closest(".card");
            if (card) { e.preventDefault(); this.openModal(card.dataset.id); }
        });
        this.perfumeGrid.addEventListener("load", (e) => {
            if (e.target.tagName === "IMG") e.target.classList.add("loaded");
        }, true);

        // Filtros (listener registrado uma única vez)
        this.brandFiltersContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-brand");
            if (btn) this.filterByBrand(btn.dataset.brand);
        });

        this.categoryFiltersContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-cat");
            if (btn) this.filterByCategory(btn.dataset.cat);
        });

        document.addEventListener("click", (e) => {
            const link = e.target.closest("[data-scroll]");
            if (!link) return;
            e.preventDefault();
            document.getElementById(link.dataset.scroll)?.scrollIntoView({ behavior: REDUCED_MOTION.matches ? "auto" : "smooth" });
        });

        // Modal
        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal || e.target.closest("[data-close]")) this.closeModal();
        });
        this.modal.addEventListener("cancel", (e) => { e.preventDefault(); this.closeModal(); }); // Esc
        window.addEventListener("popstate", () => { if (this.modal.open) this.hideModal(); }); // botão voltar do celular
    }

    renderBrandFilters() {
        this.brandFiltersContainer.innerHTML = this.getBrands().map(brand =>
            `<button type="button" class="btn-brand ${brand === this.currentBrand ? "active" : ""}" data-brand="${esc(brand)}">${esc(brand)}</button>`
        ).join("");
    }

    renderCategoryFilters() {
        const cats = this.getCategories();
        this.categoryFiltersContainer.hidden = cats.length < 3; // com 1 só categoria não há o que filtrar
        this.categoryFiltersContainer.innerHTML = cats.map(cat =>
            `<button type="button" class="btn-cat ${cat === this.currentCategory ? "active" : ""}" data-cat="${esc(cat)}" aria-pressed="${cat === this.currentCategory}">${esc(cat)}</button>`
        ).join("");
    }

    filterByBrand(brand) {
        this.currentBrand = brand;
        this.brandFiltersContainer.querySelectorAll(".btn-brand").forEach(btn => {
            const active = btn.dataset.brand === brand;
            btn.classList.toggle("active", active);
            if (active) btn.scrollIntoView({ inline: "center", block: "nearest", behavior: REDUCED_MOTION.matches ? "auto" : "smooth" });
        });
        this.applyFilters();
    }

    filterByCategory(cat) {
        this.currentCategory = cat;
        this.categoryFiltersContainer.querySelectorAll(".btn-cat").forEach(btn => {
            const active = btn.dataset.cat === cat;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-pressed", active);
        });
        this.applyFilters();
    }

    renderPremium() {
        const premium = this.catalog.filter((product) => product.premium === true);
        this.premiumSection.hidden = premium.length === 0;
        this.premiumNav.hidden = premium.length === 0;
        this.premiumGrid.innerHTML = premium.map((product) => `
            <article class="card" data-id="${esc(product.id)}" tabindex="0" role="button" aria-label="Ver ${esc(product.nome)}">
                <div class="card-img-box"><img src="${esc(product.img)}" alt="${esc(product.nome)}" loading="lazy" decoding="async" width="640" height="800"></div>
                <div class="card-info"><span class="card-brand">${esc(product.marca)}</span><h3 class="card-title">${esc(product.nome)}</h3>${formatPrice(product.preco) ? `<span class="premium-price">${formatPrice(product.preco)}</span>` : ""}${formatStock(product.estoque) ? `<span class="premium-stock ${Number(product.estoque) === 0 ? "is-sold-out" : ""}">${formatStock(product.estoque)}</span>` : ""}<span class="btn-discover">Conhecer a Seleção</span></div>
            </article>`).join("");
    }

    /** Marca e categoria funcionam juntas (ex.: Lattafa + Feminina). */
    applyFilters() {
        const byBrand = this.currentBrand === "Destaques"
            ? this.catalog.filter(p => p.destaque === true).slice(0, HIGHLIGHT_LIMIT)
            : this.catalog.filter(p => p.marca === this.currentBrand);
        const filtered = this.currentCategory === "Todas"
            ? byBrand
            : byBrand.filter(p => p.categoria === this.currentCategory);
        this.renderGrid(filtered);
    }

    renderGrid(products) {
        if (!products.length) {
            this.perfumeGrid.innerHTML = '<div class="loading">Nenhuma fragrância encontrada com esses filtros. Tente outra marca ou categoria.</div>';
            return;
        }

        this.perfumeGrid.innerHTML = products.map(p =>
            `<article class="card" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="Ver ${esc(p.nome)}">
                <div class="card-img-box">
                    <img src="${esc(p.img)}" alt="${esc(p.nome)}" loading="lazy" decoding="async" width="640" height="800">
                </div>
                <div class="card-info">
                    <span class="card-brand">${esc(p.marca)}</span>
                    <h3 class="card-title">${esc(p.nome)}</h3>
                    <span class="btn-discover">Descobrir Essência</span>
                </div>
            </article>`
        ).join("");

        // imagens em cache podem já estar carregadas
        this.perfumeGrid.querySelectorAll("img").forEach(img => { if (img.complete && img.naturalWidth) img.classList.add("loaded"); });

        // pequena transição ao trocar de marca
        this.perfumeGrid.classList.remove("is-swapping");
        void this.perfumeGrid.offsetWidth;
        this.perfumeGrid.classList.add("is-swapping");
    }

    openModal(id) {
        const perfume = this.catalog.find(p => String(p.id) === String(id));
        if (!perfume || this.modal.open) return;

        const img = document.getElementById("modal-img");
        img.onerror = null;
        img.src = perfume.img;
        img.alt = perfume.nome;

        document.getElementById("modal-brand").textContent = perfume.marca;
        document.getElementById("modal-title").textContent = perfume.nome;
        document.getElementById("modal-desc").textContent = perfume.desc;
        const contact = document.getElementById("product-contact");
        contact.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá! Tenho interesse no perfume ${perfume.nome}. Poderia me ajudar com mais informações?`)}`;

        document.getElementById("modal-notes").innerHTML = `
            ${formatPrice(perfume.preco) ? `<li class="modal-price"><strong>Preço:</strong> ${formatPrice(perfume.preco)}</li>` : ""}
            ${formatStock(perfume.estoque) ? `<li class="modal-stock"><strong>Estoque:</strong> ${formatStock(perfume.estoque)}</li>` : ""}
            <li><strong>Saída:</strong> ${esc(perfume.notas?.saida || "--")}</li>
            <li><strong>Coração:</strong> ${esc(perfume.notas?.coracao || "--")}</li>
            <li><strong>Fundo:</strong> ${esc(perfume.notas?.fundo || "--")}</li>
        `;

        this.modal.classList.remove("is-closing");
        this.modal.showModal();
        this.modal.querySelector(".modal-layout").scrollTop = 0;
        document.documentElement.classList.add("modal-open");
        history.pushState({ modal: true }, ""); // "voltar" no celular fecha o modal em vez de sair do site
    }

    /** Todo fechamento passa pelo histórico para manter tudo sincronizado. */
    closeModal() {
        if (!this.modal.open) return;
        if (history.state && history.state.modal) history.back(); // dispara popstate -> hideModal
        else this.hideModal();
    }

    hideModal() {
        if (!this.modal.open || this.closing) return;
        const done = () => {
            this.modal.classList.remove("is-closing");
            this.modal.close();
            document.documentElement.classList.remove("modal-open");
            this.closing = false;
        };
        if (REDUCED_MOTION.matches) return done();
        this.closing = true;
        this.modal.classList.add("is-closing");
        setTimeout(done, 200);
    }
}

window.perfumeApp = new PerfumeApp();
