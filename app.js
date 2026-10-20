const STORAGE_KEY = "mis-gastos-data-v1";
const CHART_STORAGE_KEY = "mis-gastos-chart-v1";
const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });

const colors = ["#0F766E", "#D97757", "#D5A11E", "#5477A3", "#9964A6", "#DC6D86", "#4A9B70"];
const icons = ["🛒", "🏠", "🚌", "🍜", "🎬", "🩺", "🐾", "🧾"];

function defaultData() {
  return {
    categories: [
      { id: crypto.randomUUID(), name: "Supermercado", budget: 220000, color: "#0F766E" },
      { id: crypto.randomUUID(), name: "Cuentas", budget: 180000, color: "#5477A3" },
      { id: crypto.randomUUID(), name: "Transporte", budget: 90000, color: "#D5A11E" },
      { id: crypto.randomUUID(), name: "Salir a Comer", budget: 80000, color: "#D97757" }
    ],
    transactions: []
  };
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.transactions)) {
      const legacyDefaultNames = ["Alimentación", "Hogar", "Transporte"];
      const savedNames = saved.categories.map((category) => category.name).sort();
      if (!saved.transactions.length && savedNames.join("|") === legacyDefaultNames.sort().join("|")) return defaultData();
      return saved;
    }
  } catch (_) { /* Datos locales inválidos: se reconstruyen. */ }
  return defaultData();
}

let data = loadData();
let selectedColor = "#0F766E";
let toastTimer;
let chartType = localStorage.getItem(CHART_STORAGE_KEY) || "ring";

const el = (id) => document.getElementById(id);
const localDateValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const currentMonthKey = () => localDateValue().slice(0, 7);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const parseAmount = (value) => Number(String(value).replace(/[^0-9]/g, "")) || 0;
const formatAmountInput = (input) => {
  const amount = parseAmount(input.value);
  input.value = amount ? new Intl.NumberFormat("es-CL").format(amount) : "";
};

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function getCurrentTransactions() { return data.transactions.filter((transaction) => transaction.date.slice(0, 7) === currentMonthKey()); }
function expensesFor(categoryId) { return getCurrentTransactions().filter((transaction) => transaction.categoryId === categoryId).reduce((sum, transaction) => sum + transaction.amount, 0); }
function categoryById(id) { return data.categories.find((category) => category.id === id); }

