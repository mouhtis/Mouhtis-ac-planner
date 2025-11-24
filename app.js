/* ------------ LOGIN ------------ */
const loginBtn = document.getElementById("loginBtn");
loginBtn.onclick = () => {
  const pass = document.getElementById("loginPass").value.trim();
  if (pass === "fgb0911+") {
    document.getElementById("loginScreen").style.display = "none";
    loadPage("dashboard");
  } else {
    alert("Λάθος κωδικός");
  }
};

/* ------------ FIREBASE (compat) ------------ */
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

/* ------------ STATE ------------ */
let customers = [];
let tasks = [];
let projects = [];
let studies = [];
let profitChartInstance = null;
let taskTypeChartInstance = null;

/* ------------ HELPERS ------------ */
function $(sel){return document.querySelector(sel);}
function $all(sel){return Array.from(document.querySelectorAll(sel));}
function parseISODate(d){
  if(!d) return null;
  const parts = d.split("-");
  if(parts.length!==3) return null;
  return new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
}
function sameMonthYear(d,ref){
  return d && d.getMonth()===ref.getMonth() && d.getFullYear()===ref.getFullYear();
}
function sameYear(d,ref){
  return d && d.getFullYear()===ref.getFullYear();
}

/* ------------ CUSTOMERS CRUD ------------ */
async function loadCustomers(){
  try{
    const snap = await db.collection("customers").orderBy("createdAt","desc").get();
    customers = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderCustomerList();
  }catch(e){
    console.error("Error loading customers", e);
  }
}

