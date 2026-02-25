// --- KONFIGURACJA ---
const GLOBAL_PLAN_VERSION = "1.7"; 

const DEFAULT_PLANS_CONFIG = {
    "3-dniowy FBW - by Koziar": "basic1.tsv",
    "4-dniowy Upper/Lower - by Koziar": "basic2.tsv",
    "5-dniowy U/L/PPL - by Koziar": "basic3.tsv"
};

let plans = {};        // Tutaj będą plany użytkownika (z localStorage)
let remotePlans = {};  // Tutaj będą plany zablokowane (z GitHub)
let checks = {};
let currentPlan = "";
let editStates = {};
let lastMovedRow = null;

function parseTSV(text) {
    const lines = text.trim().split("\n");
    const week = []; let day = null; let notes = "";
    lines.forEach(l => {
        if (l.startsWith("!!NOTES!!")) { 
            const p = l.split("\t"); notes = p[1] ? p[1].replace(/\[BR\]/g, "\n") : ""; 
        } else if (l.startsWith("#")) {
            const p = l.replace("#", "").split("|").map(x => x.trim());
            day = { name: p[0], active: p[1] === "AKTYWNY", rows: [] };
            week.push(day);
        } else if (day && l.trim()) {
            let row = l.split("\t").map(x => x.trim());
            while(row.length < 4) row.push("");
            day.rows.push(row);
        }
    });
    return { notes, days: week, version: GLOBAL_PLAN_VERSION, isRemote: true };
}

async function initApp() {
    // 1. Pobierz plany użytkownika
    plans = JSON.parse(localStorage.getItem("plans")) || {};
    checks = JSON.parse(localStorage.getItem("checks")) || {};
    currentPlan = localStorage.getItem("currentPlanName");

    // 2. Pobierz plany zablokowane z GitHub
    for (const [planName, fileName] of Object.entries(DEFAULT_PLANS_CONFIG)) {
        try {
            const response = await fetch(fileName + "?t=" + new Date().getTime()); // Cache-buster
            if (response.ok) {
                const text = await response.text();
                remotePlans[planName] = parseTSV(text);
            }
        } catch (err) { console.error("Błąd pobierania:", fileName); }
    }

    // Jeśli brak wybranego planu, pokaż pierwszy dostępny zablokowany
    if (!currentPlan || (!plans[currentPlan] && !remotePlans[currentPlan])) {
        currentPlan = Object.keys(remotePlans)[0] || "";
    }

    refreshSelect();
    render();
}

function refreshSelect() {
    const ps = document.getElementById("planSelect");
    if(!ps) return;
    ps.innerHTML = "";
    
    // Grupa planów zablokowanych
    const g1 = document.createElement("optgroup");
    g1.label = "PROJEKTY KOZIAR (Zablokowane)";
    Object.keys(remotePlans).sort().forEach(p => {
        const o = document.createElement("option"); o.value = p; o.textContent = "⭐ " + p; g1.appendChild(o);
    });
    ps.appendChild(g1);

    // Grupa planów użytkownika
    const userKeys = Object.keys(plans);
    if(userKeys.length > 0) {
        const g2 = document.createElement("optgroup");
        g2.label = "TWOJE KOPIE (Edytowalne)";
        userKeys.sort().forEach(p => {
            const o = document.createElement("option"); o.value = p; o.textContent = "👤 " + p; g2.appendChild(o);
        });
        ps.appendChild(g2);
    }
    ps.value = currentPlan;
}

// FUNKCJA AKTYWACJI (KOPIOWANIA)
function activatePlan() {
    if (!remotePlans[currentPlan]) return;
    
    const newName = prompt("Jak chcesz nazwać swoją kopię?", currentPlan + " - Kopia");
    if (newName) {
        // Głęboka kopia obiektu
        const copy = JSON.parse(JSON.stringify(remotePlans[currentPlan]));
        copy.isRemote = false; // Ta wersja jest już edytowalna
        plans[newName] = copy;
        currentPlan = newName;
        save();
        refreshSelect();
        render();
        alert("Plan aktywowany! Teraz możesz go edytować.");
    }
}

function save() {
    localStorage.setItem("plans", JSON.stringify(plans));
    localStorage.setItem("checks", JSON.stringify(checks));
    localStorage.setItem("currentPlanName", currentPlan);
}

