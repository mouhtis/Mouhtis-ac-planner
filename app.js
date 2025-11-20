// Mouhtis Stable Logic – AC Planner
// ΣΗΜΕΙΩΣΗ: Στο μέλλον αλλάζουμε ΜΟΝΟ αυτό το αρχείο (index.html & style.css μένουν σταθερά).

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

const btnDrawRoom = document.getElementById("btnDrawRoom");
const btnPlaceAC = document.getElementById("btnPlaceAC");
const btnClear = document.getElementById("btnClear");
const btnCalculate = document.getElementById("btnCalculate");

const roomsListEl = document.getElementById("roomsList");
const resultsEl = document.getElementById("results");
const acSuggestionsEl = document.getElementById("acSuggestions");

let bgImage = null;
let mode = null; // 'draw' | 'place'
let rooms = [];  // {x,y,w,h, area, height, windows, ins}
let acMarkers = []; // {x,y,roomIndex}

let drawing = false;
let startPoint = null;

// ------------------ Φόρτωμα κάτοψης ------------------ //
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      bgImage = img;
      drawAll();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ------------------ Σχεδίαση όλων ------------------ //
function drawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Δωμάτια
  rooms.forEach((r, idx) => {
    ctx.save();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(37, 99, 235, 0.06)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#111827";
    ctx.font = "13px system-ui";
    ctx.fillText(`Δωμάτιο ${idx + 1}`, r.x + 6, r.y + 16);
    ctx.restore();
  });

  // AC markers
  acMarkers.forEach((m) => {
    ctx.save();
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui";
    ctx.fillText("AC", m.x - 8, m.y + 3);
    ctx.restore();
  });
}

// ------------------ Pointer events (PC + κινητό) ------------------ //
function pointerToCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
  const clientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY);
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = pointerToCanvas(e);

  if (mode === "draw") {
    drawing = true;
    startPoint = p;
  } else if (mode === "place") {
    let idx = null;
    rooms.forEach((r, i) => {
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        idx = i;
      }
    });
    acMarkers.push({ x: p.x, y: p.y, roomIndex: idx });
    drawAll();
  }
});

canvas.addEventListener("pointermove", (e) => {
  const p = pointerToCanvas(e);
  if (drawing && mode === "draw" && startPoint) {
    drawAll();
    ctx.save();
    ctx.strokeStyle = "#16a34a";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(startPoint.x, startPoint.y, p.x - startPoint.x, p.y - startPoint.y);
    ctx.restore();
  }
});

canvas.addEventListener("pointerup", (e) => {
  e.preventDefault();
  const p = pointerToCanvas(e);

  if (mode === "draw" && drawing && startPoint) {
    const nx = Math.min(startPoint.x, p.x);
    const ny = Math.min(startPoint.y, p.y);
    const nw = Math.abs(p.x - startPoint.x);
    const nh = Math.abs(p.y - startPoint.y);

    if (nw > 20 && nh > 20) {
      rooms.push({
        x: nx,
        y: ny,
        w: nw,
        h: nh,
        area: "",
        height: 2.7,
        windows: 0,
        ins: 1.0,
      });
      renderRoomsList();
    }
  }

  drawing = false;
  startPoint = null;
  drawAll();
});

// ------------------ Κουμπιά ------------------ //
btnDrawRoom.addEventListener("click", () => {
  mode = "draw";
  alert("Λειτουργία σχεδίασης δωματίου: σύρε πάνω στην κάτοψη για να δημιουργήσεις ένα ορθογώνιο.");
});
btnPlaceAC.addEventListener("click", () => {
  mode = "place";
  alert("Λειτουργία τοποθέτησης AC: πάτησε μέσα στο δωμάτιο για να τοποθετήσεις μονάδα.");
});
btnClear.addEventListener("click", () => {
  if (!confirm("Θέλεις να καθαρίσεις δωμάτια και AC;")) return;
  rooms = [];
  acMarkers = [];
  drawAll();
  renderRoomsList();
  resultsEl.innerHTML = "Δεν έχει γίνει ακόμη υπολογισμός.";
  acSuggestionsEl.innerHTML = "Προτάσεις κλιματιστικών θα εμφανιστούν μετά τον υπολογισμό.";
});
btnCalculate.addEventListener("click", () => {
  const arr = calculateAll();
  if (arr.length > 0) {
    renderResults(arr);
    renderSuggestions(arr);
  }
});

// ------------------ Render λίστας δωματίων ------------------ //
function renderRoomsList() {
  if (rooms.length === 0) {
    roomsListEl.innerHTML = "Δεν υπάρχουν δωμάτια ακόμη.";
    return;
  }

  roomsListEl.innerHTML = rooms
    .map((r, i) => {
      return `
      <div class="room-card">
        <div class="room-card-header">Δωμάτιο ${i + 1}</div>
        <div class="room-card-row">
          <label>m²:<br>
            <input type="number" step="0.1" value="${r.area || ""}"
              onchange="updateRoomField(${i}, 'area', this.value)">
          </label>
          <label>Ύψος (m):<br>
            <input type="number" step="0.1" value="${r.height || 2.7}"
              onchange="updateRoomField(${i}, 'height', this.value)">
          </label>
          <label>Παράθυρα (τεμ.):<br>
            <input type="number" value="${r.windows || 0}"
              onchange="updateRoomField(${i}, 'windows', this.value)">
          </label>
          <label>Μόνωση (1-3):<br>
            <input type="number" step="0.1" value="${r.ins || 1.0}"
              onchange="updateRoomField(${i}, 'ins', this.value)">
          </label>
        </div>
      </div>
    `;
    })
    .join("");
}