function renderCustomerList(){
  const wrap = $("#customers_list");
  if(!wrap) return;
  const q = ($("#customers_search")?.value || "").toLowerCase();
  let arr = customers.slice();
  if(q){
    arr = arr.filter(c =>
      (c.name||"").toLowerCase().includes(q) ||
      (c.phone||"").toLowerCase().includes(q) ||
      (c.address||"").toLowerCase().includes(q) ||
      (c.area||"").toLowerCase().includes(q) ||
      (c.email||"").toLowerCase().includes(q)
    );
  }
  if(!arr.length){
    wrap.innerHTML = '<div class="muted">Δεν υπάρχουν πελάτες.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Όνομα</th><th>Τηλέφωνο</th><th>Περιοχή</th><th>Διεύθυνση</th><th></th></tr></thead><tbody>';
  arr.forEach(c=>{
    html += `<tr>
      <td>${c.name||""}</td>
      <td>${c.phone||""}</td>
      <td>${c.area||""}</td>
      <td>${c.address||""}</td>
      <td><span class="link" data-del="${c.id}">Διαγραφή</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  $all('[data-del]').forEach(el=>{
    el.onclick = ()=> deleteCustomer(el.getAttribute('data-del'));
  });
}

async function saveCustomer(){
  const name = $("#c_name").value.trim();
  const phone = $("#c_phone").value.trim();
  const email = $("#c_email").value.trim();
  const address = $("#c_address").value.trim();
  const area = $("#c_area").value.trim();
  const notes = $("#c_notes").value.trim();
  const msgEl = $("#c_msg");
  if(!name){
    msgEl.textContent = "Συμπλήρωσε τουλάχιστον όνομα.";
    return;
  }
  msgEl.textContent = "Αποθήκευση...";
  try{
    const data = {
      name, phone, email, address, area, notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection("customers").add(data);
    customers.unshift({id:ref.id, ...data});
    msgEl.textContent = "Αποθηκεύτηκε.";
    clearCustomerForm(false);
    renderCustomerList();
  }catch(e){
    console.error(e);
    msgEl.textContent = "Σφάλμα κατά την αποθήκευση.";
  }
}

function clearCustomerForm(clearMsg=true){
  $("#c_name").value="";
  $("#c_phone").value="";
  $("#c_email").value="";
  $("#c_address").value="";
  $("#c_area").value="";
  $("#c_notes").value="";
  if(clearMsg) $("#c_msg").textContent="";
}

async function deleteCustomer(id){
  if(!confirm("Να διαγραφεί ο πελάτης;")) return;
  try{
    await db.collection("customers").doc(id).delete();
    customers = customers.filter(c=>c.id!==id);
    tasks.forEach(t=>{ if(t.customerId===id) t.customerId=""; });
    projects.forEach(p=>{ if(p.customerId===id) p.customerId=""; });
    studies.forEach(s=>{ if(s.customerId===id) s.customerId=""; });
    renderCustomerList();
  }catch(e){
    console.error(e);
    alert("Σφάλμα στη διαγραφή.");
  }
}

/* ------------ TASKS CRUD (με κόστος) ------------ */
async function loadTasks(){
  try{
    const snap = await db.collection("tasks").orderBy("createdAt","desc").get();
    tasks = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderTaskList();
  }catch(e){
    console.error("Error loading tasks", e);
  }
}

function calcTaskTotalLocal(){
  const u = parseFloat($("#t_unitCost")?.value || "0") || 0;
  const m = parseFloat($("#t_materialsCost")?.value || "0") || 0;
  const h = parseFloat($("#t_laborHours")?.value || "0") || 0;
  const r = parseFloat($("#t_laborRate")?.value || "0") || 0;
  const labor = h * r;
  const total = u + m + labor;
  const el = $("#t_total_view");
  if(el) el.textContent = `Συνολικό κόστος: ${total.toFixed(2)} € (Εργασία: ${labor.toFixed(2)} €)`;
  return total;
}

function renderTaskList(){
  const wrap = $("#tasks_list");
  if(!wrap) return;
  const q = ($("#tasks_search")?.value || "").toLowerCase();
  const filter = ($("#tasks_filter")?.value || "all");
  let arr = tasks.slice();
  if(filter !== "all"){
    arr = arr.filter(t=>t.status===filter);
  }
  if(q){
    arr = arr.filter(t=>{
      const client = customers.find(c=>c.id===t.customerId);
      return (t.title||"").toLowerCase().includes(q) ||
             (t.notes||"").toLowerCase().includes(q) ||
             (client?.name||"").toLowerCase().includes(q);
    });
  }
  if(!arr.length){
    wrap.innerHTML = '<div class="muted">Δεν υπάρχουν εργασίες.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Τίτλος</th><th>Πελάτης</th><th>Τύπος</th><th>Ημ/νία</th><th>Κόστος (€)</th><th>Κατάσταση</th><th></th></tr></thead><tbody>';
  arr.forEach(t=>{
    const client = customers.find(c=>c.id===t.customerId);
    const typeLabel =
      t.type==="installation" ? "Εγκατάσταση" :
      t.type==="fault" ? "Βλάβη" :
      t.type==="maintenance" ? "Συντήρηση" : "Άλλο";
    const pill =
      t.status==="done" ? '<span class="pill green">Ολοκληρωμένη</span>' :
      t.status==="inprogress" ? '<span class="pill orange">Σε εξέλιξη</span>' :
      '<span class="pill red">Ανοιχτή</span>';
    const costTotal = Number(t.costTotal || 0);
    html += `<tr>
      <td>${t.title||""}</td>
      <td>${client?client.name:"—"}</td>
      <td>${typeLabel}</td>
      <td>${t.date||""}</td>
      <td>${costTotal.toFixed(2)}</td>
      <td>${pill}</td>
      <td><span class="link" data-task-del="${t.id}">Διαγραφή</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  $all('[data-task-del]').forEach(el=>{
    el.onclick = ()=> deleteTask(el.getAttribute('data-task-del'));
  });
}

async function saveTask(){
  const customerId = $("#t_customer").value;
  const type = $("#t_type").value;
  const title = $("#t_title").value.trim();
  const date = $("#t_date").value;
  const status = $("#t_status").value;
  const notes = $("#t_notes").value.trim();
  const unitCost = parseFloat($("#t_unitCost").value || "0") || 0;
  const materialsCost = parseFloat($("#t_materialsCost").value || "0") || 0;
  const laborHours = parseFloat($("#t_laborHours").value || "0") || 0;
  const laborRate = parseFloat($("#t_laborRate").value || "0") || 0;
  const laborCost = laborHours * laborRate;
  const totalCost = unitCost + materialsCost + laborCost;

  const msgEl = $("#t_msg");
  if(!title){
    msgEl.textContent = "Συμπλήρωσε τίτλο εργασίας.";
    return;
  }
  msgEl.textContent = "Αποθήκευση...";
  try{
    const data = {
      customerId,
      type,
      title,
      date,
      status,
      notes,
      unitCost,
      materialsCost,
      laborHours,
      laborRate,
      laborCost,
      costTotal: totalCost,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection("tasks").add(data);
    tasks.unshift({id:ref.id, ...data});
    msgEl.textContent = "Αποθηκεύτηκε.";
    clearTaskForm(false);
    renderTaskList();
  }catch(e){
    console.error(e);
    msgEl.textContent = "Σφάλμα κατά την αποθήκευση.";
  }
}

function clearTaskForm(clearMsg=true){
  $("#t_customer").value="";
  $("#t_type").value="installation";
  $("#t_title").value="";
  $("#t_date").value="";
  $("#t_status").value="open";
  $("#t_notes").value="";
  $("#t_unitCost").value="";
  $("#t_materialsCost").value="";
  $("#t_laborHours").value="";
  $("#t_laborRate").value="10";
  const el = $("#t_total_view");
  if(el) el.textContent = "Συνολικό κόστος: 0.00 € (Εργασία: 0.00 €)";
  if(clearMsg) $("#t_msg").textContent="";
}

async function deleteTask(id){
  if(!confirm("Να διαγραφεί η εργασία;")) return;
  try{
    await db.collection("tasks").doc(id).delete();
    tasks = tasks.filter(t=>t.id!==id);
    renderTaskList();
  }catch(e){
    console.error(e);
    alert("Σφάλμα στη διαγραφή.");
  }
}

/* ------------ PROJECTS CRUD ------------ */
async function loadProjects(){
  try{
    const snap = await db.collection("projects").orderBy("createdAt","desc").get();
    projects = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderProjectList();
  }catch(e){
    console.error("Error loading projects", e);
  }
}

function calcProjectTotalLocal(){
  const u = parseFloat($("#proj_units")?.value || "0") || 0;
  const m = parseFloat($("#proj_materials")?.value || "0") || 0;
  const h = parseFloat($("#proj_helper_hours")?.value || "0") || 0;
  const r = parseFloat($("#proj_helper_rate")?.value || "0") || 0;
  const o = parseFloat($("#proj_other")?.value || "0") || 0;
  const helperCost = h*r;
  const total = u + m + helperCost + o;
  const el = $("#proj_total_view");
  if(el) el.textContent = `Συνολικό κόστος: ${total.toFixed(2)} € (Βοηθός: ${helperCost.toFixed(2)} €)`;
  return total;
}

function renderProjectList(){
  const wrap = $("#projects_list");
  if(!wrap) return;
  const q = ($("#projects_search")?.value || "").toLowerCase();
  let arr = projects.slice();
  if(q){
    arr = arr.filter(p=>{
      const client = customers.find(c=>c.id===p.customerId);
      return (p.title||"").toLowerCase().includes(q) ||
             (p.location||"").toLowerCase().includes(q) ||
             (client?.name||"").toLowerCase().includes(q);
    });
  }
  if(!arr.length){
    wrap.innerHTML = '<div class="muted">Δεν υπάρχουν έργα.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Τίτλος</th><th>Πελάτης</th><th>Ημ/νία</th><th>Σύνολο (€)</th><th></th></tr></thead><tbody>';
  arr.forEach(p=>{
    const client = customers.find(c=>c.id===p.customerId);
    const total = Number(p.costTotal || 0);
    html += `<tr>
      <td>${p.title||""}</td>
      <td>${client?client.name:"—"}</td>
      <td>${p.date||""}</td>
      <td>${total.toFixed(2)}</td>
      <td><span class="link" data-proj-del="${p.id}">Διαγραφή</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  $all('[data-proj-del]').forEach(el=>{
    el.onclick = ()=> deleteProject(el.getAttribute('data-proj-del'));
  });
}

async function saveProject(){
  const customerId = $("#proj_customer").value;
  const title = $("#proj_title").value.trim();
  const location = $("#proj_location").value.trim();
  const date = $("#proj_date").value;
  const units = parseFloat($("#proj_units").value || "0") || 0;
  const mats = parseFloat($("#proj_materials").value || "0") || 0;
  const h = parseFloat($("#proj_helper_hours").value || "0") || 0;
  const r = parseFloat($("#proj_helper_rate").value || "0") || 0;
  const other = parseFloat($("#proj_other").value || "0") || 0;
  const notes = $("#proj_notes").value.trim();
  const msgEl = $("#proj_msg");
  if(!title){
    msgEl.textContent = "Συμπλήρωσε τίτλο έργου.";
    return;
  }
  const helperCost = h*r;
  const total = units + mats + helperCost + other;
  msgEl.textContent = "Αποθήκευση...";
  try{
    const data = {
      customerId,
      title,
      location,
      date,
      costUnits: units,
      costMaterials: mats,
      helperHours: h,
      helperRate: r,
      costOther: other,
      costTotal: total,
      notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection("projects").add(data);
    projects.unshift({id:ref.id, ...data});
    msgEl.textContent = "Αποθηκεύτηκε.";
    clearProjectForm(false);
    renderProjectList();
  }catch(e){
    console.error(e);
    msgEl.textContent = "Σφάλμα κατά την αποθήκευση.";
  }
}

function clearProjectForm(clearMsg=true){
  $("#proj_customer").value="";
  $("#proj_title").value="";
  $("#proj_location").value="";
  $("#proj_date").value="";
  $("#proj_units").value="";
  $("#proj_materials").value="";
  $("#proj_helper_hours").value="";
  $("#proj_helper_rate").value="5";
  $("#proj_other").value="";
  $("#proj_notes").value="";
  calcProjectTotalLocal();
  if(clearMsg) $("#proj_msg").textContent="";
}

async function deleteProject(id){
  if(!confirm("Να διαγραφεί το έργο;")) return;
  try{
    await db.collection("projects").doc(id).delete();
    projects = projects.filter(p=>p.id!==id);
    renderProjectList();
  }catch(e){
    console.error(e);
    alert("Σφάλμα στη διαγραφή.");
  }
}

/* ------------ STUDIES CRUD ------------ */
async function loadStudies(){
  try{
    const snap = await db.collection("studies").orderBy("createdAt","desc").get();
    studies = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderStudyList();
  }catch(e){
    console.error("Error loading studies", e);
  }
}

function estimateBTU(area,usage,insulText){
  const m2 = area || 0;
  let per_m2 = 400;
  if(usage==="office") per_m2 = 450;
  if(usage==="shop")  per_m2 = 500;
  const txt = insulText.toLowerCase();
  if(txt.includes("καλή")) per_m2 -= 40;
  if(txt.includes("κακή") || txt.includes("χωρίς")) per_m2 += 60;
  const total = m2 * per_m2;
  return Math.round(total/1000)*1000;
}

function applyStudyCalc(){
  const area = parseFloat($("#study_area")?.value || "0") || 0;
  const usage = $("#study_usage")?.value || "home";
  const ins  = $("#study_ins").value || "";
  const totalBTU = estimateBTU(area,usage,ins);
  const txt = `Εκτίμηση φορτίου: περίπου ${totalBTU.toLocaleString()} BTU συνολικά.\nΠρόταση: διαμοιρασμός σε 2–3 μονάδες inverter Α+++ σύμφωνα με τη διαρρύθμιση.`;
  const summaryEl = $("#study_summary");
  if(summaryEl){
    summaryEl.value = txt + "\n\n" + (summaryEl.value || "");
  }
}

function renderStudyList(){
  const wrap = $("#studies_list");
  if(!wrap) return;
  const q = ($("#studies_search")?.value || "").toLowerCase();
  let arr = studies.slice();
  if(q){
    arr = arr.filter(s=>{
      const client = customers.find(c=>c.id===s.customerId);
      const proj   = projects.find(p=>p.id===s.projectId);
      return (s.title||"").toLowerCase().includes(q) ||
             (s.summary||"").toLowerCase().includes(q) ||
             (client?.name||"").toLowerCase().includes(q) ||
             (proj?.title||"").toLowerCase().includes(q);
    });
  }
  if(!arr.length){
    wrap.innerHTML = '<div class="muted">Δεν υπάρχουν μελέτες.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Τίτλος</th><th>Πελάτης</th><th>Έργο</th><th></th></tr></thead><tbody>';
  arr.forEach(s=>{
    const client = customers.find(c=>c.id===s.customerId);
    const proj   = projects.find(p=>p.id===s.projectId);
    html += `<tr>
      <td>${s.title||""}</td>
      <td>${client?client.name:"—"}</td>
      <td>${proj?proj.title:"—"}</td>
      <td><span class="link" data-study-del="${s.id}">Διαγραφή</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  $all('[data-study-del]').forEach(el=>{
    el.onclick = ()=> deleteStudy(el.getAttribute('data-study-del'));
  });
}

async function saveStudy(){
  const title = $("#study_title").value.trim();
  const customerId = $("#study_customer").value;
  const projectId  = $("#study_project").value;
  const area = parseFloat($("#study_area").value || "0") || 0;
  const usage = $("#study_usage").value;
  const ins = $("#study_ins").value.trim();
  const summary = $("#study_summary").value.trim();
  const msgEl = $("#study_msg");
  if(!title){
    msgEl.textContent = "Συμπλήρωσε τίτλο μελέτης.";
    return;
  }
  msgEl.textContent = "Αποθήκευση...";
  try{
    const data = {
      title,
      customerId,
      projectId,
      area,
      usage,
      insulation: ins,
      summary,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection("studies").add(data);
    studies.unshift({id:ref.id, ...data});
    msgEl.textContent = "Αποθηκεύτηκε.";
    clearStudyForm(false);
    renderStudyList();
  }catch(e){
    console.error(e);
    msgEl.textContent = "Σφάλμα κατά την αποθήκευση.";
  }
}

function clearStudyForm(clearMsg=true){
  $("#study_title").value="";
  $("#study_customer").value="";
  $("#study_project").value="";
  $("#study_area").value="";
  $("#study_usage").value="home";
  $("#study_ins").value="";
  $("#study_summary").value="";
  if(clearMsg) $("#study_msg").textContent="";
}

async function deleteStudy(id){
  if(!confirm("Να διαγραφεί η μελέτη;")) return;
  try{
    await db.collection("studies").doc(id).delete();
    studies = studies.filter(s=>s.id!==id);
    renderStudyList();
  }catch(e){
    console.error(e);
    alert("Σφάλμα στη διαγραφή.");
  }
}

/* ------------ SELECT HELPERS ------------ */
function fillCustomerSelect(selectId){
  const sel = $("#"+selectId);
  if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Επιλογή —</option>';
  customers.forEach(c=>{
    const opt=document.createElement("option");
    opt.value=c.id;
    opt.textContent=c.name;
    sel.appendChild(opt);
  });
  if(prev) sel.value=prev;
}
function fillProjectSelect(selectId){
  const sel = $("#"+selectId);
  if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Χωρίς έργο —</option>';
  projects.forEach(p=>{
    const opt=document.createElement("option");
    opt.value=p.id;
    opt.textContent=p.title;
    sel.appendChild(opt);
  });
  if(prev) sel.value=prev;
}

/* ------------ DASHBOARD STATS ------------ */
function computeDashboardStats(){
  const now = new Date();
  const stats = {
    totalCustomers: customers.length,
    newCustomersMonth: 0,
    totalTasks: tasks.length,
    tasksMonth: 0,
    tasksDone: 0,
    tasksOpen: 0,
    tasksByType: {installation:0,fault:0,maintenance:0,other:0},
    totalProjects: projects.length,
    avgProjectCost: 0,
    maxProjectCost: 0,
    totalStudies: studies.length,
    avgStudyArea: 0,
    monthlyExpenses: 0,
    yearlyExpenses: 0
  };

  customers.forEach(c=>{
    if(c.createdAt && c.createdAt.toDate){
      const d = c.createdAt.toDate();
      if(sameMonthYear(d,now)) stats.newCustomersMonth++;
    }
  });

  tasks.forEach(t=>{
    const d = parseISODate(t.date);
    if(sameMonthYear(d,now)) stats.tasksMonth++;
    if(t.status==="done") stats.tasksDone++;
    if(t.status==="open") stats.tasksOpen++;
    if(stats.tasksByType[t.type]!=null) stats.tasksByType[t.type]++; else stats.tasksByType.other++;

    const c = Number(t.costTotal || 0);
    if(sameMonthYear(d,now)) stats.monthlyExpenses += c;
    if(sameYear(d,now)) stats.yearlyExpenses += c;
  });

  let totalCost = 0;
  let sumCost = 0;
  projects.forEach(p=>{
    const total = Number(p.costTotal||0);
    sumCost += total;
    if(total>stats.maxProjectCost) stats.maxProjectCost = total;
    totalCost++;
    const d = parseISODate(p.date);
    if(sameMonthYear(d,now)) stats.monthlyExpenses += total;
    if(sameYear(d,now)) stats.yearlyExpenses += total;
  });
  stats.avgProjectCost = totalCost? (sumCost/totalCost):0;

  let areaSum = 0, areaCount=0;
  studies.forEach(s=>{
    if(s.area){ areaSum+=Number(s.area); areaCount++; }
  });
  stats.avgStudyArea = areaCount? (areaSum/areaCount):0;

  return stats;
}

/* ------------ DASHBOARD RENDER ------------ */
function renderDashboard(){
  const main = $("#mainContent");
  const stats = computeDashboardStats();

  main.innerHTML = `
    <h1>Πίνακας ελέγχου</h1>
    <div class="subtitle">Γενική εικόνα πελατών, εργασιών, έργων και κόστους.</div>

    <div class="dashboard-grid" style="margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-label">Συνολικοί πελάτες</div>
        <div class="stat-value">${stats.totalCustomers}</div>
        <div class="stat-sub">Νέοι πελάτες αυτόν τον μήνα: <span class="stat-good">${stats.newCustomersMonth}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Εργασίες</div>
        <div class="stat-value">${stats.totalTasks}</div>
        <div class="stat-sub">
          Μήνα: ${stats.tasksMonth} • Ολοκληρωμένες: <span class="stat-good">${stats.tasksDone}</span> • Ανοιχτές: <span class="stat-bad">${stats.tasksOpen}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Έργα</div>
        <div class="stat-value">${stats.totalProjects}</div>
        <div class="stat-sub">
          Μ.ο. κόστους: ${stats.avgProjectCost.toFixed(0)}€ • Μέγιστο: ${stats.maxProjectCost.toFixed(0)}€
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Μελέτες κλιματισμού</div>
        <div class="stat-value">${stats.totalStudies}</div>
        <div class="stat-sub">Μ.ο. εμβαδού: ${stats.avgStudyArea.toFixed(1)} m²</div>
      </div>
    </div>

    <div class="dashboard-grid" style="margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-label">Συνολικά έξοδα μήνα (έργα + εργασίες)</div>
        <div class="stat-value">${stats.monthlyExpenses.toFixed(0)}€</div>
        <div class="stat-sub">Υλικά, μονάδες, βοηθός, εργασία, λοιπά</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Συνολικά έξοδα έτους (έργα + εργασίες)</div>
        <div class="stat-value">${stats.yearlyExpenses.toFixed(0)}€</div>
        <div class="stat-sub">Από την αρχή του έτους</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-wrapper">
        <h3>Έξοδα έργων ανά μήνα (έτος)</h3>
        <canvas id="profitChart" height="180"></canvas>
      </div>
      <div class="chart-wrapper">
        <h3>Κατανομή εργασιών ανά τύπο</h3>
        <canvas id="taskTypeChart" height="180"></canvas>
      </div>
    </div>
  `;

  drawProfitChart();
  drawTaskTypeChart();
}

function drawProfitChart(){
  const ctx = document.getElementById("profitChart");
  if(!ctx) return;
  if(profitChartInstance) profitChartInstance.destroy();
  const now = new Date();
  const year = now.getFullYear();
  const labels = ["Ιαν","Φεβ","Μαρ","Απρ","Μαι","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"];
  const data = new Array(12).fill(0);
  projects.forEach(p=>{
    const d = parseISODate(p.date);
    if(d && d.getFullYear()===year){
      const m = d.getMonth();
      data[m] += Number(p.costTotal||0);
    }
  });
  profitChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets:[{
        label:"Έξοδα έργων (€)",
        data,
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{
        y:{beginAtZero:true}
      }
    }
  });
}

function drawTaskTypeChart(){
  const ctx = document.getElementById("taskTypeChart");
  if(!ctx) return;
  if(taskTypeChartInstance) taskTypeChartInstance.destroy();
  const counts = {installation:0,fault:0,maintenance:0,other:0};
  tasks.forEach(t=>{
    if(counts[t.type]!=null) counts[t.type]++; else counts.other++;
  });
  const labels = ["Εγκατάσταση","Βλάβη","Συντήρηση","Άλλο"];
  const data = [
    counts.installation,
    counts.fault,
    counts.maintenance,
    counts.other
  ];
  taskTypeChartInstance = new Chart(ctx,{
    type:"doughnut",
    data:{
      labels,
      datasets:[{data}]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{position:"bottom"}
      }
    }
  });
}

/* ------------ PAGE RENDERING ------------ */
function loadPage(page){
  const main = document.getElementById("mainContent");
  let html = "";

  if(page==="dashboard"){
    Promise.all([loadCustomers(), loadTasks(), loadProjects(), loadStudies()]).then(()=>{
      renderDashboard();
    });
  }

  if(page==="customers"){
    html = `
      <h1>Πελάτες</h1>
      <div class="subtitle">Καταχώρηση & αναζήτηση πελατών (cloud Firestore).</div>

      <div class="card">
        <h3>Νέος πελάτης</h3>
        <label>Ονοματεπώνυμο</label>
        <input id="c_name" placeholder="π.χ. Γιάννης Παπαδόπουλος"/>

        <label>Τηλέφωνο</label>
        <input id="c_phone" placeholder="69xxxxxxx"/>

        <label>Email</label>
        <input id="c_email" placeholder="example@mail.com"/>

        <label>Περιοχή</label>
        <input id="c_area" placeholder="π.χ. Τούμπα"/>

        <label>Διεύθυνση</label>
        <input id="c_address" placeholder="Οδός, αριθμός"/>

        <label>Σχόλια</label>
        <textarea id="c_notes" placeholder="Σημειώσεις για χώρο, πρόσβαση, ωράρια κλπ."></textarea>

        <div style="margin-top:10px;">
          <button class="btn small" id="c_save_btn">Αποθήκευση</button>
          <button class="btn secondary small" id="c_clear_btn">Καθαρισμός</button>
        </div>
        <div id="c_msg" class="muted" style="margin-top:4px;"></div>
      </div>

      <div class="card">
        <h3>Λίστα πελατών</h3>
        <input id="customers_search" class="search-box" placeholder="Αναζήτηση (όνομα, τηλ, περιοχή, διεύθυνση, email)..."/>
        <div id="customers_list" class="muted">Φόρτωση...</div>
      </div>
    `;
    main.innerHTML = html;

    document.getElementById("c_save_btn").onclick = saveCustomer;
    document.getElementById("c_clear_btn").onclick = ()=>clearCustomerForm(true);
    document.getElementById("customers_search").oninput = renderCustomerList;

    loadCustomers();
  }

  if(page==="tasks"){
    html = `
      <h1>Εργασίες</h1>
      <div class="subtitle">Εγκαταστάσεις, βλάβες, συντηρήσεις, με παρακολούθηση κόστους.</div>

      <div class="card">
        <h3>Νέα εργασία</h3>
        <label>Πελάτης</label>
        <select id="t_customer"></select>

        <label>Τύπος εργασίας</label>
        <select id="t_type">
          <option value="installation">Εγκατάσταση</option>
          <option value="fault">Βλάβη</option>
          <option value="maintenance">Συντήρηση</option>
          <option value="other">Άλλο</option>
        </select>

        <label>Τίτλος εργασίας</label>
        <input id="t_title" placeholder="π.χ. Εγκατάσταση 12.000 BTU"/>

        <label>Ημερομηνία</label>
        <input id="t_date" type="date"/>

        <label>Κατάσταση</label>
        <select id="t_status">
          <option value="open">Ανοιχτή</option>
          <option value="inprogress">Σε εξέλιξη</option>
          <option value="done">Ολοκληρωμένη</option>
        </select>

        <h3 style="margin-top:10px;">Κόστη</h3>
        <label>Κόστος μονάδας / εξοπλισμού (€)</label>
        <input id="t_unitCost" type="number" step="0.01"/>

        <label>Κόστος υλικών (€)</label>
        <input id="t_materialsCost" type="number" step="0.01"/>

        <label>Ώρες εργασίας</label>
        <input id="t_laborHours" type="number" step="0.5"/>

        <label>Ωρομίσθιο (€ / ώρα)</label>
        <input id="t_laborRate" type="number" step="0.5" value="10"/>

        <div id="t_total_view" class="muted" style="margin-top:6px;">Συνολικό κόστος: 0.00 € (Εργασία: 0.00 €)</div>

        <label>Σημειώσεις</label>
        <textarea id="t_notes" placeholder="Περιγραφή εργασίας, υλικά, παρατηρήσεις."></textarea>

        <div style="margin-top:10px;">
          <button class="btn small" id="t_save_btn">Αποθήκευση</button>
          <button class="btn secondary small" id="t_clear_btn">Καθαρισμός</button>
        </div>
        <div id="t_msg" class="muted" style="margin-top:4px;"></div>
      </div>

      <div class="card">
        <h3>Λίστα εργασιών</h3>
        <label>Κατάσταση</label>
        <select id="tasks_filter" style="max-width:200px;margin-bottom:6px;">
          <option value="all">Όλες</option>
          <option value="open">Ανοιχτές</option>
          <option value="inprogress">Σε εξέλιξη</option>
          <option value="done">Ολοκληρωμένες</option>
        </select>
        <input id="tasks_search" class="search-box" placeholder="Αναζήτηση (τίτλος, πελάτης, σημειώσεις)..."/>
        <div id="tasks_list" class="muted">Φόρτωση...</div>
      </div>
    `;
    main.innerHTML = html;

    loadCustomers().then(()=>fillCustomerSelect("t_customer"));
    loadTasks();

    $("#t_save_btn").onclick = saveTask;
    $("#t_clear_btn").onclick = ()=>clearTaskForm(true);
    $("#tasks_search").oninput = renderTaskList;
    $("#tasks_filter").onchange = renderTaskList;

    ["t_unitCost","t_materialsCost","t_laborHours","t_laborRate"].forEach(id=>{
      const el = $("#"+id);
      if(el) el.oninput = calcTaskTotalLocal;
    });
    calcTaskTotalLocal();
  }

  if(page==="project"){
    html = `
      <h1>Διαχείριση έργου</h1>
      <div class="subtitle">Υπολογισμός κόστους ανά έργο.</div>

      <div class="card">
        <h3>Νέο έργο</h3>

        <label>Πελάτης</label>
        <select id="proj_customer"></select>

        <label>Τίτλος έργου</label>
        <input id="proj_title" placeholder="π.χ. Εγκατάσταση 3 κλιματιστικών"/>

        <label>Τοποθεσία</label>
        <input id="proj_location" placeholder="Διεύθυνση έργου"/>

        <label>Ημερομηνία</label>
        <input id="proj_date" type="date"/>

        <h3 style="margin-top:10px;">Κόστη</h3>
        <label>Κόστος κλιματιστικών (€)</label>
        <input id="proj_units" type="number" step="0.01"/>

        <label>Κόστος υλικών (€)</label>
        <input id="proj_materials" type="number" step="0.01"/>

        <label>Ώρες βοηθού</label>
        <input id="proj_helper_hours" type="number" step="0.5"/>

        <label>Ωρομίσθιο βοηθού (€ / ώρα)</label>
        <input id="proj_helper_rate" type="number" step="0.5" value="5"/>

        <label>Άλλα κόστη (€)</label>
        <input id="proj_other" type="number" step="0.01"/>

        <label>Σημειώσεις</label>
        <textarea id="proj_notes" placeholder="Αναλυτική περιγραφή εργασιών, μοντέλα κλιματιστικών κλπ."></textarea>

        <div id="proj_total_view" class="muted" style="margin-top:6px;">Συνολικό κόστος: 0.00 € (Βοηθός: 0.00 €)</div>

        <div style="margin-top:10px;">
          <button class="btn small" id="proj_save_btn">Αποθήκευση</button>
          <button class="btn secondary small" id="proj_clear_btn">Καθαρισμός</button>
        </div>
        <div id="proj_msg" class="muted" style="margin-top:4px;"></div>
      </div>

      <div class="card">
        <h3>Λίστα έργων</h3>
        <input id="projects_search" class="search-box" placeholder="Αναζήτηση (τίτλος, πελάτης, τοποθεσία)..."/>
        <div id="projects_list" class="muted">Φόρτωση...</div>
      </div>
    `;
    main.innerHTML = html;

    loadCustomers().then(()=>fillCustomerSelect("proj_customer"));
    loadProjects();

    $("#proj_save_btn").onclick = saveProject;
    $("#proj_clear_btn").onclick = ()=>clearProjectForm(true);
    $("#projects_search").oninput = renderProjectList;

    ["proj_units","proj_materials","proj_helper_hours","proj_helper_rate","proj_other"].forEach(id=>{
      const el = $("#"+id);
      if(el) el.oninput = calcProjectTotalLocal;
    });
    calcProjectTotalLocal();
  }

  if(page==="study"){
    html = `
      <h1>Μελέτη κλιματισμού</h1>
      <div class="subtitle">Μελέτες BTU & προτάσεις κλιματιστικών, συνδεδεμένες με πελάτες και έργα.</div>

      <div class="card">
        <h3>Νέα μελέτη</h3>

        <label>Τίτλος μελέτης</label>
        <input id="study_title" placeholder="π.χ. Μελέτη διαμερίσματος 85m²"/>

        <label>Πελάτης</label>
        <select id="study_customer"></select>

        <label>Σχετικό έργο (προαιρετικό)</label>
        <select id="study_project"></select>

        <label>Συνολικό εμβαδόν (m²)</label>
        <input id="study_area" type="number" step="1"/>

        <label>Χρήση χώρου</label>
        <select id="study_usage">
          <option value="home">Κατοικία</option>
          <option value="office">Γραφείο</option>
          <option value="shop">Κατάστημα</option>
        </select>

        <label>Θερμομόνωση / προσανατολισμός</label>
        <textarea id="study_ins" placeholder="π.χ. Δυτικό σαλόνι, μέτρια θερμομόνωση, μεγάλα ανοίγματα."></textarea>

        <label>Σύνοψη / BTU / προτάσεις μονάδων</label>
        <textarea id="study_summary" placeholder="Θα παραχθεί κείμενο μετά τον υπολογισμό."></textarea>

        <div style="margin-top:8px;">
          <button class="btn small" id="study_calc_btn">Υπολογισμός BTU</button>
        </div>

        <div style="margin-top:10px;">
          <button class="btn small" id="study_save_btn">Αποθήκευση</button>
          <button class="btn secondary small" id="study_clear_btn">Καθαρισμός</button>
        </div>
        <div id="study_msg" class="muted" style="margin-top:4px;"></div>
      </div>

      <div class="card">
        <h3>Αρχείο μελετών</h3>
        <input id="studies_search" class="search-box" placeholder="Αναζήτηση (τίτλος, πελάτης, έργο)..."/>
        <div id="studies_list" class="muted">Φόρτωση...</div>
      </div>
    `;
    main.innerHTML = html;

    Promise.all([loadCustomers(), loadProjects()]).then(()=>{
      fillCustomerSelect("study_customer");
      fillProjectSelect("study_project");
    });
    loadStudies();

    $("#studies_search").oninput = renderStudyList;
    $("#study_calc_btn").onclick = applyStudyCalc;
    $("#study_save_btn").onclick = saveStudy;
    $("#study_clear_btn").onclick = ()=>clearStudyForm(true);
  }

  $all(".menu-btn").forEach(btn=>{
    btn.classList.toggle("active", btn.getAttribute("data-page")===page);
  });
}

/* ------------ MENU BIND ------------ */
$all(".menu-btn").forEach(btn=>{
  btn.addEventListener("click", ()=> {
    const page = btn.getAttribute("data-page");
    loadPage(page);
  });
});