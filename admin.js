/**
 * S&C PERFUMES - Painel Administrativo
 *
 * Arquitetura:
 *  - Repositórios (FirestoreRepository / LocalRepository): camada de dados com a mesma interface.
 *  - AdminApp: estado, renderização e ações da interface.
 *
 * Modo Firebase: login por e-mail/senha + CRUD na coleção "perfumes" (a mesma lida pela vitrine).
 * Modo local (demonstração): usado quando o Firebase ainda não foi configurado.
 *   Os dados ficam só neste navegador e NÃO aparecem na vitrine.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc,
    doc, writeBatch, serverTimestamp, limit, query
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

/* ==========================================================================
   CONSTANTES
   ========================================================================== */
const COLLECTION = "perfumes";
const LOCAL_KEY = "sc_admin_products_v1";
const BATCH_SIZE = 450; // limite do Firestore é 500 operações por batch

const PAGE_TITLES = {
    "dashboard": "Dashboard",
    "products": "Produtos",
    "add-product": "Novo Produto",
    "settings": "Configurações"
};

const PLACEHOLDER_IMG = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
    '<rect width="80" height="80" fill="#1A1816"/>' +
    '<path d="M32 24h16v9l7 7v20H25V40l7-7z" fill="none" stroke="#8B6F47" stroke-width="2"/></svg>'
);

/** Catálogo inicial (o mesmo fallback da vitrine), para migrar ao Firestore com um clique. */
const SEED_CATALOG = [
    {
        marca: "Maison Alhambra", nome: "La Rouge Baroque Extreme", destaque: true,
        desc: "Luxo engarrafado em um frasco vermelho intenso. Uma fragrância amendoada e quente que exala poder, perfeitamente equilibrada com notas amadeiradas e doces.",
        notas: { saida: "Amêndoa Amarga e Açafrão", coracao: "Jasmim Egípcio e Cedro", fundo: "Âmbar Cinzento e Almíscar" },
        img: "https://s10.aconvert.com/convert/p3r68-cdx67/aa6zf-8ohyq.jpg"
    },
    {
        marca: "French Avenue", nome: "Liquid Brun", destaque: true,
        desc: "O epítome da sofisticação noturna. Uma fragrância quente, especiada e densa, formulada para quem aprecia o luxo absoluto e notas maduras.",
        notas: { saida: "Cardamomo e Canela", coracao: "Couro, Íris e Tabaco", fundo: "Madeiras Raras e Patchouli" },
        img: "https://s10.aconvert.com/convert/p3r68-cdx67/apjwy-8xrlg.jpg"
    },
    {
        marca: "Maison Alhambra", nome: "La Rouge Baroque", destaque: false,
        desc: "Luminosa e sofisticada. A combinação perfeita de flores luminosas com a profundidade quente e envolvente do âmbar e das madeiras nobres.",
        notas: { saida: "Jasmim e Açafrão Especial", coracao: "Madeira de Âmbar", fundo: "Resina de Abeto e Cedro" },
        img: "https://s10.aconvert.com/convert/p3r68-cdx67/alm4o-dbsxj.jpg"
    },
    {
        marca: "Al Wataniah", nome: "Sabah Al Ward", destaque: true,
        desc: "A feminilidade traduzida em um frasco escultural. Uma fragrância floral e oriental que cativa os sentidos, deixando um rastro de mistério.",
        notas: { saida: "Tangerina e Pimenta Rosa", coracao: "Cacau e Flor de Laranjeira", fundo: "Baunilha e Fava Tonka" },
        img: "https://prnt.sc/h7apVvb0Vqpn"
    },
    {
        marca: "Lattafa", nome: "Qaed Al Fursan", destaque: true,
        desc: "A essência de quem lidera. Destaca-se por uma abertura brilhante de abacaxi maduro envolvido em um coração de madeiras e fundo esfumaçado.",
        notas: { saida: "Abacaxi Selvagem e Bergamota", coracao: "Jasmim, Rosa e Madeiras", fundo: "Bétula e Musgo de Carvalho" },
        img: "https://images.unsplash.com/photo-1595535373192-fc89fea941c4?q=80&w=800&auto=format&fit=crop"
    },
    {
        marca: "Sahari", nome: "Rose Paris", destaque: false,
        desc: "A pura tradução do romantismo. Um buquê floral fresco centrado na majestosa rosa damascena, finalizado com um toque macio de almíscar.",
        notas: { saida: "Limão Siciliano e Notas Verdes", coracao: "Rosa Damascena e Frutas Vermelhas", fundo: "Almíscar Branco e Cedro" },
        img: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=800&auto=format&fit=crop"
    }
];

