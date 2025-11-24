// LOGIN
document.getElementById("loginBtn").onclick = () => {
    const pass = document.getElementById("loginPass").value.trim();
    if (pass === "fgb0911+") {
        document.getElementById("loginScreen").style.display = "none";
        loadPage("dashboard");
    } else {
        alert("Λάθος κωδικός");
    }
};

// Firebase init
const firebaseConfig = {
    apiKey: "AIzaSyAJlPDZktoQmDUIwQrCBsH_GLEhn5N6owE",
    authDomain: "mouhtis-suite.firebaseapp.com",
    projectId: "mouhtis-suite",
    storageBucket: "mouhtis-suite.firebasestorage.app",
    messagingSenderId: "1093547214312",
    appId: "1:1093547214312:web:83cc116f17b031f2ef105d",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Simple router
function loadPage(page) {
    const main = document.getElementById("mainContent");

    if (page === "dashboard") {
        main.innerHTML = `
        <h1>Πίνακας Ελέγχου</h1>
        <div class="card">Σύνοψη...</div>`;
    }

    if (page === "customers") {
        main.innerHTML = `
        <h1>Πελάτες</h1>
        <div class="card">Πελάτες...</div>`;
    }

    if (page === "tasks") {
        main.innerHTML = `
        <h1>Εργασίες</h1>
        <div class="card">Εργασίες...</div>`;
    }

    if (page === "projects") {
        main.innerHTML = `
        <h1>Έργα</h1>
        <div class="card">Έργα...</div>`;
    }

    if (page === "study") {
        main.innerHTML = `
        <h1>Μελέτη</h1>
        <div class="card">Μελέτη...</div>`;
    }
}

// Bind menu
document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.onclick = () => {
        loadPage(btn.dataset.page);
    };
});
