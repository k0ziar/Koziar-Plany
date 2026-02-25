const GLOBAL_PLAN_VERSION = "2.4"; 

const DEFAULT_PLANS_CONFIG = {
    "3-dniowy FBW - by Koziar": "basic1.tsv",
    "4-dniowy Upper/Lower - by Koziar": "basic2.tsv",
    "5-dniowy U/L/PPL - by Koziar": "basic3.tsv"
};

let plans = JSON.parse(localStorage.getItem("plans")) || {};
let remotePlans = {};
let checks = JSON.parse(localStorage.getItem("checks")) || {};
let currentPlan = localStorage.getItem("currentPlanName") || "";
let editStates = {};

// Parser TSV
function parseTSV(text) {
    const lines = text.trim().split("\n");
    const week = []; let day = null; let notes = "";
    lines.forEach(l => {
        if (l.startsWith("!!NOTES!!")) { 
            notes = l.split("\t")[1] ? l.split("\t")[1].replace(/\[BR\]/g, "\n") : ""; 
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
    for (const [planName, fileName] of Object.entries(DEFAULT_PLANS_CONFIG)) {
        try {
            const res = await fetch(fileName + "?v=" + new Date().getTime());
            if (res.ok) {
                const text = await res.text();
                remotePlans[planName] = parseTSV(text);
            }
        } catch (e) { console.error("TSV Error:", e); }
    }

    if (!currentPlan || (!plans[currentPlan] && !remotePlans[currentPlan])) {
        currentPlan = Object.keys(remotePlans)[0] || "";
    }
    refreshSelect();
    render();
}

function render() {
    const weekEl = document.getElementById("week");
    const notesEl = document.getElementById("planNotes");
    
    // SPRAWDZENIE CZY PLAN JEST ZABLOKOWANY
    const activePlan = plans[currentPlan] || remotePlans[currentPlan];
    if(!activePlan) return;

    // Twarda flaga blokady - jeśli plan jest w remotePlans, to jest locked
    const isLocked = remotePlans.hasOwnProperty(currentPlan);

    weekEl.innerHTML = "";
    
    // Jeśli zablokowany - pokaż przycisk aktywacji
    if(isLocked) {
        const btn = document.createElement("button");
        btn.className = "btn-activate";
        btn.innerText = "🚀 AKTYWUJ TEN PLAN DO EDYCJI";
        btn.onclick = activatePlan;
        weekEl.appendChild(btn);
    }

    // Blokada notatek
    notesEl.value = activePlan.notes || "";
    notesEl.readOnly = isLocked;
    autoHeight(notesEl);

    activePlan.days.forEach((day, di) => {
        const isEditing = editStates[di];
        const dayChecks = checks[currentPlan]?.[di] || {};
        const d = document.createElement("div");
        d.className = `day ${day.active ? '' : 'inactive'} ${isEditing ? 'editing' : ''}`;
        
        let rowsHtml = day.rows.map((r, ri) => `
            <tr class="${dayChecks[ri] ? 'done' : ''}">
                <td class="col-check"><input type="checkbox" ${dayChecks[ri] ? 'checked' : ''} onchange="toggleCheck(${di},${ri},this.checked)"></td>
                <td class="ex-name"><input type="text" value="${r[0]}" ${isLocked ? 'readonly' : ''} oninput="updRow(${di},${ri},0,this.value)"></td>
                <td class="col-s"><input type="text" inputmode="decimal" value="${r[1]}" ${isLocked ? 'readonly' : ''} oninput="updRow(${di},${ri},1,this.value)"></td>
                <td class="col-p"><input type="text" inputmode="decimal" value="${r[2]}" ${isLocked ? 'readonly' : ''} oninput="updRow(${di},${ri},2,this.value)"></td>
                <td class="col-kg"><input type="text" inputmode="decimal" value="${r[3]}" ${isLocked ? 'readonly' : ''} oninput="updRow(${di},${ri},3,this.value)"></td>
                ${(!isLocked && isEditing) ? `
                <td class="edit-ui">
                    <button onclick="delRow(${di},${ri})" style="color:var(--danger);border:none;background:none;font-size:18px;">✕</button>
                </td>` : ''}
            </tr>`).join('');

        d.innerHTML = `
            <div class="day-header">
                <input class="day-title-input" value="${day.name}" readonly>
                ${!isLocked ? `
                <div style="display:flex;gap:6px">
                    <button class="icon-btn-sm" onclick="toggleDay(${di})"><i data-lucide="${day.active ? 'pause' : 'play'}" style="width:14px"></i></button>
                    <button class="icon-btn-sm ${isEditing ? 'gold' : ''}" onclick="toggleEdit(${di})">${isEditing ? 'GOTOWE' : 'EDYTUJ'}</button>
                </div>` : ''}
            </div>
            <table>
                <thead><tr><th class="col-check">✔</th><th style="text-align:left">Ćwiczenie</th><th class="col-s">S</th><th class="col-p">P</th><th class="col-kg">kg</th>${(!isLocked && isEditing) ? '<th></th>' : ''}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            ${(!isLocked && isEditing) ? `<button class="btn-add-row" onclick="addRow(${di})">+ DODAJ ĆWICZENIE</button>` : ''}
        `;
        weekEl.appendChild(d);
    });
    if(window.lucide) lucide.createIcons();
}

// Funkcja kopiowania zablokowanego planu do Twoich planów
function activatePlan() {
    const newName = prompt("Podaj nazwę dla swojej edytowalnej kopii:", currentPlan + " - Moja");
    if (newName) {
        plans[newName] = JSON.parse(JSON.stringify(remotePlans[currentPlan]));
        plans[newName].isRemote = false;
        currentPlan = newName;
        save();
        refreshSelect();
        render();
    }
}

function refreshSelect() {
    const ps = document.getElementById("planSelect");
    if(!ps) return;
    ps.innerHTML = "";
    const g1 = document.createElement("optgroup"); g1.label = "PLANY KOZIAR (Zablokowane)";
    Object.keys(remotePlans).forEach(p => { g1.appendChild(new Option(p, p)); });
    ps.appendChild(g1);
    const g2 = document.createElement("optgroup"); g2.label = "TWOJE PLANY (Edytowalne)";
    Object.keys(plans).forEach(p => { g2.appendChild(new Option(p, p)); });
    ps.appendChild(g2);
    ps.value = currentPlan;
}

// Reszta funkcji bez zmian
function save() { localStorage.setItem("plans", JSON.stringify(plans)); localStorage.setItem("checks", JSON.stringify(checks)); localStorage.setItem("currentPlanName", currentPlan); }
function autoHeight(el) { el.style.height = "auto"; el.style.height = (el.scrollHeight) + "px"; }
function saveNotes() { if(plans[currentPlan]) { plans[currentPlan].notes = document.getElementById("planNotes").value; save(); } }
function toggleEdit(di) { editStates[di] = !editStates[di]; render(); }
function addRow(di) { plans[currentPlan].days[di].rows.push(["","","",""]); save(); render(); }
function delRow(di, ri) { if(confirm("Usunąć?")) { plans[currentPlan].days[di].rows.splice(ri,1); save(); render(); } }
function updRow(di, ri, ci, v) { if(plans[currentPlan]) { plans[currentPlan].days[di].rows[ri][ci] = v; save(); } }
function toggleCheck(di, ri, v) { if(!checks[currentPlan]) checks[currentPlan] = {}; if(!checks[currentPlan][di]) checks[currentPlan][di] = {}; checks[currentPlan][di][ri] = v; save(); render(); }
function toggleDay(di) { if(plans[currentPlan]) { plans[currentPlan].days[di].active = !plans[currentPlan].days[di].active; save(); render(); } }
function loadPlan() { currentPlan = document.getElementById("planSelect").value; render(); }
function resetWeek() { if(confirm("Zresetować?")) { checks[currentPlan] = {}; save(); render(); } }
function newPlan() { const n = prompt("Nazwa:"); if(n) { const dni = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]; plans[n] = { notes: "", days: dni.map(d => ({ name: d, active: true, rows: [] })), isRemote: false }; currentPlan = n; save(); location.reload(); } }
function deletePlan() { if(plans[currentPlan] && confirm("Usunąć?")) { delete plans[currentPlan]; currentPlan = Object.keys(remotePlans)[0]; save(); location.reload(); } }
function openExport() { /* ... kod eksportu ... */ }
function closeModals() { document.querySelectorAll(".modal").forEach(m => m.classList.remove("active")); }

initApp();