function showToast(message, warning = false) {
  const toast = el("toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("warning", warning);
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
}

function renderHeader() {
  const today = new Date();
  el("currentDate").textContent = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(today);
  el("sidebarMonth").textContent = monthFormatter.format(today);
  el("monthName").textContent = new Intl.DateTimeFormat("es-CL", { month: "long" }).format(today).toUpperCase();
}

function renderSummary() {
  const transactions = getCurrentTransactions();
  const spent = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const budget = data.categories.reduce((sum, category) => sum + category.budget, 0);
  const available = budget - spent;
  const exceeded = data.categories.filter((category) => category.budget > 0 && expensesFor(category.id) > category.budget);
  const percentage = budget ? clamp((spent / budget) * 100, 0, 100) : 0;

  el("heroTitle").textContent = currency.format(spent);
  el("spentTotal").textContent = currency.format(spent);
  el("spentCount").textContent = `${transactions.length} ${transactions.length === 1 ? "movimiento" : "movimientos"}`;
  el("availableTotal").textContent = currency.format(Math.max(available, 0));
  el("availableNote").textContent = budget ? (available >= 0 ? `de ${currency.format(budget)} presupuestados` : `Excedido por ${currency.format(Math.abs(available))}`) : "Sin presupuestos definidos";
  el("alertTotal").textContent = exceeded.length;
  el("alertNote").textContent = exceeded.length ? `${exceeded.length === 1 ? "Una categoría superó" : "Categorías superaron"} su límite` : "Todo bajo control";
  el("totalBudgetLabel").textContent = currency.format(budget);
  renderChart(percentage, spent);
  el("budgetHeadline").textContent = !budget ? "Define presupuestos para medir tus gastos." : available >= 0 ? `Te quedan ${currency.format(available)} de tu presupuesto mensual.` : `Vas ${currency.format(Math.abs(available))} sobre tu presupuesto mensual.`;
}

function renderChart(percentage, spent) {
  const chart = el("totalRing");
  const label = `${Math.round(percentage)}%`;
  chart.className = "ring";
  chart.innerHTML = `<span>${label}</span>`;
  if (chartType === "bars") {
    const maxSpent = Math.max(...data.categories.map((category) => expensesFor(category.id)), 1);
    chart.classList.add("chart-bars");
    chart.innerHTML = `${data.categories.slice(0, 5).map((category) => `<i class="chart-bar" style="height:${Math.max(5, Math.round((expensesFor(category.id) / maxSpent) * 60))}px;--bar-color:${category.color}"></i>`).join("")}<span>${label}</span>`;
  } else if (chartType === "pie") {
    let angle = 0;
    const slices = data.categories.map((category) => {
      const next = spent ? angle + (expensesFor(category.id) / spent) * 360 : angle;
      const slice = `${category.color} ${angle}deg ${next}deg`;
      angle = next;
      return slice;
    });
    chart.classList.add("chart-pie");
    chart.style.background = `conic-gradient(${slices.join(",") || "rgba(255,255,255,.15) 0deg 360deg"}, rgba(255,255,255,.15) ${angle}deg 360deg)`;
  } else {
    chart.style.background = `conic-gradient(var(--yellow) ${percentage * 3.6}deg, rgba(255,255,255,.15) 0deg)`;
  }
  document.querySelectorAll("[data-chart-type]").forEach((button) => button.classList.toggle("active", button.dataset.chartType === chartType));
}

function renderCategories() {
  const container = el("categoryList");
  const emptyButton = el("emptyCategoryButton");
  container.innerHTML = "";
  emptyButton.style.display = data.categories.length ? "none" : "block";

  data.categories.forEach((category) => {
    const spent = expensesFor(category.id);
    const ratio = category.budget ? (spent / category.budget) * 100 : 0;
    const remaining = category.budget - spent;
    const row = document.createElement("div");
    row.className = "category-row";
    row.style.setProperty("--category-color", category.color);
    row.innerHTML = `
      <div class="category-info">
        <span class="category-name"><i class="category-dot"></i>${escapeHtml(category.name)}</span>
        <span class="category-values"><strong>${currency.format(spent)}</strong> / ${currency.format(category.budget)}</span>
      </div>
      <div class="progress"><span style="width:${clamp(ratio, 0, 100)}%"></span></div>
      <div class="category-info">
        <span class="category-status ${remaining < 0 ? "over" : ""}">${remaining < 0 ? `Excedido por ${currency.format(Math.abs(remaining))}` : `Quedan ${currency.format(remaining)}`}</span>
        <button class="category-actions" title="Eliminar categoría" aria-label="Eliminar ${escapeHtml(category.name)}" data-delete-category="${category.id}">×</button>
      </div>`;
    container.appendChild(row);
  });
}

function renderCategoryCards() {
  const container = el("categoryCards");
  container.innerHTML = "";

  data.categories.forEach((category) => {
    const spent = expensesFor(category.id);
    const ratio = category.budget ? (spent / category.budget) * 100 : 0;
    const remaining = category.budget - spent;
    const card = document.createElement("article");
    card.className = "category-card";
    card.style.setProperty("--category-color", category.color);
    card.innerHTML = `
      <div class="category-card-top">
        <span class="category-card-name"><i class="category-dot"></i>${escapeHtml(category.name)}</span>
        <button class="category-delete" type="button" data-delete-category="${category.id}">Eliminar</button>
      </div>
      <p class="category-card-spent">Gastado este mes<strong>${currency.format(spent)}</strong></p>
      <div class="progress"><span style="width:${clamp(ratio, 0, 100)}%"></span></div>
      <div class="category-card-footer">
        <span>Presupuesto: ${currency.format(category.budget)}</span>
        <span class="${remaining < 0 ? "over" : ""}">${remaining < 0 ? `Excedido ${currency.format(Math.abs(remaining))}` : `Quedan ${currency.format(remaining)}`}</span>
      </div>`;
    container.appendChild(card);
  });
}

function renderBudgetRows() {
  const container = el("budgetRows");
  container.innerHTML = "";
  data.categories.forEach((category) => {
    const spent = expensesFor(category.id);
    const row = document.createElement("label");
    row.className = "budget-row";
    row.style.setProperty("--category-color", category.color);
    row.innerHTML = `
      <span class="budget-row-name"><i class="category-dot"></i><span>${escapeHtml(category.name)}<small>Gastado este mes: ${currency.format(spent)}</small></span></span>
      <span class="currency-input"><span>$</span><input type="text" inputmode="numeric" value="${new Intl.NumberFormat("es-CL").format(category.budget)}" data-budget-category="${category.id}" aria-label="Presupuesto para ${escapeHtml(category.name)}" /></span>`;
    container.appendChild(row);
  });
}

function renderTransactions(showAll = false) {
  const container = el("transactionList");
  const empty = el("emptyTransactions");
  const button = el("showAllTransactions");
  const transactions = [...getCurrentTransactions()].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const visible = showAll ? transactions : transactions.slice(0, 5);
  container.innerHTML = "";
  empty.style.display = transactions.length ? "none" : "block";
  button.style.display = transactions.length > 5 ? "block" : "none";
  button.textContent = showAll ? "Ver menos" : "Ver todos";
  button.dataset.showAll = showAll;

  visible.forEach((transaction, index) => {
    const category = categoryById(transaction.categoryId);
    if (!category) return;
    const item = document.createElement("div");
    item.className = "transaction";
    const transactionDate = new Date(`${transaction.date}T12:00:00`);
    item.innerHTML = `
      <div class="transaction-icon" style="background:${category.color}20;color:${category.color}">${icons[index % icons.length]}</div>
      <div><p class="transaction-title">${escapeHtml(category.name)}</p><p class="transaction-meta">${dateFormatter.format(transactionDate)}</p></div>
      <div><div class="transaction-amount">−${currency.format(transaction.amount)}</div><button type="button" class="delete-transaction" data-delete-transaction="${transaction.id}">Eliminar</button></div>`;
    container.appendChild(item);
  });
}

function renderCategoryOptions() {
  const select = el("expenseCategory");
  const selected = select.value;
  select.innerHTML = data.categories.length ? data.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("") : '<option value="">Primero crea una categoría</option>';
  select.value = data.categories.some((category) => category.id === selected) ? selected : (data.categories[0]?.id || "");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function render() {
  renderHeader();
  renderSummary();
  renderCategories();
  renderCategoryCards();
  renderBudgetRows();
  renderTransactions(el("showAllTransactions").dataset.showAll === "true");
  renderCategoryOptions();
}

function openModal(id) {
  if (id === "expenseModal" && !data.categories.length) {
    showToast("Crea una categoría antes de registrar un gasto.", true);
    openModal("categoryModal");
    return;
  }
  el(id).hidden = false;
  document.body.style.overflow = "hidden";
  const firstInput = el(id).querySelector("input:not([type=hidden])");
  setTimeout(() => firstInput?.focus(), 80);
}
function closeModals() { document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.hidden = true); document.body.style.overflow = ""; }

function initialiseControls() {
  el("expenseDate").value = localDateValue();
  const picker = el("colorPicker");
  colors.forEach((color) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "color-choice";
    choice.style.setProperty("--choice", color);
    choice.dataset.color = color;
    choice.setAttribute("aria-label", `Elegir color ${color}`);
    picker.appendChild(choice);
  });
  setColor(selectedColor);
}
function setColor(color) {
  selectedColor = color;
  el("categoryColor").value = color;
  document.querySelectorAll(".color-choice").forEach((choice) => choice.classList.toggle("selected", choice.dataset.color === color));
}

