/* ---------------- Firebase Initialization ---------------- */
const firebaseConfig = {
    apiKey: "AIzaSyAJIPDZktoQmDUIwQrCBsH_GLfEhN5N6owE",
    authDomain: "mouhtis-suite.firebaseapp.com",
    projectId: "mouhtis-suite",
    storageBucket: "mouhtis-suite.firebasestorage.app",
    messagingSenderId: "1093547214312",
    appId: "1:1093547214312:web:83cc116f17b031f2ef105d",
    measurementId: "G-84HEW3XYX1"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ---------------- SIMPLE HELPERS ---------------- */
function $(s) { return document.querySelector(s); }
function $all(s) { return Array.from(document.querySelectorAll(s)); }

/* ---------------- LOGIN ---------------- */
$("#loginBtn").onclick = () => {
    const pass = $("#loginPass").value.trim();
    if (pass === "fgb0911+") {
        $("#loginScreen").style.display = "none";
        loadPage("dashboard");
    } else {
        alert("Λάθος κωδικός");
    }
};

/* ---------------- GLOBAL STATE ---------------- */
let customers = [];
let tasks = [];
let projects = [];
let studies = [];
let profitChartInstance = null;
let taskTypeChartInstance = null;

/* ---------------- DATE HELPERS ---------------- */
function parseISODate(d) {
    if (!d) return null;
    const p = d.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function sameMonthYear(dateObj, ref) {
    return dateObj && dateObj.getMonth() === ref.getMonth() && dateObj.getFullYear() === ref.getFullYear();
}
function sameYear(dateObj, ref) {
    return dateObj && dateObj.getFullYear() === ref.getFullYear();
}

/* ---------------- LOAD DATA FROM FIRESTORE ---------------- */
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

/* ---------------- SELECT POPULATION HELPERS ---------------- */
function fillCustomerSelect(selId) {
    const sel = $("#" + selId);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
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
    sel.innerHTML = "";
    projects.forEach(p => {
        const op = document.createElement("option");
        op.value = p.id;
        op.textContent = p.title;
        sel.appendChild(op);
    });
    if (prev) sel.value = prev;
}

/* ---------------- CUSTOMERS CRUD ---------------- */
async function saveCustomer() {
    const name = $("#c_name").value.trim();
    const phone = $("#c_phone").value.trim();
    const email = $("#c_email").value.trim();
    const address = $("#c_address").value.trim();
    const area = $("#c_area").value.trim();
    const notes = $("#c_notes").value.trim();
    const msg = $("#c_msg");

    if (!name) { msg.textContent = "Συμπλήρωσε όνομα."; return; }

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
    wrap.innerHTML = "";
    customers.forEach(c => {
        wrap.innerHTML += `
            <div class="item">
                <b>${c.name}</b> — ${c.phone} — ${c.area}
                <span class="del" onclick="deleteCustomer('${c.id}')">Διαγραφή</span>
            </div>
        `;
    });
}

/* ---------------- TASKS CRUD ---------------- */
async function saveTask() {
    const title = $("#t_title").value.trim();
    if (!title) { $("#t_msg").textContent = "Συμπλήρωσε τίτλο."; return; }

    const data = {
        title,
        customerId: $("#t_customer").value,
        type: $("#t_type").value,
        date: $("#t_date").value,
        status: $("#t_status").value,
        notes: $("#t_notes").value,
        costTotal: Number($("#t_cost").value || 0),
        price: Number($("#t_price").value || 0),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection("tasks").add(data);
    tasks.unshift({ id: ref.id, ...data });
    renderTaskList();
}

async function deleteTask(id) {
    if (!confirm("Να διαγραφεί;")) return;
    await db.collection("tasks").doc(id).delete();
    tasks = tasks.filter(t => t.id !== id);
    renderTaskList();
}

function renderTaskList() {
    const wrap = $("#tasks_list");
    wrap.innerHTML = "";
    tasks.forEach(t => {
        const cust = customers.find(c => c.id === t.customerId);
        wrap.innerHTML += `
            <div class="item">
                <b>${t.title}</b> — ${cust ? cust.name : "—"}
                <span class="del" onclick="deleteTask('${t.id}')">Διαγραφή</span>
            </div>
        `;
    });
}

/* ---------------- PROJECTS CRUD ---------------- */
async function saveProject() {
    const title = $("#proj_title").value.trim();
    if (!title) { $("#proj_msg").textContent = "Συμπλήρωσε τίτλο."; return; }

    const data = {
        title,
        customerId: $("#proj_customer").value,
        date: $("#proj_date").value,
        location: $("#proj_location").value,
        costTotal: Number($("#proj_cost").value || 0),
        notes: $("#proj_notes").value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection("projects").add(data);
    projects.unshift({ id: ref.id, ...data });
    renderProjectList();
}

async function deleteProject(id) {
    if (!confirm("Να διαγραφεί;")) return;
    await db.collection("projects").doc(id).delete();
    projects = projects.filter(p => p.id !== id);
    renderProjectList();
}

function renderProjectList() {
    const wrap = $("#projects_list");
    wrap.innerHTML = "";
    projects.forEach(p => {
        const c = customers.find(x => x.id === p.customerId);
        wrap.innerHTML += `
            <div class="item">
                <b>${p.title}</b> — ${c ? c.name : "—"}
                <span class="del" onclick="deleteProject('${p.id}')">Διαγραφή</span>
            </div>
        `;
    });
}

/* ---------------- STUDIES CRUD ---------------- */
async function saveStudy() {
    const title = $("#study_title").value.trim();
    if (!title) { $("#study_msg").textContent = "Συμπλήρωσε τίτλο."; return; }

    const data = {
        title,
        customerId: $("#study_customer").value,
        projectId: $("#study_project").value,
        area: $("#study_area").value,
        usage: $("#study_usage").value,
        summary: $("#study_summary").value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const ref = await db.collection("studies").add(data);
    studies.unshift({ id: ref.id, ...data });
    renderStudyList();
}

async function deleteStudy(id) {
    if (!confirm("Να διαγραφεί;")) return;
    await db.collection("studies").doc(id).delete();
    studies = studies.filter(s => s.id !== id);
    renderStudyList();
}

function renderStudyList() {
    const wrap = $("#studies_list");
    wrap.innerHTML = "";
    studies.forEach(s => {
        wrap.innerHTML += `
            <div class="item">
                <b>${s.title}</b>
                <span class="del" onclick="deleteStudy('${s.id}')">Διαγραφή</span>
            </div>
        `;
    });
}

/* ---------------- MENU ---------------- */
function loadPage(page) {
    $all(".menu-btn").forEach(b => b.classList.remove("active"));
    $(`.menu-btn[data-page="${page}"]`).classList.add("active");

    if (page === "dashboard") renderDashboard();
    if (page === "customers") showCustomers();
    if (page === "tasks") showTasks();
    if (page === "project") showProject();
    if (page === "study") showStudy();
}

/* ---------------- PAGE VIEWS ---------------- */
function showCustomers() {
    $("#mainContent").innerHTML = `
        <h1>Πελάτες</h1>
        <div class="form">
            <input id="c_name" placeholder="Όνομα">
            <input id="c_phone" placeholder="Τηλέφωνο">
            <input id="c_email" placeholder="Email">
            <input id="c_area" placeholder="Περιοχή">
            <input id="c_address" placeholder="Διεύθυνση">
            <textarea id="c_notes" placeholder="Σημειώσεις"></textarea>
            <button onclick="saveCustomer()">Αποθήκευση</button>
            <div id="c_msg"></div>
        </div>
        <div id="customers_list"></div>
    `;
    loadCustomers();
}

function showTasks() {
    $("#mainContent").innerHTML = `
        <h1>Εργασίες</h1>
        <div class="form">
            <input id="t_title" placeholder="Τίτλος">
            <select id="t_customer"></select>
            <select id="t_type">
                <option value="installation">Εγκατάσταση</option>
                <option value="fault">Βλάβη</option>
                <option value="maintenance">Συντήρηση</option>
                <option value="other">Άλλο</option>
            </select>
            <input id="t_date" type="date">
            <input id="t_cost" placeholder="Κόστος">
            <input id="t_price" placeholder="Τιμή">
            <textarea id="t_notes" placeholder="Σημειώσεις"></textarea>
            <button onclick="saveTask()">Αποθήκευση</button>
            <div id="t_msg"></div>
        </div>
        <div id="tasks_list"></div>
    `;
    loadCustomers().then(() => fillCustomerSelect("t_customer"));
    loadTasks();
}

function showProject() {
    $("#mainContent").innerHTML = `
        <h1>Έργα</h1>
        <div class="form">
            <input id="proj_title" placeholder="Τίτλος">
            <select id="proj_customer"></select>
            <input id="proj_location" placeholder="Τοποθεσία">
            <input id="proj_date" type="date">
            <input id="proj_cost" placeholder="Κόστος">
            <textarea id="proj_notes" placeholder="Σημειώσεις"></textarea>
            <button onclick="saveProject()">Αποθήκευση</button>
            <div id="proj_msg"></div>
        </div>
        <div id="projects_list"></div>
    `;
    loadCustomers().then(() => fillCustomerSelect("proj_customer"));
    loadProjects();
}

function showStudy() {
    $("#mainContent").innerHTML = `
        <h1>Μελέτες</h1>
        <div class="form">
            <input id="study_title" placeholder="Τίτλος">
            <select id="study_customer"></select>
            <select id="study_project"></select>
            <input id="study_area" placeholder="Εμβαδόν">
            <select id="study_usage">
                <option value="home">Κατοικία</option>
                <option value="office">Γραφείο</option>
                <option value="shop">Κατάστημα</option>
            </select>
            <textarea id="study_summary" placeholder="Σύνοψη"></textarea>
            <button onclick="saveStudy()">Αποθήκευση</button>
            <div id="study_msg"></div>
        </div>
        <div id="studies_list"></div>
    `;

    Promise.all([loadCustomers(), loadProjects()]).then(() => {
        fillCustomerSelect("study_customer");
        fillProjectSelect("study_project");
    });
    loadStudies();
}

/* ---------------- DASHBOARD ---------------- */
function renderDashboard() {
    $("#mainContent").innerHTML = `
        <h1>Πίνακας Ελέγχου</h1>
        <div>Σύνοψη εφαρμογής.</div>
    `;
}
