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

const BRANDS = ["Destaques", "Maison Alhambra", "Lattafa", "Al Wataniah", "French Avenue", "Sahari"];

class PerfumeApp {
    constructor() {
        this.catalog = [];
        this.currentBrand = "Destaques";
        this.init();
    }

    async init() {
        await this.loadCatalog();
        this.setupDOM();
        this.renderBrandFilters();
        this.filterByBrand("Destaques");
    }

    async loadCatalog() {
        try {
            const res = await fetch("catalog.json", { cache: "no-cache" });
            if (!res.ok) throw new Error("catalog.json não encontrado");
            const data = await res.json();
            const items = Array.isArray(data) ? data : data.products;
            this.catalog = (items && items.length > 0) ? items : FALLBACK_CATALOG;
        } catch (e) {
            console.warn("Carregando catálogo padrão local:", e.message);
            this.catalog = FALLBACK_CATALOG;
        }
    }

    setupDOM() {
        this.modal = document.getElementById("modal");
        this.perfumeGrid = document.getElementById("perfume-grid");
        this.brandFiltersContainer = document.getElementById("brand-filters");

        this.perfumeGrid.addEventListener("click", (e) => {
            const card = e.target.closest(".card");
            if (card) this.openModal(card.dataset.id);
        });

        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.modal.hasAttribute("open")) this.closeModal();
        });
    }

    renderBrandFilters() {
        this.brandFiltersContainer.innerHTML = BRANDS.map(brand =>
            `<button class="btn-brand ${brand === "Destaques" ? "active" : ""}" data-brand="${brand}">${brand}</button>`
        ).join("");

        this.brandFiltersContainer.addEventListener("click", (e) => {
            if (e.target.classList.contains("btn-brand")) {
                this.filterByBrand(e.target.dataset.brand);
            }
        });
    }

    filterByBrand(brand) {
        this.currentBrand = brand;
        document.querySelectorAll(".btn-brand").forEach(btn => 
            btn.classList.toggle("active", btn.dataset.brand === brand)
        );

        const filtered = brand === "Destaques"
            ? this.catalog.filter(p => p.destaque === true)
            : this.catalog.filter(p => p.marca === brand);

        this.renderGrid(filtered);
    }

    renderGrid(products) {
        if (!products.length) {
            this.perfumeGrid.innerHTML = '<div class="loading">Nenhuma fragrância encontrada nesta categoria.</div>';
            return;
        }

        this.perfumeGrid.innerHTML = products.map(product =>
            `<article class="card" data-id="${product.id}" tabindex="0" role="button">
                <div class="card-img-box">
                    <img src="${product.img}" alt="${product.nome}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=800&auto=format&fit=crop';">
                </div>
                <div class="card-info">
                    <span class="card-brand">${product.marca}</span>
                    <h3 class="card-title">${product.nome}</h3>
                    <span class="btn-discover">Descobrir Essência</span>
                </div>
            </article>`
        ).join("");
    }

    openModal(id) {
        const perfume = this.catalog.find(p => String(p.id) === String(id));
        if (!perfume) return;

        const img = document.getElementById("modal-img");
        img.src = perfume.img;
        img.onerror = () => { img.src = "https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=800&auto=format&fit=crop"; };

        document.getElementById("modal-brand").textContent = perfume.marca;
        document.getElementById("modal-title").textContent = perfume.nome;
        document.getElementById("modal-desc").textContent = perfume.desc;

        document.getElementById("modal-notes").innerHTML = `
            <li><strong>Saída:</strong> ${perfume.notas?.saida || "--"}</li>
            <li><strong>Coração:</strong> ${perfume.notas?.coracao || "--"}</li>
            <li><strong>Fundo:</strong> ${perfume.notas?.fundo || "--"}</li>
        `;

        if (this.modal.tagName === "DIALOG") this.modal.showModal();
        else this.modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    closeModal() {
        if (this.modal.tagName === "DIALOG") this.modal.close();
        else this.modal.classList.remove("active");
        document.body.style.overflow = "auto";
    }
}

window.perfumeApp = new PerfumeApp();