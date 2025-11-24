/* -------------------------
   Firebase Initialization
--------------------------*/
const firebaseConfig = {
  apiKey: "AIzaSyAJlPDZktoQmDUIwQrCBsH_GLEhn5N6owE",
  authDomain: "mouhtis-suite.firebaseapp.com",
  projectId: "mouhtis-suite",
  storageBucket: "mouhtis-suite.firebasestorage.app",
  messagingSenderId: "1093547214312",
  appId: "1:1093547214312:web:83cc116f17b031f2ef105d",
  measurementId: "G-84HEW3XYX1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* -------------------------
   SIMPLE HELPERS
--------------------------*/
function $(s) { return document.querySelector(s); }
function $all(s) { return Array.from(document.querySelectorAll(s)); }

/* -------------------------
   LOGIN
--------------------------*/
$("#loginBtn").onclick = () => {
  const pass = $("#loginPass").value.trim();
  if (pass === "fgb0911+") {
    $("#loginScreen").style.display = "none";
    loadPage("dashboard");
  } else {
    alert("Λάθος κωδικός");
  }
};

/* -------------------------
   GLOBAL STATE
--------------------------*/
let customers = [];
let tasks = [];
let projects = [];
let studies = [];

let profitChartInstance = null;
let taskTypeChartInstance = null;

/* -------------------------
   DATE HELPERS
--------------------------*/
function parseISODate(d) {
  if (!d) return null;
  const p = d.split("-");
  if (p.length !== 3) return null;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function sameMonthYear(dateObj, ref) {
  return dateObj &&
    dateObj.getMonth() === ref.getMonth() &&
    dateObj.getFullYear() === ref.getFullYear();
}

function sameYear(dateObj, ref) {
  return dateObj && dateObj.getFullYear() === ref.getFullYear();
}

/* -------------------------
   LOAD DATA FROM FIRESTORE
--------------------------*/
async function loadCustomers() {
  const snap = await db.collection("customers").orderBy("createdAt", "desc").get();
  customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCustomerList();
}

async function loadTasks() {
  const snap = await db.collection("tasks").orderBy("createdAt", "desc").get();
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTaskList();
}

async function loadProjects() {
  const snap = await db.collection("projects").orderBy("createdAt", "desc").get();
  projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderProjectList();
}

async function loadStudies() {
  const snap = await db.collection("studies").orderBy("createdAt", "desc").get();
  studies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderStudyList();
}

/* -------------------------
   SELECT POPULATION HELPERS
--------------------------*/
function fillCustomerSelect(selId) {
  const sel = $("#" + selId);
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = `<option value="">— Επιλογή —</option>`;

  customers.forEach(c => {
    const op = document.createElement("option");
    op.value = c.id;
    op.textContent = c.name;
    sel.appendChild(op);
  });

  if (prev) sel.value = prev;
}

function fillProjectSelect(selId) {
  const sel = $("#" + selId);
  if (!sel) return;

  const prev = sel.value;
  sel.innerHTML = `<option value="">— Χωρίς έργο —</option>`;

  projects.forEach(p => {
    const op = document.createElement("option");
    op.value = p.id;
    op.textContent = p.title;
    sel.appendChild(op);
  });

  if (prev) sel.value = prev;
}

/* -------------------------
   CUSTOMERS CRUD
--------------------------*/
async function saveCustomer() {
  const name = $("#c_name").value.trim();
  const phone = $("#c_phone").value.trim();
  const email = $("#c_email").value.trim();
  const address = $("#c_address").value.trim();
  const area = $("#c_area").value.trim();
  const notes = $("#c_notes").value.trim();
  const msg = $("#c_msg");

  if (!name) {
    msg.textContent = "Συμπλήρωσε όνομα.";
    return;
  }

  msg.textContent = "Αποθήκευση...";

  try {
    const data = {
      name, phone, email, address, area, notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection("customers").add(data);
    customers.unshift({ id: ref.id, ...data });

    msg.textContent = "Αποθηκεύτηκε.";
    $("#c_name").value = "";
    $("#c_phone").value = "";
    $("#c_email").value = "";
    $("#c_address").value = "";
    $("#c_area").value = "";
    $("#c_notes").value = "";
    renderCustomerList();
  } catch (e) {
    msg.textContent = "Σφάλμα.";
  }
}

async function deleteCustomer(id) {
  if (!confirm("Να διαγραφεί;")) return;

  await db.collection("customers").doc(id).delete();
  customers = customers.filter(c => c.id !== id);
  renderCustomerList();
}

function renderCustomerList() {
  const wrap = $("#customers_list");
  if (!wrap) return;

  const q = ($("#customers_search")?.value || "").toLowerCase();
  let arr = customers.slice();

  if (q) {
    arr = arr.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q) ||
      (c.area || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  }

  if (!arr.length) {
    wrap.innerHTML = `<div class="muted">Δεν υπάρχουν πελάτες.</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Όνομα</th>
          <th>Τηλ</th>
          <th>Περιοχή</th>
          <th>Διεύθυνση</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  arr.forEach(c => {
    html += `
      <tr>
        <td>${c.name || ""}</td>
        <td>${c.phone || ""}</td>
        <td>${c.area || ""}</td>
        <td>${c.address || ""}</td>
        <td><span class="link" data-del="${c.id}">Διαγραφή</span></td>
      </tr>`;
  });

  html += `</tbody></table>`;
  wrap.innerHTML = html;

  $all("[data-del]").forEach(el => {
    el.onclick = () => deleteCustomer(el.getAttribute("data-del"));
  });
}

/* -------------------------
   TASKS CRUD (με έξοδα + τιμή)
--------------------------*/
function calcTaskTotalLocal() {
  const unit = parseFloat($("#t_unitCost").value || 0);
  const mat = parseFloat($("#t_materialsCost").value || 0);
  const hrs = parseFloat($("#t_laborHours").value || 0);
  const rate = parseFloat($("#t_laborRate").value || 0);

  const labor = hrs * rate;
  const total = unit + mat + labor;

  $("#t_total_view").textContent =
    `Συνολικό κόστος: ${total.toFixed(2)}€ (Εργασία: ${labor.toFixed(2)}€)`;

  return total;
}

async function saveTask() {
  const customerId = $("#t_customer").value;
  const type = $("#t_type").value;
  const title = $("#t_title").value.trim();
  const date = $("#t_date").value;
  const status = $("#t_status").value;
  const notes = $("#t_notes").value.trim();

  const unit = parseFloat($("#t_unitCost").value || 0);
  const mat = parseFloat($("#t_materialsCost").value || 0);
  const hrs = parseFloat($("#t_laborHours").value || 0);
  const rate = parseFloat($("#t_laborRate").value || 0);
  const price = parseFloat($("#t_price").value || 0);

  const labor = hrs * rate;
  const total = unit + mat + labor;

  const msg = $("#t_msg");

  if (!title) {
    msg.textContent = "Συμπλήρωσε τίτλο.";
    return;
  }

  msg.textContent = "Αποθήκευση...";

  try {
    const data = {
      customerId, type, title, date, status, notes,
      unitCost: unit,
      materialsCost: mat,
      laborHours: hrs,
      laborRate: rate,
      laborCost: labor,
      costTotal: total,
      priceToClient: price,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection("tasks").add(data);
    tasks.unshift({ id: ref.id, ...data });

    msg.textContent = "Αποθηκεύτηκε.";
    renderTaskList();
  } catch (e) {
    msg.textContent = "Σφάλμα.";
  }
}
/* -------------------------
   RENDER TASK LIST
--------------------------*/
function renderTaskList() {
  const wrap = $("#tasks_list");
  if (!wrap) return;

  const q = ($("#tasks_search")?.value || "").toLowerCase();
  const filter = ($("#tasks_filter")?.value || "all");

  let arr = tasks.slice();

  if (filter !== "all") {
    arr = arr.filter(t => t.status === filter);
  }

  if (q) {
    arr = arr.filter(t => {
      const client = customers.find(c => c.id === t.customerId);
      return (
        (t.title || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        (client?.name || "").toLowerCase().includes(q)
      );
    });
  }

  if (!arr.length) {
    wrap.innerHTML = `<div class="muted">Δεν υπάρχουν εργασίες.</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Τίτλος</th>
          <th>Πελάτης</th>
          <th>Τύπος</th>
          <th>Ημ/νία</th>
          <th>Κόστος (€)</th>
          <th>Τιμή (€)</th>
          <th>Κατάσταση</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  arr.forEach(t => {
    const client = customers.find(c => c.id === t.customerId);

    const typeLabel =
      t.type === "installation" ? "Εγκατάσταση" :
      t.type === "fault" ? "Βλάβη" :
      t.type === "maintenance" ? "Συντήρηση" : "Άλλο";

    const pill =
      t.status === "done" ? '<span class="pill green">Ολοκληρωμένη</span>' :
      t.status === "inprogress" ? '<span class="pill orange">Σε εξέλιξη</span>' :
      '<span class="pill red">Ανοιχτή</span>';

    html += `
      <tr>
        <td>${t.title || ""}</td>
        <td>${client ? client.name : "—"}</td>
        <td>${typeLabel}</td>
        <td>${t.date || ""}</td>
        <td>${(t.costTotal || 0).toFixed(2)}</td>
        <td>${(t.priceToClient || 0).toFixed(2)}</td>
        <td>${pill}</td>
        <td><span class="link" data-task-del="${t.id}">Διαγραφή</span></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrap.innerHTML = html;

  $all("[data-task-del]").forEach(el => {
    el.onclick = () => deleteTask(el.getAttribute("data-task-del"));
  });
}

/* -------------------------
   DELETE TASK
--------------------------*/
async function deleteTask(id) {
  if (!confirm("Να διαγραφεί η εργασία;")) return;

  await db.collection("tasks").doc(id).delete();
  tasks = tasks.filter(t => t.id !== id);
  renderTaskList();
}

/* -------------------------
   PROJECT CRUD
--------------------------*/
function calcProjectTotalLocal() {
  const units = parseFloat($("#proj_units").value || 0);
  const mats = parseFloat($("#proj_materials").value || 0);
  const hrs = parseFloat($("#proj_helper_hours").value || 0);
  const rate = parseFloat($("#proj_helper_rate").value || 0);
  const other = parseFloat($("#proj_other").value || 0);

  const helperCost = hrs * rate;
  const total = units + mats + helperCost + other;

  $("#proj_total_view").textContent =
    `Συνολικό κόστος: ${total.toFixed(2)} € (Βοηθός: ${helperCost.toFixed(2)} €)`;

  return total;
}

async function saveProject() {
  const customerId = $("#proj_customer").value;
  const title = $("#proj_title").value.trim();
  const location = $("#proj_location").value.trim();
  const date = $("#proj_date").value;
  const units = parseFloat($("#proj_units").value || 0);
  const mats = parseFloat($("#proj_materials").value || 0);
  const hrs = parseFloat($("#proj_helper_hours").value || 0);
  const rate = parseFloat($("#proj_helper_rate").value || 0);
  const other = parseFloat($("#proj_other").value || 0);
  const notes = $("#proj_notes").value.trim();
  const msg = $("#proj_msg");

  if (!title) {
    msg.textContent = "Συμπλήρωσε τίτλο έργου.";
    return;
  }

  const helperCost = hrs * rate;
  const total = units + mats + helperCost + other;

  msg.textContent = "Αποθήκευση...";

  try {
    const data = {
      customerId,
      title,
      location,
      date,
      costUnits: units,
      costMaterials: mats,
      helperHours: hrs,
      helperRate: rate,
      costOther: other,
      costTotal: total,
      notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection("projects").add(data);
    projects.unshift({ id: ref.id, ...data });

    msg.textContent = "Αποθηκεύτηκε.";
    renderProjectList();
  } catch (e) {
    msg.textContent = "Σφάλμα.";
  }
}

async function deleteProject(id) {
  if (!confirm("Να διαγραφεί το έργο;")) return;

  await db.collection("projects").doc(id).delete();
  projects = projects.filter(p => p.id !== id);
  renderProjectList();
}

function renderProjectList() {
  const wrap = $("#projects_list");
  if (!wrap) return;

  const q = ($("#projects_search")?.value || "").toLowerCase();
  let arr = projects.slice();

  if (q) {
    arr = arr.filter(p => {
      const client = customers.find(c => c.id === p.customerId);
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q) ||
        (client?.name || "").toLowerCase().includes(q)
      );
    });
  }

  if (!arr.length) {
    wrap.innerHTML = `<div class="muted">Δεν υπάρχουν έργα.</div>`;
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Τίτλος</th>
          <th>Πελάτης</th>
          <th>Ημ/νία</th>
          <th>Σύνολο (€)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  arr.forEach(p => {
    const client = customers.find(c => c.id === p.customerId);
    html += `
      <tr>
        <td>${p.title || ""}</td>
        <td>${client ? client.name : "—"}</td>
        <td>${p.date || ""}</td>
        <td>${(p.costTotal || 0).toFixed(2)}</td>
        <td><span class="link" data-proj-del="${p.id}">Διαγραφή</span></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrap.innerHTML = html;

  $all("[data-proj-del]").forEach(el => {
    el.onclick = () => deleteProject(el.getAttribute("data-proj-del"));
  });
}