/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const normalizeText = (value) =>
    String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

const debounce = (fn, wait = 250) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const formatDate = (millis) => (millis ? dateFormatter.format(new Date(millis)) : "--");

/** Converte Timestamp do Firestore (ou número) em milissegundos. */
const toMillis = (value) => value?.toMillis?.() ?? (typeof value === "number" ? value : null);

/**
 * Valida e limpa um produto (formulário ou arquivo importado).
 * Retorna null se estiver incompleto ou inválido.
 */
function sanitizeProduct(raw, allowedBrands) {
    if (!raw || typeof raw !== "object") return null;
    const text = (value) => String(value ?? "").trim();

    const product = {
        nome: text(raw.nome),
        marca: text(raw.marca),
        desc: text(raw.desc),
        img: text(raw.img),
        destaque: Boolean(raw.destaque),
        notas: {
            saida: text(raw.notas?.saida),
            coracao: text(raw.notas?.coracao),
            fundo: text(raw.notas?.fundo)
        }
    };

    const valid =
        product.nome && product.desc && product.notas.saida &&
        product.notas.coracao && product.notas.fundo &&
        allowedBrands.includes(product.marca) && isHttpUrl(product.img);

    return valid ? product : null;
}

/** Traduz erros do Firebase para mensagens claras. */
function friendlyError(error) {
    const code = error?.code || "";
    const map = {
        "permission-denied": "Sem permissão. Confira as regras do Firestore e se você está logado.",
        "unavailable": "Sem conexão com o servidor. Tente novamente em instantes.",
        "unauthenticated": "Sessão expirada. Entre novamente.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-email": "E-mail inválido.",
        "auth/user-disabled": "Este usuário foi desativado.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
        "auth/network-request-failed": "Falha de rede. Verifique sua conexão."
    };
    return map[code] || error?.message || "Ocorreu um erro inesperado.";
}

/* ==========================================================================
   CAMADA DE DADOS
   ========================================================================== */

/** Persistência no Firestore (coleção usada pela vitrine). */
class FirestoreRepository {
    constructor(db) {
        this.db = db;
        this.col = collection(db, COLLECTION);
    }

    async list() {
        const snapshot = await getDocs(this.col);
        return snapshot.docs.map((d) => {
            const data = d.data();
            return { ...data, id: d.id, createdAt: toMillis(data.createdAt), updatedAt: toMillis(data.updatedAt) };
        });
    }

    async create(data) {
        const ref = await addDoc(this.col, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return ref.id;
    }

    async update(id, data) {
        await updateDoc(doc(this.db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
    }

    async remove(id) {
        await deleteDoc(doc(this.db, COLLECTION, id));
    }

    async removeMany(ids) {
        await this.#commit(ids, (batch, id) => batch.delete(doc(this.db, COLLECTION, id)));
    }

    async createMany(items) {
        await this.#commit(items, (batch, item) =>
            batch.set(doc(this.col), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    }

    async ping() {
        const started = performance.now();
        const snapshot = await getDocs(query(this.col, limit(1)));
        return { ms: Math.round(performance.now() - started), empty: snapshot.empty };
    }

    async #commit(items, apply) {
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = writeBatch(this.db);
            items.slice(i, i + BATCH_SIZE).forEach((item) => apply(batch, item));
            await batch.commit();
        }
    }
}

/** Persistência local (modo demonstração). Mesma interface do Firestore. */
class LocalRepository {
    #read() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
        } catch {
            return [];
        }
    }

