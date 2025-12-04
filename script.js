import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY");
let app, auth, db;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const LOCAL_USER_KEY = "lifeplan_user";
const LOCAL_STATE_PREFIX = "lifeplan_state_";

const selectors = (id) => document.getElementById(id);
const formatCurrency = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const randomColor = (idx) => ["#7c5dff", "#24e2b8", "#ffb347", "#4ad991", "#ff6b6b", "#65c3ff"][idx % 6];

const demoState = {
  profile: {
    income: 5500,
    expenses: 2600,
    mainGoalName: "Reserva de Emergência",
    mainGoalTarget: 15000,
    mainGoalDeadline: "2025-12-20",
    primaryGoalId: "goal-reserva"
  },
  institutions: [
    { id: "inst-nubank", name: "Nubank", type: "Banco Digital", yield: "115% do CDI", liquidity: "D+0", risk: 2 },
    { id: "inst-xp", name: "XP Investimentos", type: "Corretora", yield: "Tesouro / FIIs", liquidity: "D+1", risk: 3 }
  ],
  goals: [
    { id: "goal-moto", name: "Moto", target: 20000, due: "2026-02-01", priority: "alta" },
    { id: "goal-reserva", name: "Reserva de Emergência", target: 15000, due: "2025-12-20", priority: "alta" }
  ],
  entries: [
    { id: "e1", amount: 700, date: "2024-05-15", institutionId: "inst-nubank", goalId: "goal-moto", assetClass: "Caixa", description: "Caixinha Moto" },
    { id: "e2", amount: 1200, date: "2024-06-02", institutionId: "inst-xp", goalId: "goal-reserva", assetClass: "Renda Fixa", description: "Tesouro Selic" },
    { id: "e3", amount: 450, date: "2024-06-15", institutionId: "inst-xp", goalId: "goal-reserva", assetClass: "Renda Fixa", description: "Aporte extra" },
    { id: "e4", amount: 380, date: "2024-07-01", institutionId: "inst-nubank", goalId: "goal-moto", assetClass: "Caixa", description: "Caixinha" }
  ],
  user: { uid: "demo", name: "Convidado", email: "demo@lifeplan.app" }
};

let state = { ...demoState };
let authMode = "login";
let currentUser = null;

const authModal = selectors("authModal");

function saveState() {
  if (firebaseEnabled && currentUser?.uid && db) {
    const ref = doc(db, "users", currentUser.uid);
    return setDoc(ref, state, { merge: true });
  }
  if (currentUser?.email) {
    localStorage.setItem(LOCAL_STATE_PREFIX + currentUser.email, JSON.stringify(state));
  }
}

async function loadState(user) {
  if (firebaseEnabled && user?.uid && db) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    state = snap.exists() ? snap.data() : { ...demoState, user: { uid: user.uid, name: user.displayName || "Planner", email: user.email } };
    return;
  }
  const raw = localStorage.getItem(LOCAL_STATE_PREFIX + user.email);
  state = raw ? JSON.parse(raw) : { ...demoState, user };
}

function setLocalUser(user) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  currentUser = user;
}

async function handleRegister(email, password, name) {
  if (firebaseEnabled) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    return cred.user;
  }
  const localUser = { uid: crypto.randomUUID(), email, name: name || "Planner" };
  setLocalUser(localUser);
  return localUser;
}

async function handleLogin(email, password) {
  if (firebaseEnabled) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }
  const localUser = JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || "null");
  if (localUser && localUser.email === email) {
    currentUser = localUser;
    return localUser;
  }
  throw new Error("Usuário local não encontrado. Cadastre-se primeiro.");
}

async function handleLogout() {
  if (firebaseEnabled && auth) await signOut(auth);
  localStorage.removeItem(LOCAL_USER_KEY);
  currentUser = null;
  authModal.classList.remove("hidden");
}

function switchSection(section) {
  document.querySelectorAll(".section").forEach((el) => el.classList.remove("visible"));
  const target = selectors(section);
  if (target) target.classList.add("visible");
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.section === section));
}