// Επιτρέπουμε στο HTML να καλεί αυτή τη συνάρτηση
window.updateRoomField = function (index, field, value) {
  const r = rooms[index];
  if (!r) return;
  if (field === "area" || field === "height" || field === "ins") {
    r[field] = parseFloat(value) || "";
  } else if (field === "windows") {
    r[field] = parseInt(value) || 0;
  }
};

// ------------------ Υπολογισμός BTU ------------------ //
function calcBTU(room) {
  const area = parseFloat(room.area) || 0;
  if (!area) return 0;

  // Βάση: 450–550 BTU/m² περίπου → παίρνουμε 500 για κατοικία
  let base = area * 500;

  // Ύψος: πάνω από 2.7 → μικρή αύξηση
  const height = parseFloat(room.height) || 2.7;
  if (height > 2.7) {
    base *= height / 2.7;
  }

  // Παράθυρα: κάθε παράθυρο προσθέτει περίπου 600 BTU
  const windows = parseInt(room.windows) || 0;
  base += windows * 600;

  // Μόνωση: 1=καλή, 2=μέτρια, 3=κακή
  const ins = parseFloat(room.ins) || 1.0;
  base *= ins;

  return Math.round(base);
}

function calculateAll() {
  if (rooms.length === 0) {
    alert("Δεν υπάρχουν δωμάτια για υπολογισμό.");
    return [];
  }
  return rooms.map((r, i) => {
    const btu = calcBTU(r);
    return {
      index: i,
      name: `Δωμάτιο ${i + 1}`,
      btu,
      area: r.area || "",
    };
  });
}

// ------------------ Εμφάνιση αποτελεσμάτων ------------------ //
function renderResults(arr) {
  let totalBTU = 0;
  arr.forEach((x) => (totalBTU += x.btu));

  let html = `
    <table class="results-table">
      <thead>
        <tr>
          <th>Δωμάτιο</th>
          <th>m²</th>
          <th>BTU</th>
          <th>Προτεινόμενη κατηγορία</th>
        </tr>
      </thead>
      <tbody>
  `;

  arr.forEach((x) => {
    let cat = "";
    if (x.btu <= 7000) cat = "7.000 BTU";
    else if (x.btu <= 10000) cat = "9.000 BTU";
    else if (x.btu <= 14000) cat = "12.000 BTU";
    else if (x.btu <= 20000) cat = "18.000 BTU";
    else cat = "24.000 BTU+";

    html += `
      <tr>
        <td>${x.name}</td>
        <td>${x.area || "-"}</td>
        <td>${x.btu}</td>
        <td>${cat}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top:6px;font-size:12px;">
      Συνολικό φορτίο (κατοικίας): <strong>${totalBTU} BTU</strong>
    </div>
  `;

  resultsEl.innerHTML = html;
}

// ------------------ Απλές προτάσεις κλιματιστικών ------------------ //
function renderSuggestions(arr) {
  if (!arr.length) {
    acSuggestionsEl.innerHTML = "Δεν υπάρχουν αποτελέσματα.";
    return;
  }

  // Θα πάρουμε τα 2 δωμάτια με το μεγαλύτερο φορτίο για 2 μονάδες
  const sorted = [...arr].sort((a, b) => b.btu - a.btu).slice(0, 2);

  const suggestions = sorted
    .map((x) => {
      let cat = "";
      let query = "";
      if (x.btu <= 7000) {
        cat = "7.000 BTU";
        query = "7000+btu+inverter";
      } else if (x.btu <= 10000) {
        cat = "9.000 BTU";
        query = "9000+btu+inverter";
      } else if (x.btu <= 14000) {
        cat = "12.000 BTU";
        query = "12000+btu+inverter";
      } else if (x.btu <= 20000) {
        cat = "18.000 BTU";
        query = "18000+btu+inverter";
      } else {
        cat = "24.000 BTU+";
        query = "24000+btu+inverter";
      }

      const skroutzUrl = `https://www.skroutz.gr/search?key=${encodeURIComponent(query)}`;
      const bestPriceUrl = `https://www.bestprice.gr/search?q=${encodeURIComponent(query)}`;

      return `
        <div class="room-card">
          <div class="room-card-header">${x.name}</div>
          <div class="room-card-row">
            <span>Φορτίο: <strong>${x.btu} BTU</strong> · Προτεινόμενη κατηγορία: <strong>${cat}</strong></span>
          </div>
          <div class="room-card-row">
            <span>Ζήτα προσφορές σε:</span>
          </div>
          <div class="room-card-row">
            <a href="${skroutzUrl}" target="_blank">Skroutz (${cat})</a>
            <a href="${bestPriceUrl}" target="_blank">BestPrice (${cat})</a>
          </div>
        </div>
      `;
    })
    .join("");

  acSuggestionsEl.innerHTML = suggestions;
}

// αρχικοποίηση
drawAll();
renderRoomsList();
resultsEl.innerHTML = "Δεν έχει γίνει ακόμη υπολογισμός.";
acSuggestionsEl.innerHTML = "Προτάσεις κλιματιστικών θα εμφανιστούν μετά τον υπολογισμό.";
