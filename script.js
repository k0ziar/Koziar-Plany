const GLOBAL_PLAN_VERSION = "2.0"; 

const DEFAULT_PLANS_CONFIG = {
    "3-dniowy FBW - by Koziar": "basic1.tsv",
    "4-dniowy Upper/Lower - by Koziar": "basic2.tsv",
    "5-dniowy U/L/PPL - by Koziar": "basic3.tsv"
};

let plans = {};        
let remotePlans = {};  
let checks = {};
let currentPlan = "";
let editStates = {};

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
    plans = JSON.parse(localStorage.getItem("plans")) || {};
    checks = JSON.parse(localStorage.getItem("checks")) || {};
    currentPlan = localStorage.getItem("currentPlanName");

    for (const [planName, fileName] of Object.entries(DEFAULT_PLANS_CONFIG)) {
        try {
            const response = await fetch(fileName + "?v=" + new Date().getTime());
            if (response.ok) {
                const text = await response.text();
                remotePlans[planName] = parseTSV(text);
            }
        } catch (err) { console.error("Błąd pobierania:", fileName); }
    }

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
    const g1 = document.createElement("optgroup"); g1.label = "PROJEKTY KOZIAR";
    Object.keys(remotePlans).forEach(p => { const o = document.createElement("option"); o.value = p; o.textContent = p; g1.appendChild(o); });
    ps.appendChild(g1);
    const g2 = document.createElement("optgroup"); g2.label = "TWOJE KOPIE";
    Object.keys(plans).forEach(p => { const o = document.createElement("option"); o.value = p; o.textContent = p; g2.appendChild(o); });
    ps.appendChild(g2);
    ps.value = currentPlan;
}

function activatePlan() {
    if (!remotePlans[currentPlan]) return;
    const newName = prompt("Nazwij swoją kopię:", currentPlan + " - Kopia");
    if (newName) {
        plans[newName] = JSON.parse(JSON.stringify(remotePlans[currentPlan]));
        plans[newName].isRemote = false;
        currentPlan = newName;
        save(); refreshSelect(); render();
    }
}

function save() {
    localStorage.setItem("plans", JSON.stringify(plans));
    localStorage.setItem("checks", JSON.stringify(checks));
    localStorage.setItem("currentPlanName", currentPlan);
}

function render() {
    const weekEl = document.getElementById("week");
    const notesEl = document.getElementById("planNotes");
    if(!weekEl) return;
    const activePlanObj = plans[currentPlan] || remotePlans[currentPlan];
    if(!activePlanObj) return;

    const isRemote = activePlanObj.isRemote === true;
    weekEl.innerHTML = "";
    
    if(isRemote) {
        const btn = document.createElement("button");
        btn.className = "btn-activate";
        btn.innerText = "🚀 AKTYWUJ I EDYTUJ TEN PLAN";
        btn.onclick = activatePlan;
        weekEl.appendChild(btn);
    }

    notesEl.value = activePlanObj.notes || "";
    notesEl.readOnly = isRemote;
    autoHeight(notesEl);

    activePlanObj.days.forEach((day, di) => {
        const isEditing = editStates[di];
        const dayChecks = checks[currentPlan]?.[di] || {};
        const d = document.createElement("div");
        d.className = `day ${day.active ? '' : 'inactive'} ${isEditing ? 'editing' : ''}`;
        
        let rowsHtml = day.rows.map((r, ri) => `
            <tr class="${dayChecks[ri] ? 'done' : ''}">
                <td class="col-check"><input type="checkbox" ${dayChecks[ri] ? 'checked' : ''} onchange="toggleCheck(${di},${ri},this.checked)"></td>
                <td class="ex-name"><input type="text" value="${r[0]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},0,this.value)"></td>
                <td class="col-s"><input type="text" inputmode="decimal" value="${r[1]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},1,this.value)"></td>
                <td class="col-p"><input type="text" inputmode="decimal" value="${r[2]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},2,this.value)"></td>
                <td class="col-kg"><input type="text" inputmode="decimal" value="${r[3]||''}" ${isRemote ? 'readonly' : ''} oninput="updRow(${di},${ri},3,this.value)"></td>
                ${!isRemote ? `<td class="edit-ui"><button onclick="delRow(${di},${ri})" style="color:var(--danger);border:none;background:none;font-size:18px;">✕</button></td>` : ''}
            </tr>`).join('');

        d.innerHTML = `
            <div class="day-header">
                <input class="day-title-input" value="${day.name}" readonly>
                ${!isRemote ? `
                <div style="display:flex;gap:6px">
                    <button class="icon-btn-sm" onclick="toggleDay(${di})"><i data-lucide="${day.active ? 'pause' : 'play'}" style="width:14px"></i></button>
                    <button class="icon-btn-sm ${isEditing ? 'gold' : ''}" onclick="toggleEdit(${di})">${isEditing ? 'GOTOWE' : 'EDYTUJ'}</button>
                </div>` : ''}
            </div>
            <table><thead><tr><th class="col-check">✔</th><th style="text-align:left">Ćwiczenie</th><th class="col-s">S</th><th class="col-p">P</th><th class="col-kg">kg</th>${!isRemote ? '<th class="edit-ui"></th>' : ''}</tr></thead><tbody>${rowsHtml}</tbody></table>
            ${(!isRemote && isEditing) ? `<button class="btn-add-row" onclick="addRow(${di})">+ DODAJ ĆWICZENIE</button>` : ''}
        `;
        weekEl.appendChild(d);
    });
    if(window.lucide) lucide.createIcons();
}