function getTier(total) {
  if (total < 5000) return { title: "Faixa 1 • Liquidez Máxima", subtitle: "Foque em liquidez e promoções.", bullets: ["Produtos >110% do CDI", "Caixinhas e carteiras D+0", "Formar reserva de emergência inicial"] };
  if (total < 15000) return { title: "Faixa 2 • Base sólida", subtitle: "Construa fundamentos em renda fixa premium.", bullets: ["Tesouro Selic como pilar", "Fundos/LCI com liquidez", "Evite riscos desnecessários"] };
  if (total < 30000) return { title: "Faixa 3 • Diversificação", subtitle: "Inclua FIIs e ETFs internacionais.", bullets: ["10-20% em FIIs", "Exposição ao exterior via ETFs", "Mantenha colchão de liquidez"] };
  if (total < 60000) return { title: "Faixa 4 • Crescimento", subtitle: "Acelere com peso em FIIs + ETFs.", bullets: ["Aumente aportes mensais", "Rebalanceie trimestralmente", "Defina metas claras por bucket"] };
  return { title: "Faixa 5 • Máquina financeira", subtitle: "Foque em renda passiva e proteção.", bullets: ["Proteção cambial", "FIIs maduros + renda fixa longa", "Planeje sucessão e seguros"] };
}

function computeTotals() {
  const entries = state.entries || [];
  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const byClass = entries.reduce((acc, e) => {
    acc[e.assetClass] = (acc[e.assetClass] || 0) + Number(e.amount || 0);
    return acc;
  }, {});
  const byInstitution = entries.reduce((acc, e) => {
    acc[e.institutionId] = (acc[e.institutionId] || 0) + Number(e.amount || 0);
    return acc;
  }, {});
  const goalsProgress = new Map();
  entries.forEach((e) => {
    if (e.goalId) goalsProgress.set(e.goalId, (goalsProgress.get(e.goalId) || 0) + Number(e.amount || 0));
  });
  return { total, byClass, byInstitution, goalsProgress };
}

function renderHeader(total) {
  selectors("totalBalance").textContent = formatCurrency(total);
  selectors("cardTotal").textContent = formatCurrency(total);
  selectors("sidebarUserName").textContent = currentUser?.name || "Convidado";
  selectors("sidebarUserEmail").textContent = currentUser?.email || "demo@lifeplan.app";
  selectors("userGreeting").textContent = `Olá, ${currentUser?.name || "Planner"}`;
}

function renderTier(total) {
  const tier = getTier(total);
  selectors("tierTitle").textContent = tier.title;
  selectors("tierSubtitle").textContent = tier.subtitle;
  selectors("tierList").innerHTML = tier.bullets.map((b) => `<li>${b}</li>`).join("");
}

function renderLegend(containerId, dataMap, nameResolver) {
  const container = selectors(containerId);
  container.innerHTML = Object.entries(dataMap)
    .map(([key, value], idx) => {
      const label = nameResolver(key);
      return `<div class="legend-item"><span class="legend-dot" style="background:${randomColor(idx)}"></span><div><div>${label}</div><small class="muted">${formatCurrency(value)}</small></div></div>`;
    })
    .join("") || `<p class="muted">Cadastre lançamentos para ver a distribuição.</p>`;
}

function renderPie(containerId, dataMap) {
  const container = selectors(containerId);
  const total = Object.values(dataMap).reduce((sum, v) => sum + v, 0);
  if (!total) {
    container.style.background = "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), transparent 55%), conic-gradient(#2a2d3e 0 100%)";
    return;
  }
  let start = 0;
  const slices = Object.values(dataMap).map((v) => Math.round((v / total) * 360));
  let gradient = "";
  slices.forEach((slice, idx) => {
    const end = start + slice;
    gradient += `${randomColor(idx)} ${start}deg ${end}deg,`;
    start = end;
  });
  gradient = gradient.slice(0, -1);
  container.style.background = `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), transparent 55%), conic-gradient(${gradient})`;
}

function renderSparkline(entries) {
  const svgHost = selectors("sparkline");
  if (!entries.length) {
    svgHost.innerHTML = `<p class="muted">Sem histórico ainda.</p>`;
    return;
  }
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  let cumulative = 0;
  const points = sorted.map((e, idx) => {
    cumulative += Number(e.amount || 0);
    return { x: idx, y: cumulative };
  });
  const maxY = Math.max(...points.map((p) => p.y));
  const width = 300;
  const height = 140;
  const stepX = width / (points.length - 1 || 1);
  const poly = points
    .map((p, idx) => {
      const x = idx * stepX;
      const y = height - (p.y / maxY) * height;
      return `${x},${y}`;
    })
    .join(" ");
  svgHost.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5dff" stop-opacity="0.9"/><stop offset="100%" stop-color="#24e2b8" stop-opacity="0.7"/></linearGradient></defs><polyline fill="none" stroke="url(#spark)" stroke-width="3" points="${poly}" stroke-linecap="round"/><path d="M0 ${height} ${poly.replace(/ /g, " L")} ${width} ${height} Z" fill="url(#spark)" fill-opacity="0.12"/></svg>`;
}