document.addEventListener("click", (event) => {
  if (event.target.closest("#chartTrigger")) {
    const picker = el("chartPicker");
    picker.hidden = !picker.hidden;
    el("chartTrigger").setAttribute("aria-expanded", String(!picker.hidden));
    return;
  }
  const chartOption = event.target.closest("[data-chart-type]");
  if (chartOption) {
    chartType = chartOption.dataset.chartType;
    localStorage.setItem(CHART_STORAGE_KEY, chartType);
    el("chartPicker").hidden = true;
    el("chartTrigger").setAttribute("aria-expanded", "false");
    render();
    return;
  }
  if (!event.target.closest(".chart-control")) { el("chartPicker").hidden = true; el("chartTrigger").setAttribute("aria-expanded", "false"); }
  const opener = event.target.closest("[data-open-modal]");
  if (opener) openModal(opener.dataset.openModal);
  if (event.target.matches("[data-close-modal]") || event.target.classList.contains("modal-backdrop")) closeModals();
  const colorChoice = event.target.closest(".color-choice");
  if (colorChoice) setColor(colorChoice.dataset.color);
  const deleteTransaction = event.target.closest("[data-delete-transaction]");
  if (deleteTransaction) {
    data.transactions = data.transactions.filter((transaction) => transaction.id !== deleteTransaction.dataset.deleteTransaction);
    saveData(); render(); showToast("Gasto eliminado.");
  }
  const deleteCategory = event.target.closest("[data-delete-category]");
  if (deleteCategory) {
    const category = categoryById(deleteCategory.dataset.deleteCategory);
    const isUsed = data.transactions.some((transaction) => transaction.categoryId === category.id);
    if (isUsed) { showToast("No puedes eliminar una categoría con gastos registrados.", true); return; }
    data.categories = data.categories.filter((item) => item.id !== category.id);
    saveData(); render(); showToast("Categoría eliminada.");
  }
  if (event.target.id === "showAllTransactions") renderTransactions(event.target.dataset.showAll !== "true");
  if (event.target.id === "resetData") {
    if (confirm("¿Reiniciar categorías y gastos guardados en este dispositivo?")) { data = defaultData(); saveData(); render(); showToast("Datos reiniciados."); }
  }
});