function autoHeight(el) { el.style.height = "auto"; el.style.height = (el.scrollHeight) + "px"; }
function saveNotes() { if (plans[currentPlan] && !plans[currentPlan].isRemote) { plans[currentPlan].notes = document.getElementById("planNotes").value; save(); } }
function toggleEdit(di) { editStates[di] = !editStates[di]; render(); }
function addRow(di) { if(plans[currentPlan]) { plans[currentPlan].days[di].rows.push(["","","",""]); save(); render(); } }
function delRow(di, ri) { if(confirm("Usunąć?")) { plans[currentPlan].days[di].rows.splice(ri,1); save(); render(); } }
function updRow(di, ri, ci, v) { if(plans[currentPlan]) { plans[currentPlan].days[di].rows[ri][ci] = v; save(); } }
function toggleCheck(di, ri, v) { if(!checks[currentPlan]) checks[currentPlan] = {}; if(!checks[currentPlan][di]) checks[currentPlan][di] = {}; checks[currentPlan][di][ri] = v; save(); render(); }
function toggleDay(di) { if(plans[currentPlan]) { plans[currentPlan].days[di].active = !plans[currentPlan].days[di].active; save(); render(); } }
function resetWeek() { if(confirm("Zresetować postępy?")) { checks[currentPlan] = {}; save(); render(); } }
function loadPlan() { currentPlan = document.getElementById("planSelect").value; render(); }
function newPlan() { const n = prompt("Nazwa planu:"); if(n) { const dni = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]; plans[n] = { notes: "", days: dni.map(d => ({ name: d, active: true, rows: [] })), isRemote: false }; currentPlan = n; save(); location.reload(); } }
function deletePlan() { if(plans[currentPlan] && confirm(`Usuń plan ${currentPlan}?`)) { delete plans[currentPlan]; currentPlan = Object.keys(remotePlans)[0]; save(); location.reload(); } }

// Import/Export (Uproszczone)
function openExport() {
    const p = plans[currentPlan] || remotePlans[currentPlan];
    const out = [`!!NOTES!!\t${(p.notes||"").replace(/\n/g, "[BR]")}`];
    p.days.forEach(d => { out.push(`# ${d.name} | ${d.active ? "AKTYWNY" : "PRZERWA"}`); d.rows.forEach(r => out.push(r.join("\t"))); });
    document.getElementById("exportText").value = out.join("\n");
    document.getElementById("exportModal").classList.add("active");
}
function downloadTSV() { const t = document.getElementById("exportText").value; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], {type:"text/tab-separated-values"})); a.download = currentPlan.replace(/\s/g, '_') + ".tsv"; a.click(); }
function openImport() { document.getElementById("importModal").classList.add("active"); }
function handleFileSelect(e) { const r = new FileReader(); r.onload = (ev) => { document.getElementById("importText").value = ev.target.result; }; r.readAsText(e.target.files[0]); }
function applyImport() { const data = parseTSV(document.getElementById("importText").value); if(data.days.length > 0) { const n = prompt("Nazwa:"); if(n) { data.isRemote = false; plans[n] = data; currentPlan = n; save(); location.reload(); } } }
function closeModals() { document.querySelectorAll(".modal").forEach(m => m.classList.remove("active")); }

initApp();