function renderGoals(goalsProgress) {
  const goals = state.goals || [];
  const container = selectors("goalsList");
  const full = selectors("goalsFullList");
  if (!goals.length) {
    container.innerHTML = `<p class="muted">Adicione suas metas para acompanhar o progresso.</p>`;
    full.innerHTML = container.innerHTML;
    return;
  }
  const renderGoal = (g) => {
    const reached = goalsProgress.get(g.id) || 0;
    const pct = Math.min(100, Math.round((reached / g.target) * 100));
    return `<div class="list-item"><div class="list-meta"><strong>${g.name}</strong><span class="muted">Meta ${formatCurrency(g.target)} • Prioridade ${g.priority}</span><div class="progress"><span style="width:${pct}%"></span></div></div><div class="pill">${pct}%</div></div>`;
  };
  container.innerHTML = goals.slice(0, 3).map(renderGoal).join("");
  full.innerHTML = goals.map(renderGoal).join("");
}

function renderInstitutions(byInstitution) {
  const container = selectors("institutionsList");
  const institutions = state.institutions || [];
  if (!institutions.length) {
    container.innerHTML = `<p class="muted">Cadastre instituições para organizar seus aportes.</p>`;
    return;
  }
  container.innerHTML = institutions
    .map((inst) => {
      const value = byInstitution[inst.id] || 0;
      return `<div class="list-item"><div class="list-meta"><strong>${inst.name}</strong><span class="muted">${inst.type} • ${inst.yield || "—"} • Liquidez ${inst.liquidity || ""}</span></div><div class="pill">${formatCurrency(value)}</div></div>`;
    })
    .join("");
}

function renderEntries() {
  const container = selectors("entriesList");
  const recent = selectors("recentEntries");
  const entries = [...(state.entries || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!entries.length) {
    container.innerHTML = `<p class="muted">Nenhum lançamento ainda.</p>`;
    recent.innerHTML = container.innerHTML;
    return;
  }
  const renderItem = (e) => {
    const inst = state.institutions.find((i) => i.id === e.institutionId);
    const goal = state.goals.find((g) => g.id === e.goalId);
    return `<div class="list-item"><div class="list-meta"><strong>${formatCurrency(Number(e.amount || 0))}</strong><span class="muted">${e.description || "Lançamento"}</span><small class="muted">${new Date(e.date).toLocaleDateString("pt-BR")} • ${inst?.name || "Instituição"} • ${e.assetClass}</small></div><div class="pill">${goal ? goal.name : "Sem meta"}</div></div>`;
  };
  container.innerHTML = entries.map(renderItem).join("");
  recent.innerHTML = entries.slice(0, 5).map(renderItem).join("");
}

function renderClassAndInstitution(byClass, byInstitution) {
  renderPie("classPie", byClass);
  renderLegend("classLegend", byClass, (key) => key);
  renderPie("institutionPie", byInstitution);
  renderLegend("institutionLegend", byInstitution, (key) => state.institutions.find((i) => i.id === key)?.name || "Instituição");
}

function populateSelects() {
  const instSelect = selectors("entryInstitution");
  const goalSelect = selectors("entryGoal");
  const primaryGoalSelect = selectors("primaryGoalSelect");
  instSelect.innerHTML = (state.institutions || []).map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
  goalSelect.innerHTML = `<option value="">Sem meta</option>` + (state.goals || []).map((g) => `<option value="${g.id}">${g.name}</option>`).join("");
  primaryGoalSelect.innerHTML = `<option value="">Selecionar meta existente</option>` + (state.goals || []).map((g) => `<option value="${g.id}">${g.name}</option>`).join("");
  if (state.profile.primaryGoalId) primaryGoalSelect.value = state.profile.primaryGoalId;
}

function hydrateProfileForm() {
  const form = selectors("profileForm");
  form.income.value = state.profile.income || "";
  form.expenses.value = state.profile.expenses || "";
  form.mainGoalName.value = state.profile.mainGoalName || "";
  form.mainGoalTarget.value = state.profile.mainGoalTarget || "";
  form.mainGoalDeadline.value = state.profile.mainGoalDeadline || "";
}

function renderApp() {
  const totals = computeTotals();
  renderHeader(totals.total);
  renderTier(totals.total);
  renderClassAndInstitution(totals.byClass, totals.byInstitution);
  renderSparkline(state.entries || []);
  renderGoals(totals.goalsProgress);
  renderInstitutions(totals.byInstitution);
  renderEntries();
  populateSelects();
  hydrateProfileForm();
  saveState();
}

function setupNav() {
  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => switchSection(btn.dataset.section));
  });
}

