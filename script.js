// --- KONFIGURACJA WERSJI I PLIKÓW ---
const GLOBAL_PLAN_VERSION = "1.6"; // Zmień to, gdy zaktualizujesz pliki .tsv

const DEFAULT_PLANS_CONFIG = {
    "3-dniowy FBW - by Koziar": "basic1.tsv",
    "4-dniowy Upper/Lower - by Koziar": "basic2.tsv",
    "5-dniowy U/L/PPL - by Koziar": "basic3.tsv"
};

// Zmienne globalne
let plans = {};
let checks = {};
let currentPlan = "";
let editStates = {};
let lastMovedRow = null;

// Funkcja parsująca tekst TSV na format aplikacji
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
    return { notes, days: week, version: GLOBAL_PLAN_VERSION };
}

// Inicjalizacja Aplikacji (Pobieranie danych)
async function initApp() {
    plans = JSON.parse(localStorage.getItem("plans")) || {};
    checks = JSON.parse(localStorage.getItem("checks")) || {};
    currentPlan = localStorage.getItem("currentPlanName");

    // Pobieranie planów z plików .tsv przez fetch
    for (const [planName, fileName] of Object.entries(DEFAULT_PLANS_CONFIG)) {
        try {
            const response = await fetch(fileName);
            if (response.ok) {
                const text = await response.text();
                const parsed = parseTSV(text);
                
                // Aktualizuj jeśli nowa wersja lub brak planu w pamięci
                if (!plans[planName] || plans[planName].version !== GLOBAL_PLAN_VERSION) {
                    plans[planName] = parsed;
                }
            }
        } catch (err) {
            console.error(`Błąd fetch dla ${fileName}:`, err);
        }
    }

    if (!currentPlan || !plans[currentPlan]) {
        currentPlan = Object.keys(plans)[0] || "";
    }

    // Naprawa starych struktur
    Object.keys(plans).forEach(k => { if(Array.isArray(plans[k])) plans[k]={notes:"", days:plans[k]}; });

    // Inicjalizacja selecta
    const ps = document.getElementById("planSelect");
    if(ps) {
        ps.innerHTML = "";
        Object.keys(plans).sort().forEach(p => {
            const o = document.createElement("option"); o.value = p; o.textContent = p; ps.appendChild(o);
        });
        ps.value = currentPlan;
    }
    render();
}

function save() {
    localStorage.setItem("plans", JSON.stringify(plans));
    localStorage.setItem("checks", JSON.stringify(checks));
    localStorage.setItem("currentPlanName", currentPlan);
}

function autoHeight(el) { el.style.height = "auto"; el.style.height = (el.scrollHeight) + "px"; }
function saveNotes() { if (currentPlan) { plans[currentPlan].notes = document.getElementById("planNotes").value; save(); } }
function updDayName(di, val) { getDays()[di].name = val; save(); }
function getDays() { return (currentPlan && plans[currentPlan]) ? plans[currentPlan].days : []; }