function render() {
    const scrollPos = window.scrollY;
    const weekEl = document.getElementById("week");
    const notesEl = document.getElementById("planNotes");
    if(!weekEl) return;
    
    // Sprawdzamy czy plan jest zdalny (zablokowany)
    const activePlanObj = plans[currentPlan] || remotePlans[currentPlan];
    if(!activePlanObj) return;

    const isRemote = activePlanObj.isRemote === true;
    weekEl.innerHTML = "";
    
    // Przycisk aktywacji jeśli plan jest zablokowany
    if(isRemote) {
        const btnBox = document.createElement("div");
        btnBox.innerHTML = `<button onclick="activatePlan()" class="btn-activate">🚀 AKTYWUJ TEN PLAN (UTWÓRZ KOPIĘ)</button>`;
        weekEl.appendChild(btnBox);
        weekEl.classList.add("remote-view");
    } else {
        weekEl.classList.remove("remote-view");
    }

    notesEl.value = activePlanObj.notes || "";
    notesEl.readOnly = isRemote;
    autoHeight(notesEl);

    activePlanObj.days.forEach((day, di) => {
        const isEditing = editStates[di];
        const dayChecks = checks[currentPlan]?.[di] || {};
        const d = document.createElement("div");
        d.className = `day ${day.active ? '' : 'inactive'} ${isEditing ? 'editing' : ''} ${isRemote ? 'readonly-day' : ''}`;
        
        let rowsHtml = day.rows.map((r, ri) => `
            <tr class="${dayChecks[ri] ? 'done' : ''}">
                <td class="col-check"><input type="checkbox" ${dayChecks[ri] ? 'checked' : ''} onchange="toggleCheck(${di},${ri},this.checked)"></td>
                <td class="ex-name"><input type="text" value="${r[0]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},0,this.value)"></td>
                <td class="col-s"><input type="text" value="${r[1]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},1,this.value)"></td>
                <td class="col-p"><input type="text" value="${r[2]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},2,this.value)"></td>
                <td class="col-kg"><input type="text" value="${r[3]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},3,this.value)"></td>
                ${!isRemote ? `<td class="edit-ui"><div class="row-ops"><button onclick="delRow(${di},${ri})">✕</button></div></td>` : '<td class="edit-ui"></td>'}
            </tr>`).join('');

        d.innerHTML = `
            <div class="day-header">
                <input class="day-title-input" value="${day.name}" readonly>
                ${!isRemote ? `
                <div style="display:flex; gap:6px;">
                    <button class="icon-btn" onclick="toggleDay(${di})"><i data-lucide="${day.active ? 'pause' : 'play'}" style="width:14px"></i></button>
                    <button class="icon-btn ${isEditing ? 'gold' : ''}" onclick="toggleEdit(${di})">${isEditing ? 'GOTOWE' : 'EDYTUJ'}</button>
                </div>` : ''}
            </div>
            <table><tbody>${rowsHtml}</tbody></table>
            ${(!isRemote && isEditing) ? `<button class="btn-add-row" onclick="addRow(${di})">+ DODAJ</button>` : ''}
        `;
        weekEl.appendChild(d);
    });
    if(window.lucide) lucide.createIcons();
    window.scrollTo(0, scrollPos);
}

// --- RESZTA FUNKCJI POMOCNICZYCH ---
function autoHeight(el) { el.style.height = "auto"; el.style.height = (el.scrollHeight) + "px"; }
function saveNotes() { if (plans[currentPlan]) { plans[currentPlan].notes = document.getElementById("planNotes").value; save(); } }
function toggleEdit(di) { editStates[di] = !editStates[di]; render(); }
function addRow(di) { if(plans[currentPlan]) { plans[currentPlan].days[di].rows.push(["","","",""]); save(); render(); } }
function delRow(di, ri) { if(confirm("Usunąć?")) { plans[currentPlan].days[di].rows.splice(ri,1); save(); render(); } }
function updRow(di, ri, ci, v) { if(plans[currentPlan]) { plans[currentPlan].days[di].rows[ri][ci] = v; save(); } }
function toggleCheck(di, ri, v) { 
    if(!checks[currentPlan]) checks[currentPlan] = {}; 
    if(!checks[currentPlan][di]) checks[currentPlan][di] = {}; 
    checks[currentPlan][di][ri] = v; save(); render(); 
}
function toggleDay(di) { if(plans[currentPlan]) { plans[currentPlan].days[di].active = !plans[currentPlan].days[di].active; save(); render(); } }
function resetWeek() { if(confirm("Zresetować postępy?")) { checks[currentPlan] = {}; save(); render(); } }
function loadPlan() { currentPlan = document.getElementById("planSelect").value; render(); }
function newPlan() {
    const n = prompt("Nazwa planu:");
    if(n) { 
        const dni = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]; 
        plans[n] = { notes: "", days: dni.map(d => ({ name: d, active: true, rows: [] })), isRemote: false }; 
        currentPlan = n; save(); location.reload(); 
    }
}
function deletePlan() { 
    if(plans[currentPlan] && confirm(`Usuń plan ${currentPlan}?`)) { 
        delete plans[currentPlan]; currentPlan = Object.keys(remotePlans)[0]; save(); location.reload(); 
    } 
}

initApp();