function setupForms() {
  selectors("profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    state.profile = {
      income: Number(data.get("income")),
      expenses: Number(data.get("expenses")),
      mainGoalName: data.get("mainGoalName"),
      mainGoalTarget: Number(data.get("mainGoalTarget")) || 0,
      mainGoalDeadline: data.get("mainGoalDeadline"),
      primaryGoalId: data.get("primaryGoalId") || ""
    };
    renderApp();
  });

  selectors("institutionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    state.institutions = [
      ...(state.institutions || []),
      {
        id: crypto.randomUUID(),
        name: data.get("name"),
        type: data.get("type"),
        yield: data.get("yield"),
        liquidity: data.get("liquidity"),
        risk: Number(data.get("risk"))
      }
    ];
    e.target.reset();
    renderApp();
  });

  selectors("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    state.goals = [
      ...(state.goals || []),
      {
        id: crypto.randomUUID(),
        name: data.get("name"),
        target: Number(data.get("target")),
        due: data.get("due"),
        priority: data.get("priority")
      }
    ];
    e.target.reset();
    renderApp();
  });

  selectors("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    state.entries = [
      ...(state.entries || []),
      {
        id: crypto.randomUUID(),
        amount: Number(data.get("amount")),
        date: data.get("date"),
        institutionId: data.get("institutionId"),
        goalId: data.get("goalId") || "",
        assetClass: data.get("assetClass"),
        description: data.get("description")
      }
    ];
    e.target.reset();
    renderApp();
  });
}

function setupAuth() {
  const toggle = selectors("toggleAuth");
  const form = selectors("authForm");
  const title = selectors("authTitle");
  const subtitle = selectors("authSubtitle");
  const submit = selectors("authSubmit");

  const updateMode = () => {
    if (authMode === "login") {
      title.textContent = "Login";
      subtitle.textContent = "Acesse sua conta";
      submit.textContent = "Entrar";
      form.name.parentElement.classList.add("hidden");
      toggle.textContent = "Criar conta";
    } else {
      title.textContent = "Criar conta";
      subtitle.textContent = "Comece agora";
      submit.textContent = "Registrar";
      form.name.parentElement.classList.remove("hidden");
      toggle.textContent = "Já tenho conta";
    }
  };

  toggle.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    updateMode();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const email = data.get("email");
    const password = data.get("password");
    const name = data.get("name");
    try {
      let user;
      if (authMode === "login") {
        user = await handleLogin(email, password);
      } else {
        user = await handleRegister(email, password, name);
      }
      currentUser = { uid: user.uid, email: user.email, name: user.displayName || user.name || name || "Planner" };
      setLocalUser(currentUser);
      await loadState(currentUser);
      renderApp();
      authModal.classList.add("hidden");
    } catch (err) {
      alert(err.message);
    }
  });

  selectors("logoutBtn").addEventListener("click", handleLogout);
  updateMode();
}

async function bootstrap() {
  setupNav();
  setupForms();
  setupAuth();

  if (firebaseEnabled && auth) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = { uid: user.uid, email: user.email, name: user.displayName || user.email };
        await loadState(currentUser);
        renderApp();
        authModal.classList.add("hidden");
      } else {
        authModal.classList.remove("hidden");
      }
    });
  } else {
    const localUser = JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || "null");
    if (localUser) {
      currentUser = localUser;
      await loadState(currentUser);
      renderApp();
      authModal.classList.add("hidden");
    } else {
      renderApp();
    }
  }
}

bootstrap();