function render() {
    const scrollPos = window.scrollY;
    const weekEl = document.getElementById("week");
    const notesEl = document.getElementById("planNotes");
    if(!weekEl || !currentPlan || !plans[currentPlan]) return;

    weekEl.innerHTML = "";
    notesEl.value = plans[currentPlan].notes || "";
    autoHeight(notesEl);

    getDays().forEach((day, di) => {
        const isEditing = editStates[di];
        const dayChecks = checks[currentPlan]?.[di] || {};
        const activeToday = Object.values(dayChecks).some(v => v);
        const d = document.createElement("div");
        d.className = "day " + (day.active ? '' : 'inactive ') + (isEditing ? 'editing ' : '') + (activeToday && day.active ? 'active-today' : '');
        
        let rowsHtml = day.rows.map((r, ri) => {
            const isMoved = (lastMovedRow && lastMovedRow.di === di && lastMovedRow.ri === ri);
            return `
                <tr class="${dayChecks[ri] ? 'done' : ''} ${isMoved ? 'moved-row' : ''}">
                    <td class="col-check"><input type="checkbox" ${dayChecks[ri] ? 'checked' : ''} onchange="toggleCheck(${di},${ri},this.checked)"></td>
                    <td class="ex-name"><input type="text" value="${r[0]||''}" oninput="updRow(${di},${ri},0,this.value)" placeholder="..."></td>
                    <td class="col-s"><input type="text" inputmode="decimal" value="${r[1]||''}" oninput="updRow(${di},${ri},1,this.value)"></td>
                    <td class="col-p"><input type="text" inputmode="decimal" value="${r[2]||''}" oninput="updRow(${di},${ri},2,this.value)"></td>
                    <td class="col-kg"><input type="text" inputmode="decimal" value="${r[3]||''}" oninput="updRow(${di},${ri},3,this.value)"></td>
                    <td class="edit-ui"><div class="row-ops"><div class="move-up-down"><button onclick="moveRow(${di},${ri},-1)">▲</button><button onclick="moveRow(${di},${ri},1)">▼</button></div><button onclick="delRow(${di},${ri})" style="color:var(--danger); border:none; background:none; font-size:18px;">✕</button></div></td>
                </tr>`;
        }).join('');

        d.innerHTML = `
            <div class="day-header">
                <input class="day-title-input" value="${day.name}" ${isEditing ? '' : 'readonly'} oninput="updDayName(${di}, this.value)">
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button class="icon-btn" style="height:32px; width:32px" onclick="toggleDay(${di})"><i data-lucide="${day.active ? 'pause' : 'play'}" style="width:14px"></i></button>
                    <button class="icon-btn ${isEditing ? 'gold' : ''}" style="height:32px; width:70px; font-size:10px; font-weight:bold" onclick="toggleEdit(${di})">${isEditing ? 'GOTOWE' : 'EDYTUJ'}</button>
                </div>
            </div>
            <table><thead><tr><th class="col-check">✔</th><th class="ex-name">Ćwiczenie</th><th class="col-s">S</th><th class="col-p">P</th><th class="col-kg">kg</th><th class="edit-ui">Opcje</th></tr></thead><tbody>${rowsHtml}</tbody></table>
            <button class="btn-add-row" onclick="addRow(${di})">+ DODAJ ĆWICZENIE</button>`;
        weekEl.appendChild(d);
    });
    if(window.lucide) lucide.createIcons();
    window.scrollTo(0, scrollPos);
    lastMovedRow = null;
}

function toggleEdit(di) { editStates[di] = !editStates[di]; render(); }
function addRow(di) { getDays()[di].rows.push(["", "", "", ""]); save(); render(); }
function delRow(di, ri) { if(confirm("Usunąć?")) { getDays()[di].rows.splice(ri, 1); save(); render(); } }
function moveRow(di, ri, dir) {
    const r = getDays()[di].rows; const t = ri + dir;
    if(t >= 0 && t < r.length) { [r[ri], r[t]] = [r[t], r[ri]]; lastMovedRow = { di, ri: t }; save(); render(); }
}
function updRow(di, ri, ci, v) { getDays()[di].rows[ri][ci] = v; save(); }
function toggleCheck(di, ri, v) { if(!checks[currentPlan]) checks[currentPlan] = {}; if(!checks[currentPlan][di]) checks[currentPlan][di] = {}; checks[currentPlan][di][ri] = v; save(); render(); }
function toggleDay(di) { getDays()[di].active = !getDays()[di].active; save(); render(); }
function resetWeek() { if(confirm("Zresetować postępy?")) { checks[currentPlan] = {}; save(); render(); } }
function loadPlan() { currentPlan = document.getElementById("planSelect").value; save(); render(); }

function newPlan() {
    const n = prompt("Nazwa planu:");
    if(n) { const dni = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]; plans[n] = { notes: "", days: dni.map(d => ({ name: d, active: true, rows: [] })) }; currentPlan = n; save(); location.reload(); }
}
function deletePlan() { if(confirm(`Usuń plan ${currentPlan}?`)) { delete plans[currentPlan]; currentPlan = Object.keys(plans)[0] || null; save(); location.reload(); } }

function openExport() {
    const out = []; const p = plans[currentPlan]; const notes = p.notes || "";
    out.push(`!!NOTES!!\t${notes.replace(/\n/g, "[BR]")}`);
    getDays().forEach(d => { out.push(`# ${d.name} | ${d.active ? "AKTYWNY" : "PRZERWA"}`); d.rows.forEach(r => out.push(r.join("\t"))); });
    document.getElementById("exportText").value = out.join("\n");
    document.getElementById("exportModal").classList.add("active");
}
function downloadTSV() {
    const t = document.getElementById("exportText").value; const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], {type:"text/tab-separated-values"}));
    a.download = currentPlan.replace(/\s/g, '_') + ".tsv"; a.click();
}
function openImport() { document.getElementById("importModal").classList.add("active"); }
function handleFileSelect(e) { const r = new FileReader(); r.onload = (e) => { document.getElementById("importText").value = e.target.result; }; r.readAsText(e.target.files[0]); }
function applyImport() {
    const data = parseTSV(document.getElementById("importText").value);
    if(data.days.length > 0) { plans[currentPlan] = data; save(); location.reload(); }
}
function closeModals() { document.querySelectorAll(".modal").forEach(m => m.classList.remove("active")); }

// Start
initApp();