document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModals(); });
document.addEventListener("input", (event) => {
  if (event.target.matches("input[inputmode=numeric]")) formatAmountInput(event.target);
});
function showView(view) {
  const categoryView = view === "categorias";
  const budgetView = view === "presupuestos";
  el("dashboardView").hidden = categoryView || budgetView;
  el("categorias").hidden = !categoryView;
  el("presupuestos").hidden = !budgetView;
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if (categoryView || budgetView) window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", (event) => {
  const view = link.dataset.view;
  if (view === "categorias" || view === "presupuestos") {
    event.preventDefault();
    history.replaceState(null, "", "#categorias");
    showView(view);
    return;
  }
  showView(view);
}));

el("budgetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelectorAll("[data-budget-category]").forEach((input) => {
    const category = categoryById(input.dataset.budgetCategory);
    if (category) category.budget = parseAmount(input.value);
  });
  saveData();
  render();
  showToast("Presupuestos actualizados.");
});

el("expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseAmount(el("expenseAmount").value);
  const categoryId = el("expenseCategory").value;
  const date = el("expenseDate").value;
  const error = el("expenseError");
  if (!amount || !categoryId || !date) { error.textContent = "Completa todos los campos con un monto mayor a $0."; return; }
  data.transactions.unshift({ id: crypto.randomUUID(), amount, categoryId, date, createdAt: Date.now() });
  const category = categoryById(categoryId);
  const newSpent = expensesFor(categoryId);
  saveData();
  event.target.reset();
  el("expenseDate").value = localDateValue();
  error.textContent = "";
  closeModals(); render();
  showToast(newSpent > category.budget ? `Atención: superaste el presupuesto de ${category.name}.` : "Gasto registrado correctamente.", newSpent > category.budget);
});

el("categoryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = el("categoryName").value.trim();
  const budget = parseAmount(el("categoryBudget").value);
  const error = el("categoryError");
  if (!name || !budget) { error.textContent = "Escribe un nombre y un presupuesto mayor a $0."; return; }
  if (data.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) { error.textContent = "Ya existe una categoría con ese nombre."; return; }
  data.categories.push({ id: crypto.randomUUID(), name, budget, color: selectedColor });
  saveData(); event.target.reset(); setColor(colors[data.categories.length % colors.length]); error.textContent = ""; closeModals(); render(); showToast(`Categoría ${name} creada.`);
});

initialiseControls();
render();
showView(window.location.hash === "#categorias" ? "categorias" : window.location.hash === "#presupuestos" ? "presupuestos" : "inicio");

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
