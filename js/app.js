import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { auth } from "./firebase-config.js";
import {
  changeCurrentPassword,
  createStaffAuthUser,
  ensureUserProfile,
  friendlyAuthError,
  loginWithUsername,
  logout,
  normalizeUsername
} from "./auth.js";
import {
  addInventoryItem,
  createPorter,
  createRequest,
  createTransit,
  logActivity,
  markBillPaid,
  objectToArray,
  saveUserProfile,
  setUserActive,
  subscribePath,
  updateRequest,
  verifyAccountsBill,
  verifyKpBill,
  verifyTransitArrival
} from "./data.js";
import {
  ITEM_CATEGORIES,
  ROLE_LABELS,
  SITES,
  allowedInventorySites,
  can,
  canCreateRequestForSite,
  canVerifyAtSite
} from "./permissions.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  profile: null,
  users: {},
  inventory: {},
  requests: {},
  transits: {},
  porters: {},
  billing: {},
  unsubs: [],
  currentView: "dashboard"
};

const statusLabels = {
  requested: "Requested",
  replenishing: "Replenishing",
  sent: "Sent",
  received: "Received",
  completed: "Completed",
  in_transit: "In Transit",
  successful_transit: "Successful Transit",
  awaiting_kp_bill_verification: "Waiting KP Verification",
  awaiting_accounts_verification: "Waiting Accounts",
  accounts_verified: "Accounts Verified",
  paid: "Paid"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

function money(value) {
  return "RM " + Number(value || 0).toFixed(2);
}

function dateText(value) {
  if (!value) return "-";
  const d = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-MY", { day:"2-digit", month:"short", year:"numeric" });
}

function statusBadge(status) {
  let cls = "blue";
  if (["completed","successful_transit","paid"].includes(status)) cls = "ok";
  if (["requested","awaiting_kp_bill_verification","awaiting_accounts_verification"].includes(status)) cls = "warn";
  return '<span class="badge ' + cls + '">' + esc(statusLabels[status] || status || "-") + "</span>";
}

function porterName(id) {
  return state.porters[id]?.name || (id ? "Unknown porter" : "-");
}

function toast(message, isError = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast" + (isError ? " error" : "");
  setTimeout(() => el.classList.add("hidden"), 3200);
  el.classList.remove("hidden");
}

function openModal(title, body, eyebrow = "MT-OMS") {
  $("#modalTitle").textContent = title;
  $("#modalEyebrow").textContent = eyebrow;
  $("#modalBody").innerHTML = body;
  $("#formDialog").showModal();
}

function closeModal() {
  $("#formDialog").close();
}

function cleanSubscriptions() {
  state.unsubs.forEach((fn) => { try { fn(); } catch {} });
  state.unsubs = [];
}

function addSub(path, handler) {
  const unsub = subscribePath(path, handler);
  state.unsubs.push(unsub);
}

function siteOptions(selected = "", includeAll = false) {
  let html = includeAll ? '<option value="">All sites</option>' : "";
  for (const site of SITES) html += '<option value="' + site + '"' + (site === selected ? " selected" : "") + ">" + site + "</option>";
  return html;
}

function categoryOptions(selected = "", includeAll = false) {
  let html = includeAll ? '<option value="">All categories</option>' : "";
  ITEM_CATEGORIES.forEach((category) => {
    html += '<option value="' + esc(category) + '"' + (category === selected ? " selected" : "") + ">" + esc(category) + "</option>";
  });
  return html;
}

function setupAccessUI() {
  $$("[data-permission]").forEach((el) => {
    el.classList.toggle("hidden", !can(state.profile, el.dataset.permission));
  });
  if (!can(state.profile, "view_billing")) $('[data-view="billing"]').classList.add("hidden");
  else $('[data-view="billing"]').classList.remove("hidden");

  const sites = allowedInventorySites(state.profile);
  $("#inventorySiteFilter").innerHTML = sites.length > 1 ? '<option value="">All sites</option>' + sites.map((s) => '<option>' + s + '</option>').join("") : sites.map((s) => '<option>' + s + '</option>').join("");
  $("#requestSiteFilter").innerHTML = can(state.profile, "manage_requests") || ["accounts","management","system_admin"].includes(state.profile.role)
    ? '<option value="">All sites</option><option>PH</option><option>KP</option>'
    : '<option>' + esc(state.profile.primarySite) + "</option>";
  $("#inventoryCategoryFilter").innerHTML = categoryOptions("", true);
}

function showView(name) {
  state.currentView = name;
  $$(".view").forEach((v) => v.classList.remove("active"));
  $(".nav-link.active")?.classList.remove("active");
  $("#view-" + name)?.classList.add("active");
  $('[data-view="' + name + '"]')?.classList.add("active");
  const titles = {dashboard:"Dashboard",inventory:"Inventory",requests:"Item Requests",transit:"Transit",porters:"Porters",billing:"Porter Billing",reports:"Reports",users:"User Management",settings:"My Account"};
  $("#pageTitle").textContent = titles[name] || "MT-OMS";
  $(".sidebar").classList.remove("open");
  renderAll();
}

function initNavigation() {
  $("#navMenu").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn && !btn.classList.contains("hidden")) showView(btn.dataset.view);
  });
  $("#menuButton").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
}

