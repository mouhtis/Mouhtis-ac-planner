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