    #write(items) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    }

    async list() { return this.#read(); }

    async create(data) {
        const id = crypto.randomUUID();
        const now = Date.now();
        this.#write([...this.#read(), { ...data, id, createdAt: now, updatedAt: now }]);
        return id;
    }

    async update(id, data) {
        this.#write(this.#read().map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p)));
    }

    async remove(id) { this.#write(this.#read().filter((p) => p.id !== id)); }

    async removeMany(ids) {
        const set = new Set(ids);
        this.#write(this.#read().filter((p) => !set.has(p.id)));
    }

    async createMany(items) {
        const now = Date.now();
        this.#write([...this.#read(), ...items.map((item) => ({
            ...item, id: crypto.randomUUID(), createdAt: now, updatedAt: now
        }))]);
    }

    async ping() { return { ms: 0, empty: this.#read().length === 0 }; }
}

/* ==========================================================================
   APLICAÇÃO
   ========================================================================== */
class AdminApp {
    #confirmResolver = null;

    constructor() {
        this.products = [];
        this.filter = "all";
        this.query = "";
        this.editingId = null;
        this.mode = "local";
        this.repo = null;
        this.auth = null;
        this.user = null;
        this.entered = false;

        this.runSearch = debounce(() => {
            this.query = normalizeText($("#search-input").value);
            this.renderTable();
        }, 200);

        document.body.classList.add("auth-pending");
        this.init();
    }

    /* ---------- Inicialização ---------- */
    init() {
        this.cacheDom();
        this.patchLegacyMarkup();
        this.buildLoginOverlay();
        this.buildBackdrop();
        this.bindEvents();

        this.brands = $$("#product-brand option").map((o) => o.value).filter(Boolean);

        if (!isFirebaseConfigured()) {
            this.startLocalMode("Firebase não configurado. Você está no modo demonstração: os dados ficam só neste navegador e não aparecem na vitrine.");
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            this.auth = getAuth(app);
            this.repo = new FirestoreRepository(getFirestore(app));
            this.mode = "firebase";

            onAuthStateChanged(this.auth, (user) => {
                this.user = user;
                user ? this.enterApp() : this.showLogin();
            });
        } catch (error) {
            console.error("Falha ao iniciar o Firebase:", error);
            this.startLocalMode("Não foi possível iniciar o Firebase. Modo demonstração ativo: nada é enviado à vitrine.");
        }
    }

    cacheDom() {
        this.dom = {
            form: $("#product-form"),
            tbody: $("#products-tbody"),
            recent: $("#recent-products"),
            confirmModal: $("#confirm-modal"),
            toasts: $("#toast-container"),
            title: $("#page-title"),
            img: $("#product-img")
        };
        this.dom.toasts.setAttribute("aria-live", "polite");
    }

    /** Ajustes no HTML legado: ícone inexistente no Font Awesome free e contador de notificações fictício. */
    patchLegacyMarkup() {
        $$(".fa-bottles").forEach((icon) => icon.classList.replace("fa-bottles", "fa-wine-bottle"));
        $(".header-actions .badge")?.remove();
    }

    buildLoginOverlay() {
        const overlay = document.createElement("div");
        overlay.className = "login-overlay";
        overlay.id = "login-overlay";
        overlay.hidden = true;
        overlay.innerHTML = `
            <form class="login-card" id="login-form" novalidate>
                <h1 class="sidebar-logo">S&amp;C <span>Admin</span></h1>
                <p class="login-desc">Entre para gerenciar o catálogo.</p>
                <div class="form-group">
                    <label for="login-email">E-mail</label>
                    <input type="email" id="login-email" autocomplete="username" required>
                </div>
                <div class="form-group">
                    <label for="login-password">Senha</label>
                    <input type="password" id="login-password" autocomplete="current-password" required>
                </div>
                <p class="form-error" id="login-error" role="alert"></p>
                <button type="submit" class="btn btn-primary btn-block" id="login-submit">Entrar</button>
            </form>`;
        document.body.appendChild(overlay);
        this.dom.login = overlay;
    }

    buildBackdrop() {
        const backdrop = document.createElement("div");
        backdrop.className = "sidebar-backdrop";
        backdrop.addEventListener("click", () => this.closeSidebarMobile());
        document.body.appendChild(backdrop);

        // Em telas pequenas a sidebar sai da tela; este botão do header a reabre
        const menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = "btn-menu-mobile";
        menuButton.setAttribute("aria-label", "Abrir menu");
        menuButton.innerHTML = `<i class="fas fa-bars" aria-hidden="true"></i>`;
        menuButton.addEventListener("click", () => this.toggleSidebar());
        $(".admin-header").prepend(menuButton);
    }

    bindEvents() {
        // Ações por delegação (editar, excluir, destaque, etc.)
        document.addEventListener("click", (event) => {
            const el = event.target.closest("[data-action]");
            if (!el) return;
            const { action, id } = el.dataset;
            const handlers = {
                "edit": () => this.editProduct(id),
                "delete": () => this.deleteProduct(id),
                "toggle-highlight": () => this.toggleHighlight(id),
                "new": () => this.switchSection("add-product"),
                "seed": () => this.seedCatalog()
            };
            handlers[action]?.();
        });

        // Imagens quebradas → placeholder (uma única vez por imagem)
        document.addEventListener("error", (event) => {
            const img = event.target;
            if (img.tagName === "IMG" && img.classList.contains("thumb") && !img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = PLACEHOLDER_IMG;
            }
        }, true);

        // Formulário
        this.buildImagePreview();
        this.dom.img.addEventListener("input", debounce(() => this.updateImagePreview(), 300));
        this.dom.form.addEventListener("reset", () => setTimeout(() => this.updateImagePreview(), 0));

        // Login
        $("#login-form").addEventListener("submit", (event) => this.handleLogin(event));

        // Modal de confirmação
        this.dom.confirmModal.addEventListener("close", () => this.#settle(false));
        this.dom.confirmModal.addEventListener("click", (event) => {
            if (event.target === this.dom.confirmModal) this.cancelConfirm();
        });

        // Layout responsivo
        window.matchMedia("(min-width: 901px)").addEventListener("change", () => this.closeSidebarMobile());
    }

    startLocalMode(message) {
        this.mode = "local";
        this.repo = new LocalRepository();
        this.demoMessage = message;
        $(".btn-logout")?.setAttribute("hidden", "");
        this.enterApp();
    }

    /* ---------- Autenticação ---------- */
    showLogin() {
        this.entered = false;
        this.products = [];
        document.body.classList.add("auth-pending");
        this.dom.login.hidden = false;
        $("#login-email").focus();
    }

    async enterApp() {
        if (this.entered) return;
        this.entered = true;

        this.dom.login.hidden = true;
        document.body.classList.remove("auth-pending");

        const name = this.user?.email || "Admin";
        $(".admin-profile span").textContent = name.split("@")[0];
        if (this.demoMessage) this.showDemoBanner();

        await this.loadProducts();
    }

    async handleLogin(event) {
        event.preventDefault();
        const button = $("#login-submit");
        const errorBox = $("#login-error");
        const email = $("#login-email").value.trim();
        const password = $("#login-password").value;

        errorBox.textContent = "";
        if (!email || !password) {
            errorBox.textContent = "Informe e-mail e senha.";
            return;
        }

        this.setLoading(button, true, "Entrando...");
        try {
            await signInWithEmailAndPassword(this.auth, email, password);
            $("#login-password").value = "";
        } catch (error) {
            errorBox.textContent = friendlyError(error);
        } finally {
            this.setLoading(button, false, "Entrar");
        }
    }

    async logout() {
        if (this.mode !== "firebase") return;
        const ok = await this.confirm({
            title: "Sair do painel",
            message: "Deseja encerrar sua sessão?",
            confirmLabel: "Sair",
            danger: false
        });
        if (!ok) return;
        try {
            await signOut(this.auth);
        } catch (error) {
            this.toast("error", friendlyError(error));
        }
    }

    /* ---------- Navegação ---------- */
    switchSection(name, { keepForm = false } = {}) {
        if (!PAGE_TITLES[name]) return;

        if (name === "add-product" && !keepForm) this.resetForm();

        $$(".section").forEach((s) => s.classList.toggle("active", s.id === name));
        $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.section === name));

        // Editando: o item "Novo Produto" da navegação representa a tela do formulário
        this.dom.title.textContent = name === "add-product" && this.editingId ? "Editar Produto" : PAGE_TITLES[name];

        this.closeSidebarMobile();
        window.scrollTo({ top: 0 });
    }

    toggleSidebar() {
        if (window.matchMedia("(max-width: 900px)").matches) {
            document.body.classList.toggle("sidebar-open");
        } else {
            document.body.classList.toggle("sidebar-collapsed");
        }
    }

    closeSidebarMobile() {
        document.body.classList.remove("sidebar-open");
    }

    /* ---------- Dados ---------- */
    async loadProducts() {
        this.dom.tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-spinner fa-spin"></i> Carregando produtos...</td></tr>`;
        try {
            this.products = await this.repo.list();
        } catch (error) {
            console.error(error);
            this.products = [];
            this.toast("error", friendlyError(error));
        }
        this.renderAll();
    }

    /** Executa uma escrita, recarrega a lista e trata erros. Retorna true em caso de sucesso. */
    async mutate(operation, successMessage) {
        try {
            await operation();
            await this.loadProducts();
            if (successMessage) this.toast("success", successMessage);
            return true;
        } catch (error) {
            console.error(error);
            this.toast("error", friendlyError(error));
            return false;
        }
    }

    findProduct(id) {
        return this.products.find((p) => p.id === id);
    }

    /* ---------- Renderização ---------- */
    renderAll() {
        this.renderStats();
        this.renderRecent();
        this.renderTable();
    }

    renderStats() {
        const list = this.products;
        $("#total-products").textContent = list.length;
        $("#total-brands").textContent = new Set(list.map((p) => p.marca)).size;
        $("#total-highlights").textContent = list.filter((p) => p.destaque).length;

        const latest = Math.max(0, ...list.map((p) => p.updatedAt || p.createdAt || 0));
        $("#last-update").textContent = formatDate(latest);
    }

    renderRecent() {
        const recent = [...this.products]
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 5);

        if (!recent.length) {
            this.dom.recent.innerHTML = this.emptyCatalogHtml();
            return;
        }

        this.dom.recent.innerHTML = recent.map((p) => `
            <button type="button" class="recent-item" data-action="edit" data-id="${escapeHtml(p.id)}">
                <img class="thumb" src="${escapeHtml(p.img)}" alt="" loading="lazy">
                <span class="recent-info">
                    <strong>${escapeHtml(p.nome)}</strong>
                    <small>${escapeHtml(p.marca)}</small>
                </span>
                <time>${formatDate(p.createdAt)}</time>
                <i class="fas fa-pen" aria-hidden="true"></i>
            </button>`).join("");
    }

    emptyCatalogHtml() {
        return `
            <div class="empty-state">
                <p>Seu catálogo está vazio.</p>
                <div class="button-group center">
                    <button type="button" class="btn btn-primary" data-action="new"><i class="fas fa-plus"></i> Adicionar produto</button>
                    <button type="button" class="btn btn-secondary" data-action="seed"><i class="fas fa-file-import"></i> Importar catálogo inicial</button>
                </div>
            </div>`;
    }

    getVisibleProducts() {
        return this.products
            .filter((p) => this.filter !== "highlight" || p.destaque)
            .filter((p) => !this.query || normalizeText(`${p.nome} ${p.marca}`).includes(this.query))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }

    renderTable() {
        if (!this.products.length) {
            this.dom.tbody.innerHTML = `<tr><td colspan="5">${this.emptyCatalogHtml()}</td></tr>`;
            return;
        }

        const visible = this.getVisibleProducts();
        if (!visible.length) {
            this.dom.tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><p>Nenhum produto encontrado com esses filtros.</p></td></tr>`;
            return;
        }

        this.dom.tbody.innerHTML = visible.map((p) => {
            const id = escapeHtml(p.id);
            return `
            <tr>
                <td data-label="Imagem"><img class="thumb" src="${escapeHtml(p.img)}" alt="${escapeHtml(p.nome)}" loading="lazy"></td>
                <td data-label="Nome"><strong class="cell-name">${escapeHtml(p.nome)}</strong></td>
                <td data-label="Marca">${escapeHtml(p.marca)}</td>
                <td data-label="Destaque">
                    <button type="button" class="star-toggle ${p.destaque ? "is-on" : ""}" data-action="toggle-highlight" data-id="${id}"
                            aria-pressed="${p.destaque}" title="${p.destaque ? "Remover dos destaques" : "Marcar como destaque"}">
                        <i class="fas fa-star" aria-hidden="true"></i>
                        <span class="sr-only">${p.destaque ? "Em destaque" : "Sem destaque"}</span>
                    </button>
                </td>
                <td data-label="Ações">
                    <div class="row-actions">
                        <button type="button" class="btn-icon" data-action="edit" data-id="${id}" title="Editar" aria-label="Editar ${escapeHtml(p.nome)}"><i class="fas fa-pen"></i></button>
                        <button type="button" class="btn-icon danger" data-action="delete" data-id="${id}" title="Excluir" aria-label="Excluir ${escapeHtml(p.nome)}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join("");
    }

    showDemoBanner() {
        if ($("#demo-banner")) return;
        const banner = document.createElement("div");
        banner.id = "demo-banner";
        banner.className = "demo-banner";
        banner.setAttribute("role", "status");
        banner.innerHTML = `<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span>${escapeHtml(this.demoMessage)}</span>`;
        $(".content-wrapper").before(banner);
    }

    /* ---------- Busca e filtros ---------- */
    searchProducts() { this.runSearch(); }

    filterProducts(filter) {
        this.filter = filter;
        $$(".filter-btn").forEach((b) => b.classList.toggle("active", b.dataset.filter === filter));
        this.renderTable();
    }

    /* ---------- Formulário ---------- */
    buildImagePreview() {
        const preview = document.createElement("div");
        preview.className = "img-preview";
        preview.hidden = true;
        preview.innerHTML = `<img class="thumb thumb-lg" alt="Pré-visualização da imagem"><small>Pré-visualização</small>`;
        this.dom.img.after(preview);
        this.dom.preview = preview;
    }

    updateImagePreview() {
        const url = this.dom.img.value.trim();
        const image = $("img", this.dom.preview);
        if (!isHttpUrl(url)) {
            this.dom.preview.hidden = true;
            return;
        }
        delete image.dataset.fallback;
        image.src = url;
        this.dom.preview.hidden = false;
    }

    readForm() {
        return sanitizeProduct({
            nome: $("#product-name").value,
            marca: $("#product-brand").value,
            desc: $("#product-desc").value,
            img: $("#product-img").value,
            destaque: $("#product-highlight").checked,
            notas: {
                saida: $("#product-saida").value,
                coracao: $("#product-coracao").value,
                fundo: $("#product-fundo").value
            }
        }, this.brands);
    }

    async saveProduct(event) {
        event.preventDefault();
        const data = this.readForm();
        if (!data) {
            this.toast("error", "Confira os campos: todos são obrigatórios e a imagem precisa ser uma URL http(s) válida.");
            return;
        }

        const duplicate = this.products.some((p) =>
            p.id !== this.editingId &&
            normalizeText(p.nome) === normalizeText(data.nome) && p.marca === data.marca);
        if (duplicate) {
            this.toast("error", "Já existe um produto com este nome nesta marca.");
            return;
        }

        const button = $("button[type='submit']", this.dom.form);
        const original = button.innerHTML;
        this.setLoading(button, true, "Salvando...");

        const editing = Boolean(this.editingId);
        const ok = await this.mutate(
            () => editing ? this.repo.update(this.editingId, data) : this.repo.create(data),
            editing ? "Produto atualizado." : "Produto adicionado."
        );

        this.setLoading(button, false, original, true);
        if (ok) {
            this.resetForm();
            this.switchSection("products");
        }
    }

    editProduct(id) {
        const product = this.findProduct(id);
        if (!product) return;

        this.editingId = id;
        $("#product-id").value = id;
        $("#product-name").value = product.nome;
        $("#product-brand").value = product.marca;
        $("#product-desc").value = product.desc;
        $("#product-img").value = product.img;
        $("#product-highlight").checked = Boolean(product.destaque);
        $("#product-saida").value = product.notas?.saida ?? "";
        $("#product-coracao").value = product.notas?.coracao ?? "";
        $("#product-fundo").value = product.notas?.fundo ?? "";

        $("#form-title").textContent = "Editar Produto";
        this.dom.form.querySelector("button[type='submit']").innerHTML = `<i class="fas fa-save"></i> Salvar alterações`;
        this.dom.form.querySelector("button[type='reset']").innerHTML = `<i class="fas fa-xmark"></i> Cancelar edição`;

        this.updateImagePreview();
        this.switchSection("add-product", { keepForm: true });
    }

    resetForm() {
        this.editingId = null;
        this.dom.form.reset();
        $("#product-id").value = "";
        $("#form-title").textContent = "Novo Produto";
        this.dom.form.querySelector("button[type='submit']").innerHTML = `<i class="fas fa-save"></i> Salvar Produto`;
        this.dom.form.querySelector("button[type='reset']").innerHTML = `<i class="fas fa-redo"></i> Limpar`;
        this.dom.preview.hidden = true;
    }

    /* ---------- Ações sobre produtos ---------- */
    async toggleHighlight(id) {
        const product = this.findProduct(id);
        if (!product) return;
        const next = !product.destaque;
        await this.mutate(
            () => this.repo.update(id, { destaque: next }),
            next ? `"${product.nome}" agora é destaque.` : `"${product.nome}" saiu dos destaques.`
        );
    }

    async deleteProduct(id) {
        const product = this.findProduct(id);
        if (!product) return;

        const ok = await this.confirm({
            title: "Excluir produto",
            message: `Excluir "${product.nome}" definitivamente? Ele deixará de aparecer na vitrine.`,
            confirmLabel: "Excluir"
        });
        if (ok) await this.mutate(() => this.repo.remove(id), "Produto excluído.");
    }

    async clearAllProducts() {
        if (!this.products.length) {
            this.toast("info", "Não há produtos para remover.");
            return;
        }
        const ok = await this.confirm({
            title: "Limpar todos os produtos",
            message: `Isso excluirá os ${this.products.length} produtos do catálogo e não pode ser desfeito. Recomendamos exportar um backup antes.`,
            confirmLabel: "Excluir tudo",
            requireText: "APAGAR"
        });
        if (ok) {
            const ids = this.products.map((p) => p.id);
            await this.mutate(() => this.repo.removeMany(ids), "Catálogo limpo.");
        }
    }

    async seedCatalog() {
        const ok = await this.confirm({
            title: "Importar catálogo inicial",
            message: `Serão adicionados ${SEED_CATALOG.length} perfumes de exemplo (os mesmos da vitrine atual). Depois você pode editar ou excluir cada um.`,
            confirmLabel: "Importar",
            danger: false
        });
        if (ok) await this.mutate(() => this.repo.createMany(SEED_CATALOG), "Catálogo inicial importado.");
    }

    /* ---------- Configurações ---------- */
    async testConnection() {
        try {
            const { ms } = await this.repo.ping();
            this.toast("success", this.mode === "firebase"
                ? `Firebase conectado (${ms} ms).`
                : "Modo demonstração: armazenamento local funcionando.");
        } catch (error) {
            console.error(error);
            this.toast("error", `Falha na conexão: ${friendlyError(error)}`);
        }
    }

    exportData() {
        if (!this.products.length) {
            this.toast("info", "Não há produtos para exportar.");
            return;
        }
        const products = this.products.map(({ nome, marca, desc, img, destaque, notas }) =>
            ({ nome, marca, desc, img, destaque: Boolean(destaque), notas }));
        const payload = { version: 1, exportedAt: new Date().toISOString(), products };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `sc-perfumes-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        this.toast("success", `${products.length} produtos exportados.`);
    }

    async importData(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = ""; // permite reimportar o mesmo arquivo
        if (!file) return;

        let items;
        try {
            const json = JSON.parse(await file.text());
            items = Array.isArray(json) ? json : json.products;
            if (!Array.isArray(items)) throw new Error("formato inválido");
        } catch {
            this.toast("error", "Arquivo inválido. Use um JSON exportado por este painel.");
            return;
        }

        const valid = items.map((item) => sanitizeProduct(item, this.brands)).filter(Boolean);
        const skipped = items.length - valid.length;
        if (!valid.length) {
            this.toast("error", "Nenhum produto válido encontrado no arquivo.");
            return;
        }

        const ok = await this.confirm({
            title: "Importar produtos",
            message: `${valid.length} produtos serão adicionados ao catálogo atual.` +
                (skipped ? ` ${skipped} itens inválidos serão ignorados.` : ""),
            confirmLabel: "Importar",
            danger: false
        });
        if (ok) await this.mutate(() => this.repo.createMany(valid), `${valid.length} produtos importados.`);
    }

    /* ---------- Confirmação (modal nativo) ---------- */
    confirm({ title, message, confirmLabel = "Confirmar", danger = true, requireText = null }) {
        return new Promise((resolve) => {
            this.#settle(false); // resolve qualquer confirmação pendente
            this.#confirmResolver = resolve;

            const button = $("#confirm-btn");
            $("#confirm-title").textContent = title;
            $("#confirm-message").textContent = message;
            button.textContent = confirmLabel;
            button.classList.toggle("btn-danger", danger);
            button.classList.toggle("btn-primary", !danger);
            button.disabled = false;

            $("#confirm-input-wrap")?.remove();
            if (requireText) {
                const wrap = document.createElement("div");
                wrap.id = "confirm-input-wrap";
                wrap.className = "form-group";
                wrap.innerHTML = `<label for="confirm-input">Digite <strong>${escapeHtml(requireText)}</strong> para confirmar</label>
                                  <input type="text" id="confirm-input" autocomplete="off">`;
                $("#confirm-message").after(wrap);
                button.disabled = true;
                $("#confirm-input", wrap).addEventListener("input", (e) => {
                    button.disabled = e.target.value.trim() !== requireText;
                });
            }

            this.dom.confirmModal.showModal();
        });
    }

    confirmAction() { this.#settle(true); }
    cancelConfirm() { this.#settle(false); }

    #settle(result) {
        if (!this.#confirmResolver) return;
        const resolve = this.#confirmResolver;
        this.#confirmResolver = null;
        if (this.dom.confirmModal.open) this.dom.confirmModal.close();
        resolve(result);
    }

    /* ---------- Feedback visual ---------- */
    toast(type, message) {
        const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
        const el = document.createElement("div");
        el.className = `toast toast-${type}`;
        el.setAttribute("role", type === "error" ? "alert" : "status");
        el.innerHTML = `
            <i class="fas ${icons[type] || icons.info}" aria-hidden="true"></i>
            <span>${escapeHtml(message)}</span>
            <button type="button" aria-label="Fechar aviso"><i class="fas fa-xmark" aria-hidden="true"></i></button>`;

        const dismiss = () => {
            el.classList.add("leaving");
            setTimeout(() => el.remove(), 250);
        };
        $("button", el).addEventListener("click", dismiss);
        this.dom.toasts.appendChild(el);
        setTimeout(dismiss, type === "error" ? 7000 : 4000);
    }

    setLoading(button, loading, label, isHtml = false) {
        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
        if (isHtml) button.innerHTML = label;
        else button.textContent = label;
    }
}

/** Expõe a instância para os atributos onclick do admin.html */
window.adminApp = new AdminApp();