function renderHeader() {
  const p = state.profile;
  $("#sidebarUser").innerHTML = "<strong>" + esc(p.displayName || p.username) + "</strong><br>" + esc(p.roleLabel || ROLE_LABELS[p.role] || p.role) + "<br>" + esc(p.primarySite || "");
  $("#topUser").innerHTML = "<strong>" + esc(p.displayName || p.username) + "</strong><span>" + esc(p.primarySite === "ALL" ? "All Sites" : p.primarySite) + " • " + esc(p.department || "") + "</span>";
  $("#welcomeTitle").textContent = "Welcome, " + (p.displayName || p.username);
  $("#welcomeSummary").textContent = (p.roleLabel || ROLE_LABELS[p.role] || p.role) + " • " + (p.primarySite === "ALL" ? "KK, KP & PH access" : p.primarySite + " site");
  $("#todayLabel").textContent = new Date().toLocaleDateString("en-MY", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
}

function allInventoryRows() {
  const rows = [];
  Object.entries(state.inventory || {}).forEach(([site, items]) => {
    objectToArray(items).forEach((item) => rows.push({ ...item, site }));
  });
  return rows;
}

function allRequests() {
  const rows = [];
  Object.entries(state.requests || {}).forEach(([site, records]) => {
    objectToArray(records).forEach((record) => rows.push({ ...record, site }));
  });
  return rows.sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function allBilling() {
  const rows = [];
  Object.entries(state.billing || {}).forEach(([month, records]) => {
    objectToArray(records).forEach((record) => rows.push({ ...record, month }));
  });
  return rows.sort((a,b) => String(b.transitDate || "").localeCompare(String(a.transitDate || "")));
}

function renderDashboard() {
  const inventory = allInventoryRows();
  const requests = allRequests();
  const transits = objectToArray(state.transits);
  const billing = allBilling();
  const low = inventory.filter((x) => Number(x.quantity || 0) <= Number(x.lowStockLevel || 0));
  const pendingReq = requests.filter((x) => !["completed","received"].includes(x.status));
  const inTransit = transits.filter((x) => x.status === "in_transit");
  const pendingBills = billing.filter((x) => x.status !== "paid");

  $("#dashboardStats").innerHTML = [
    ["Inventory Items", inventory.length, low.length + " low stock"],
    ["Pending Requests", pendingReq.length, "PH / KP replenishment"],
    ["In Transit", inTransit.length, "Awaiting destination verification"],
    ["Porter Bills", pendingBills.length, "Not yet paid"]
  ].map((x) => '<article class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><small>' + x[2] + '</small></article>').join("");

  const actions = [];
  low.slice(0,4).forEach((x) => actions.push('<div class="list-item"><div><strong>Low stock: ' + esc(x.name) + '</strong><p>' + x.site + ' • ' + esc(x.category) + '</p></div><span class="badge warn">' + Number(x.quantity || 0) + " " + esc(x.unit || "") + "</span></div>"));
  if (can(state.profile,"manage_requests")) pendingReq.slice(0,4).forEach((x) => actions.push('<div class="list-item"><div><strong>Request: ' + esc(x.itemName) + '</strong><p>' + x.site + ' • ' + esc(statusLabels[x.status] || x.status) + '</p></div><span class="badge blue">' + Number(x.quantity || 0) + " " + esc(x.unit || "") + "</span></div>"));
  if (can(state.profile,"verify_accounts")) billing.filter((x) => x.status === "awaiting_accounts_verification").slice(0,4).forEach((x) => actions.push('<div class="list-item"><div><strong>Accounts verification</strong><p>Bill ' + esc(x.billNo || "-") + " • " + x.month + '</p></div><span class="badge warn">' + money(x.totalAmount) + "</span></div>"));
  $("#pendingActions").innerHTML = actions.length ? actions.slice(0,7).join("") : '<div class="empty-state">No pending actions.</div>';

  const recent = transits.sort((a,b) => Number(b.createdAt || 0)-Number(a.createdAt || 0)).slice(0,6);
  $("#recentTransit").innerHTML = recent.length ? recent.map((x) => '<div class="list-item"><div><strong>' + esc(x.origin) + " → " + esc(x.destination) + '</strong><p>' + esc(x.billNo || "No bill") + " • " + dateText(x.transitDate) + '</p></div>' + statusBadge(x.status) + "</div>").join("") : '<div class="empty-state">No transit records yet.</div>';
}

function renderInventory() {
  if (!state.profile) return;
  const siteFilter = $("#inventorySiteFilter").value;
  const search = $("#inventorySearch").value.trim().toLowerCase();
  const category = $("#inventoryCategoryFilter").value;
  const rows = allInventoryRows().filter((x) => (!siteFilter || x.site === siteFilter) && (!category || x.category === category) && (!search || String(x.name).toLowerCase().includes(search)));
  $("#inventoryTable").innerHTML = rows.length ? rows.sort((a,b) => a.site.localeCompare(b.site) || a.name.localeCompare(b.name)).map((x) => {
    const low = Number(x.quantity || 0) <= Number(x.lowStockLevel || 0);
    return "<tr><td><strong>" + x.site + "</strong></td><td>" + esc(x.name) + "</td><td>" + esc(x.category) + "</td><td>" + Number(x.quantity || 0) + " " + esc(x.unit || "") + "</td><td>" + Number(x.lowStockLevel || 0) + "</td><td>" + (low ? '<span class="badge warn">Low Stock</span>' : '<span class="badge ok">OK</span>') + "</td><td>" + dateText(x.updatedAt) + "</td></tr>";
  }).join("") : '<tr><td colspan="7" class="empty-state">No inventory items found.</td></tr>';
}

function requestActionHtml(r) {
  let html = "";
  if (can(state.profile,"manage_requests")) {
    if (r.status === "requested") html += '<button class="btn secondary small request-action" data-action="replenish" data-site="' + r.site + '" data-id="' + r.id + '">Replenish</button>';
    if (r.status === "replenishing") html += '<button class="btn secondary small request-action" data-action="sent" data-site="' + r.site + '" data-id="' + r.id + '">Mark Sent</button>';
    if (["sent","received"].includes(r.status)) html += '<button class="btn secondary small request-action" data-action="complete" data-site="' + r.site + '" data-id="' + r.id + '">Complete</button>';
  }
  if (r.status === "sent" && canVerifyAtSite(state.profile, r.site)) html += '<button class="btn primary small request-action" data-action="received" data-site="' + r.site + '" data-id="' + r.id + '">Verify Received</button>';
  return html;
}

function renderRequests() {
  const site = $("#requestSiteFilter").value;
  const status = $("#requestStatusFilter").value;
  const rows = allRequests().filter((x) => (!site || x.site === site) && (!status || x.status === status));
  $("#requestsList").innerHTML = rows.length ? rows.map((r) => '<article class="request-card"><div class="card-top"><div><span class="eyebrow">' + r.site + '</span><h3>' + esc(r.itemName) + '</h3></div>' + statusBadge(r.status) + '</div><div class="meta-list"><span>Category: ' + esc(r.category) + '</span><span>Quantity: ' + Number(r.quantity || 0) + " " + esc(r.unit || "") + '</span><span>Route: ' + esc(r.replenishmentRoute === "direct_kp" ? "Direct to KP" : r.replenishmentRoute === "via_kk" ? "Via KK → KP" : "Not selected") + '</span><span>Requested: ' + dateText(r.createdAt) + '</span>' + (r.notes ? '<span>Notes: ' + esc(r.notes) + '</span>' : "") + '</div><div class="actions">' + requestActionHtml(r) + "</div></article>").join("") : '<div class="empty-state">No requests found.</div>';
}

function transitCarrier(t) {
  if (t.method === "porter") return porterName(t.carrierPorterId);
  return t.staffCarrier || "KK Staff";
}

function renderTransit() {
  const status = $("#transitStatusFilter").value;
  const search = $("#transitSearch").value.trim().toLowerCase();
  const rows = objectToArray(state.transits).filter((x) => (!status || x.status === status) && (!search || [x.billNo,x.origin,x.destination,transitCarrier(x)].some((v) => String(v || "").toLowerCase().includes(search))));
  rows.sort((a,b) => String(b.transitDate || "").localeCompare(String(a.transitDate || "")));
  $("#transitTable").innerHTML = rows.length ? rows.map((t) => {
    const canVerify = t.status === "in_transit" && canVerifyAtSite(state.profile, t.destination);
    return "<tr><td>" + dateText(t.transitDate) + "</td><td><strong>" + esc(t.billNo || "-") + "</strong></td><td>" + esc(t.origin) + " → " + esc(t.destination) + "</td><td>" + esc(t.method === "porter" ? "Porter" : "KK Staff") + "</td><td>" + esc(transitCarrier(t)) + "</td><td>" + Number(t.totalWeight || 0).toFixed(2) + " kg</td><td>" + money(t.totalAmount) + "</td><td>" + statusBadge(t.status) + '</td><td>' + (canVerify ? '<button class="btn primary small verify-transit" data-id="' + t.id + '">Verify Arrival</button>' : "-") + "</td></tr>";
  }).join("") : '<tr><td colspan="9" class="empty-state">No transit records found.</td></tr>';
}

function renderPorters() {
  const rows = objectToArray(state.porters).sort((a,b) => String(a.name).localeCompare(String(b.name)));
  $("#porterGrid").innerHTML = rows.length ? rows.map((p) => '<article class="porter-card"><div class="card-top"><div><span class="eyebrow">Porter</span><h3>' + esc(p.name) + '</h3></div>' + (p.active !== false ? '<span class="badge ok">Active</span>' : '<span class="badge">Inactive</span>') + '</div><div class="meta-list"><span>Normal rate: ' + money(p.ratePerKg) + '/kg</span>' + (p.phone ? '<span>Phone: ' + esc(p.phone) + '</span>' : "") + '</div></article>').join("") : '<div class="empty-state">No porters added yet.</div>';
}

function billingActionHtml(b) {
  if (b.status === "awaiting_kp_bill_verification" && can(state.profile,"verify_kp_bill")) return '<button class="btn primary small billing-action" data-action="kp" data-month="' + b.month + '" data-id="' + b.id + '">Verify Bill</button>';
  if (b.status === "awaiting_accounts_verification" && can(state.profile,"verify_accounts")) return '<button class="btn primary small billing-action" data-action="accounts" data-month="' + b.month + '" data-id="' + b.id + '">Accounts Verify</button>';
  if (b.status === "accounts_verified" && can(state.profile,"mark_paid")) return '<button class="btn primary small billing-action" data-action="paid" data-month="' + b.month + '" data-id="' + b.id + '">Mark Paid</button>';
  return "-";
}

function renderBilling() {
  if (!can(state.profile,"view_billing")) return;
  const month = $("#billingMonth").value;
  const status = $("#billingStatusFilter").value;
  const rows = allBilling().filter((x) => (!month || x.month === month) && (!status || x.status === status));
  const total = rows.reduce((s,x) => s + Number(x.totalAmount || 0),0);
  const pending = rows.filter((x) => x.status !== "paid").reduce((s,x) => s + Number(x.totalAmount || 0),0);
  const paid = rows.filter((x) => x.status === "paid").reduce((s,x) => s + Number(x.totalAmount || 0),0);
  $("#billingSummary").innerHTML = [["Transactions",rows.length,"Selected month/filter"],["Pending",money(pending),"Not yet paid"],["Paid",money(paid),"Completed payments"]].map((x) => '<article class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><small>' + x[2] + '</small></article>').join("");
  $("#billingTable").innerHTML = rows.length ? rows.map((b) => "<tr><td>" + dateText(b.transitDate) + "</td><td><strong>" + esc(b.billNo || "-") + "</strong></td><td>" + esc(porterName(b.carrierPorterId)) + "</td><td>" + esc(porterName(b.paymentRecipientPorterId)) + "</td><td>" + money(b.totalAmount) + "</td><td>" + statusBadge(b.status) + "</td><td>" + billingActionHtml(b) + "</td></tr>").join("") : '<tr><td colspan="7" class="empty-state">No billing records found.</td></tr>';
}

function renderUsers() {
  if (!can(state.profile,"manage_users")) return;
  const rows = objectToArray(state.users).sort((a,b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username)));
  $("#usersTable").innerHTML = rows.length ? rows.map((u) => "<tr><td><strong>" + esc(u.displayName || "-") + "</strong></td><td>" + esc(u.username) + "</td><td>" + esc(u.primarySite || "-") + "</td><td>" + esc(u.department || "-") + "</td><td>" + esc(u.roleLabel || ROLE_LABELS[u.role] || u.role) + "</td><td>" + (u.active ? '<span class="badge ok">Active</span>' : '<span class="badge">Disabled</span>') + '</td><td>' + (u.uid === state.profile.uid ? "Current user" : '<button class="btn ' + (u.active ? "danger" : "secondary") + ' small toggle-user" data-id="' + u.id + '" data-active="' + (u.active ? "1" : "0") + '">' + (u.active ? "Disable" : "Enable") + "</button>") + "</td></tr>").join("") : '<tr><td colspan="7" class="empty-state">No users found.</td></tr>';
}

function renderProfile() {
  const p = state.profile;
  $("#profileCard").innerHTML = '<div class="profile-lines"><div><span>Name</span><strong>' + esc(p.displayName) + '</strong></div><div><span>Username</span><strong>' + esc(p.username) + '</strong></div><div><span>Role</span><strong>' + esc(p.roleLabel || ROLE_LABELS[p.role]) + '</strong></div><div><span>Department</span><strong>' + esc(p.department) + '</strong></div><div><span>Primary Site</span><strong>' + esc(p.primarySite) + "</strong></div></div>";
}

function renderAll() {
  if (!state.profile) return;
  renderDashboard();
  renderInventory();
  renderRequests();
  renderTransit();
  renderPorters();
  renderBilling();
  renderUsers();
  renderProfile();
}

function subscribeData() {
  cleanSubscriptions();
  const inventorySites = allowedInventorySites(state.profile);
  if (can(state.profile,"view_all_inventory")) addSub("inventory", (v) => { state.inventory = v || {}; renderAll(); });
  else inventorySites.forEach((site) => addSub("inventory/" + site, (v) => { state.inventory[site] = v || {}; renderAll(); }));

  if (["system_admin","management","accounts","operations_admin"].includes(state.profile.role)) addSub("requests", (v) => { state.requests = v || {}; renderAll(); });
  else if (["KP","PH"].includes(state.profile.primarySite)) addSub("requests/" + state.profile.primarySite, (v) => { state.requests[state.profile.primarySite] = v || {}; renderAll(); });

  addSub("transits", (v) => { state.transits = v || {}; renderAll(); });
  addSub("porters", (v) => { state.porters = v || {}; renderAll(); });
  if (can(state.profile,"view_billing")) addSub("billing", (v) => { state.billing = v || {}; renderAll(); });
  if (can(state.profile,"manage_users")) addSub("users", (v) => { state.users = v || {}; renderAll(); });
}

function userForm() {
  const roleOptions = Object.entries(ROLE_LABELS).filter(([key]) => key !== "system_admin").map(([key,label]) => '<option value="' + key + '">' + label + "</option>").join("");
  openModal("Create User", '<form id="createUserForm" class="form-grid"><label>Full Name<input name="displayName" required /></label><label>Username<input name="username" required maxlength="40" /></label><label>Temporary Password<input name="password" type="password" minlength="8" required /></label><label>Primary Site<select name="primarySite"><option>KK</option><option>KP</option><option>PH</option><option value="ALL">All Sites</option></select></label><label>Department<input name="department" required placeholder="e.g. Customer Service" /></label><label>Role<select name="role">' + roleOptions + '</select></label><div class="form-actions full-row"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Create User</button></div></form>');
}

function inventoryForm() {
  const sites = allowedInventorySites(state.profile);
  openModal("Add / Update Inventory", '<form id="inventoryForm" class="form-grid"><label>Site<select name="site">' + sites.map((s) => "<option>" + s + "</option>").join("") + '</select></label><label>Item Name<input name="name" required /></label><label>Category<select name="category">' + categoryOptions() + '</select></label><label>Quantity<input name="quantity" type="number" step="0.01" min="0" required /></label><label>Unit<input name="unit" value="unit" required /></label><label>Low Stock Level<input name="lowStockLevel" type="number" step="0.01" min="0" value="0" required /></label><div class="form-actions full-row"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save Item</button></div></form>');
}

function requestForm() {
  const allowed = ["PH","KP"].filter((site) => canCreateRequestForSite(state.profile, site));
  openModal("New Item Request", '<form id="requestForm" class="form-grid"><label>Requesting Site<select name="site">' + allowed.map((s) => "<option>" + s + "</option>").join("") + '</select></label><label>Item Name<input name="itemName" required /></label><label>Category<select name="category">' + categoryOptions() + '</select></label><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" required /></label><label>Unit<input name="unit" value="unit" required /></label><label class="full-row">Notes<textarea name="notes" placeholder="Optional"></textarea></label><div class="form-actions full-row"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Submit Request</button></div></form>');
}

function porterForm() {
  openModal("Add Porter", '<form id="porterForm" class="form-grid"><label>Porter Name<input name="name" required /></label><label>Normal Rate (RM/kg)<input name="ratePerKg" type="number" step="0.01" min="0" value="5" required /></label><label>Phone (optional)<input name="phone" /></label><label>Status<select name="active"><option value="true">Active</option><option value="false">Inactive</option></select></label><div class="form-actions full-row"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Add Porter</button></div></form>');
}

function itemRowHtml() {
  return '<div class="item-row"><label>Item<input data-field="name" required /></label><label>Category<select data-field="category">' + categoryOptions() + '</select></label><label>Qty<input data-field="quantity" type="number" min="0" step="0.01" value="1" required /></label><label>Weight kg<input data-field="weightKg" type="number" min="0" step="0.01" value="0" required /></label><label>Pricing<select data-field="pricingMode"><option value="per_kg">RM/kg</option><option value="custom">Custom</option></select></label><label>Rate<input data-field="ratePerKg" type="number" min="0" step="0.01" value="5" /></label><label>Custom RM<input data-field="customPrice" type="number" min="0" step="0.01" value="0" /></label><button class="btn danger small remove-item" type="button">×</button></div>';
}

function transitForm() {
  const porterOptions = objectToArray(state.porters).filter((p) => p.active !== false).map((p) => '<option value="' + p.id + '" data-rate="' + Number(p.ratePerKg || 0) + '">' + esc(p.name) + " — " + money(p.ratePerKg) + "/kg</option>").join("");
  openModal("Create Transit", '<form id="transitForm" class="stack"><div class="form-grid"><label>Transit Date<input name="transitDate" type="date" value="' + new Date().toISOString().slice(0,10) + '" required /></label><label>Bill No.<input name="billNo" required placeholder="Internal bill number" /></label><label>Origin<select name="origin"><option>KK</option><option>KP</option><option>PH</option><option>Sayat-sayat</option></select></label><label>Destination<select name="destination"><option>KP</option><option>PH</option><option>KK</option><option>Sayat-sayat</option></select></label><label>Method<select name="method" id="transitMethod"><option value="porter">Porter</option><option value="kk_staff">KK Staff</option></select></label><label id="porterField">Porter<select name="carrierPorterId" id="carrierPorterSelect"><option value="">Select porter</option>' + porterOptions + '</select></label><label id="staffField" class="hidden">KK Staff / Driver<input name="staffCarrier" /></label><label class="full-row">Notes<textarea name="notes"></textarea></label></div><div class="item-editor"><div class="section-head"><div><strong>Items</strong><p class="muted">RM/kg items calculate from weight. Bulk/hard-to-carry items use Custom price.</p></div><button id="addTransitItem" class="btn secondary small" type="button">Add Item</button></div><div id="transitItems">' + itemRowHtml() + '</div><div class="total-line"><span id="transitWeight">0.00 kg</span><span id="transitAmount">RM 0.00</span></div></div><div class="form-actions"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Start Transit</button></div></form>');
  syncTransitMethod();
  recalcTransit();
}

function syncTransitMethod() {
  const method = $("#transitMethod")?.value;
  $("#porterField")?.classList.toggle("hidden", method !== "porter");
  $("#staffField")?.classList.toggle("hidden", method !== "kk_staff");
}

function collectTransitItems() {
  return $$("#transitItems .item-row").map((row) => {
    const get = (name) => row.querySelector('[data-field="' + name + '"]').value;
    const weight = Number(get("weightKg") || 0);
    const mode = get("pricingMode");
    const rate = Number(get("ratePerKg") || 0);
    const custom = Number(get("customPrice") || 0);
    return {
      name: get("name").trim(),
      category: get("category"),
      quantity: Number(get("quantity") || 0),
      unit: "unit",
      weightKg: weight,
      pricingMode: mode,
      ratePerKg: rate,
      customPrice: custom,
      lineAmount: mode === "custom" ? custom : weight * rate
    };
  }).filter((x) => x.name);
}

function recalcTransit() {
  const items = collectTransitItems();
  $("#transitWeight") && ($("#transitWeight").textContent = items.reduce((s,x) => s + x.weightKg,0).toFixed(2) + " kg");
  $("#transitAmount") && ($("#transitAmount").textContent = money(items.reduce((s,x) => s + x.lineAmount,0)));
}

function billingVerifyForm(month, id) {
  const options = objectToArray(state.porters).filter((p) => p.active !== false).map((p) => '<option value="' + p.id + '">' + esc(p.name) + "</option>").join("");
  openModal("KP Bill Verification", '<form id="kpBillForm" class="stack" data-month="' + month + '" data-id="' + id + '"><p class="muted">Confirm who should receive the payment. The payment recipient may be different from the porter who carried the items.</p><label>Payment To<select name="paymentRecipientPorterId" required><option value="">Select porter</option>' + options + '</select></label><div class="form-actions"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Confirm Bill</button></div></form>');
}

function exportCsv(type) {
  let rows = [];
  let headers = [];
  if (type === "inventory") {
    headers = ["Site","Item","Category","Quantity","Unit","Low Stock Level"];
    rows = allInventoryRows().map((x) => [x.site,x.name,x.category,x.quantity,x.unit,x.lowStockLevel]);
  } else if (type === "transit") {
    headers = ["Date","Bill No","Origin","Destination","Method","Carrier","Weight KG","Amount","Status"];
    rows = objectToArray(state.transits).map((x) => [x.transitDate,x.billNo,x.origin,x.destination,x.method,transitCarrier(x),x.totalWeight,x.totalAmount,statusLabels[x.status] || x.status]);
  } else {
    headers = ["Month","Date","Bill No","Carrier","Payment To","Amount","Status"];
    rows = allBilling().map((x) => [x.month,x.transitDate,x.billNo,porterName(x.carrierPorterId),porterName(x.paymentRecipientPorterId),x.totalAmount,statusLabels[x.status] || x.status]);
  }
  const csv = [headers,...rows].map((row) => row.map((cell) => '"' + String(cell ?? "").replace(/"/g,'""') + '"').join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "MT-OMS-" + type + "-" + new Date().toISOString().slice(0,10) + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

async function handleRequestAction(btn) {
  const site = btn.dataset.site, id = btn.dataset.id, action = btn.dataset.action;
  const request = state.requests[site]?.[id];
  if (!request) return;
  if (action === "replenish") {
    openModal("Replenishment Route", '<form id="replenishForm" class="stack" data-site="' + site + '" data-id="' + id + '"><label>Replenishment will go<select name="route"><option value="via_kk">Via KK → KP</option><option value="direct_kp">Directly to KP</option></select></label><div class="form-actions"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Start Replenishment</button></div></form>');
    return;
  }
  if (action === "sent") await updateRequest(site,id,{status:"sent"});
  if (action === "received") await updateRequest(site,id,{status:"received"});
  if (action === "complete") await updateRequest(site,id,{status:"completed"});
  await logActivity("request_" + action,{site,requestId:id});
  toast("Request updated.");
}

function bindEvents() {
  initNavigation();

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginMessage").textContent = "";
    $("#loginButton").disabled = true;
    try {
      await loginWithUsername($("#username").value, $("#password").value);
      $("#password").value = "";
    } catch (error) {
      $("#loginMessage").textContent = friendlyAuthError(error);
    } finally {
      $("#loginButton").disabled = false;
    }
  });

  $("#togglePassword").addEventListener("click", () => {
    const input = $("#password");
    input.type = input.type === "password" ? "text" : "password";
    $("#togglePassword").textContent = input.type === "password" ? "Show" : "Hide";
  });

  $("#logoutButton").addEventListener("click", () => logout());
  $("#addInventoryBtn").addEventListener("click", inventoryForm);
  $("#newRequestBtn").addEventListener("click", requestForm);
  $("#newTransitBtn").addEventListener("click", transitForm);
  $("#newPorterBtn").addEventListener("click", porterForm);
  $("#newUserBtn").addEventListener("click", userForm);

  ["inventorySiteFilter","inventorySearch","inventoryCategoryFilter"].forEach((id) => $("#" + id).addEventListener("input", renderInventory));
  ["requestSiteFilter","requestStatusFilter"].forEach((id) => $("#" + id).addEventListener("input", renderRequests));
  ["transitStatusFilter","transitSearch"].forEach((id) => $("#" + id).addEventListener("input", renderTransit));
  ["billingMonth","billingStatusFilter"].forEach((id) => $("#" + id).addEventListener("input", renderBilling));

  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-close]")) closeModal();

    const reqBtn = e.target.closest(".request-action");
    if (reqBtn) {
      try { await handleRequestAction(reqBtn); } catch (err) { toast(err.message, true); }
    }

    const verifyBtn = e.target.closest(".verify-transit");
    if (verifyBtn) {
      const transit = { id: verifyBtn.dataset.id, ...state.transits[verifyBtn.dataset.id] };
      if (!confirm("Verify that all items arrived at " + transit.destination + "? This will update the destination inventory.")) return;
      try {
        await verifyTransitArrival(transit);
        await logActivity("transit_verified",{transitId:transit.id,destination:transit.destination});
        toast("Transit verified successfully.");
      } catch (err) { toast(err.message, true); }
    }

    const billingBtn = e.target.closest(".billing-action");
    if (billingBtn) {
      const { action, month, id } = billingBtn.dataset;
      try {
        if (action === "kp") billingVerifyForm(month,id);
        if (action === "accounts") {
          if (confirm("Confirm Accounts verification for this transaction?")) {
            await verifyAccountsBill(month,id); await logActivity("accounts_bill_verified",{month,transitId:id}); toast("Accounts verification completed.");
          }
        }
        if (action === "paid") {
          const refNo = prompt("Payment reference / note (optional):", "") ?? "";
          await markBillPaid(month,id,refNo); await logActivity("porter_bill_paid",{month,transitId:id}); toast("Payment marked as paid.");
        }
      } catch (err) { toast(err.message, true); }
    }

    const toggle = e.target.closest(".toggle-user");
    if (toggle) {
      const active = toggle.dataset.active === "1";
      if (!confirm((active ? "Disable" : "Enable") + " this user?")) return;
      try { await setUserActive(toggle.dataset.id,!active); toast("User status updated."); } catch (err) { toast(err.message,true); }
    }

    const exportBtn = e.target.closest(".export-btn");
    if (exportBtn) exportCsv(exportBtn.dataset.export);

    if (e.target.closest("#addTransitItem")) {
      $("#transitItems").insertAdjacentHTML("beforeend", itemRowHtml());
      recalcTransit();
    }
    if (e.target.closest(".remove-item")) {
      const row = e.target.closest(".item-row");
      if ($$("#transitItems .item-row").length > 1) row.remove();
      recalcTransit();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.closest("#transitItems")) recalcTransit();
    if (e.target.id === "transitMethod") syncTransitMethod();
    if (e.target.id === "carrierPorterSelect") {
      const option = e.target.selectedOptions[0];
      const rate = Number(option?.dataset.rate || 0);
      $$("#transitItems [data-field='ratePerKg']").forEach((input) => input.value = rate);
      recalcTransit();
    }
  });

  document.addEventListener("submit", async (e) => {
    if (!e.target.closest("#modalBody")) return;
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    try {
      if (form.id === "createUserForm") {
        const username = normalizeUsername(fd.get("username"));
        const uid = await createStaffAuthUser(username,String(fd.get("password")));
        const role = String(fd.get("role"));
        const site = String(fd.get("primarySite"));
        await saveUserProfile(uid,{
          username,
          displayName:String(fd.get("displayName")).trim(),
          role,
          roleLabel:ROLE_LABELS[role],
          department:String(fd.get("department")).trim(),
          primarySite:site,
          siteAccess: site === "ALL" ? {KK:true,KP:true,PH:true} : {[site]:true},
          active:true,
          createdAt:Date.now()
        });
        await logActivity("user_created",{targetUid:uid,username}); toast("User created.");
      }

      if (form.id === "inventoryForm") {
        await addInventoryItem(String(fd.get("site")),{name:String(fd.get("name")),category:String(fd.get("category")),quantity:Number(fd.get("quantity")),unit:String(fd.get("unit")),lowStockLevel:Number(fd.get("lowStockLevel"))});
        await logActivity("inventory_saved",{site:String(fd.get("site")),itemName:String(fd.get("name"))}); toast("Inventory item saved.");
      }

      if (form.id === "requestForm") {
        const site = String(fd.get("site"));
        await createRequest(site,{itemName:String(fd.get("itemName")).trim(),category:String(fd.get("category")),quantity:Number(fd.get("quantity")),unit:String(fd.get("unit")),notes:String(fd.get("notes") || "")});
        await logActivity("request_created",{site,itemName:String(fd.get("itemName"))}); toast("Request submitted.");
      }

      if (form.id === "porterForm") {
        await createPorter({name:String(fd.get("name")).trim(),ratePerKg:Number(fd.get("ratePerKg")),phone:String(fd.get("phone") || ""),active:fd.get("active") === "true"});
        await logActivity("porter_created",{name:String(fd.get("name"))}); toast("Porter added.");
      }

      if (form.id === "transitForm") {
        const items = collectTransitItems();
        if (!items.length) throw new Error("Add at least one item.");
        const method = String(fd.get("method"));
        if (method === "porter" && !fd.get("carrierPorterId")) throw new Error("Select a porter.");
        const totalWeight = items.reduce((s,x) => s + x.weightKg,0);
        const totalAmount = method === "porter" ? items.reduce((s,x) => s + x.lineAmount,0) : 0;
        const id = await createTransit({
          transitDate:String(fd.get("transitDate")),
          billNo:String(fd.get("billNo")).trim(),
          origin:String(fd.get("origin")),
          destination:String(fd.get("destination")),
          method,
          carrierPorterId:method === "porter" ? String(fd.get("carrierPorterId")) : "",
          staffCarrier:method === "kk_staff" ? String(fd.get("staffCarrier") || "") : "",
          items,totalWeight,totalAmount,notes:String(fd.get("notes") || "")
        });
        await logActivity("transit_created",{transitId:id,billNo:String(fd.get("billNo"))}); toast("Transit created.");
      }

      if (form.id === "replenishForm") {
        await updateRequest(form.dataset.site,form.dataset.id,{status:"replenishing",replenishmentRoute:String(fd.get("route"))});
        await logActivity("request_replenishing",{site:form.dataset.site,requestId:form.dataset.id}); toast("Replenishment started.");
      }

      if (form.id === "kpBillForm") {
        await verifyKpBill(form.dataset.month,form.dataset.id,String(fd.get("paymentRecipientPorterId")));
        await logActivity("kp_bill_verified",{month:form.dataset.month,transitId:form.dataset.id}); toast("Bill verified by KP.");
      }

      closeModal();
    } catch (err) {
      toast(friendlyAuthError(err), true);
    }
  });

  $("#passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = $("#newPassword").value, b = $("#confirmPassword").value;
    if (a !== b) return toast("Passwords do not match.",true);
    try { await changeCurrentPassword(a); e.target.reset(); toast("Password updated."); } catch (err) { toast(friendlyAuthError(err),true); }
  });
}

bindEvents();

onAuthStateChanged(auth, async (user) => {
  cleanSubscriptions();
  if (!user) {
    state.profile = null;
    $("#appView").classList.add("hidden");
    $("#loginView").classList.remove("hidden");
    return;
  }
  try {
    const profile = await ensureUserProfile(user);
    if (profile.active !== true) { await logout(); return; }
    state.profile = { ...profile, uid:user.uid };
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    renderHeader();
    setupAccessUI();
    subscribeData();
    showView("dashboard");
  } catch (err) {
    console.error(err);
    toast(friendlyAuthError(err),true);
    await logout();
  }
});
