const REMOTE_FILES = {
    "3-dniowy FBW - by Koziar": "basic1.tsv",
    "4-dniowy Upper/Lower - by Koziar": "basic2.tsv",
    "5-dniowy U/L/PPL - by Koziar": "basic3.tsv"
};

let plans = JSON.parse(localStorage.getItem("plans")) || {};
let checks = JSON.parse(localStorage.getItem("checks")) || {};
let currentPlan = localStorage.getItem("currentPlanName") || "";
let editStates = {};
let currentEditingExercise = null; // { di, ri }

function save(){
    localStorage.setItem("plans", JSON.stringify(plans));
    localStorage.setItem("checks", JSON.stringify(checks));
    localStorage.setItem("currentPlanName", currentPlan);
}

function handleLogoClick() { document.getElementById("aboutModal").classList.add("active"); }

function showPlansInfo() { document.getElementById("plansInfoModal").classList.add("active"); }

function render() {
    const p = plans[currentPlan];
    const weekEl = document.getElementById("week");
    const lockedFooter = document.getElementById("lockedFooter");
    const proBtnEl = document.getElementById("proBtn");
    const planNotesEl = document.getElementById("planNotes");

    if(!p) {
        weekEl.innerHTML = "<div style='text-align:center;padding:100px 20px;color:#444;font-weight:700;'>STWÓRZ SWÓJ PIERWSZY PLAN LUB IMPORTUJ</div>";
        updateMenuVisibility(false);
        lockedFooter.style.display = "none";
        return;
    }

    const isLocked = p.isLocked;
    document.body.classList.toggle("locked-mode", isLocked);
    lockedFooter.style.display = isLocked ? "block" : "none";
    updateMenuVisibility(!isLocked);
    proBtnEl.classList.toggle("active-pro", p.proMode);
    
    planNotesEl.value = p.notes || "";
    planNotesEl.readOnly = isLocked;
    autoHeight(planNotesEl);

    weekEl.className = p.proMode ? "pro-mode" : "standard-mode";

    weekEl.innerHTML = p.days.map((day, di) => {
        const dayChecks = checks[currentPlan]?.[di] || {};
        const isEditing = editStates[di];
        const hasChecks = Object.values(dayChecks).some(v => v);

        return `
        <div class="day ${day.active?'':'inactive'} ${hasChecks && day.active ? 'active-today' : ''}">
            <div class="day-header">
                <input class="day-title-input" value="${day.name}" ${isEditing && !isLocked ? '' : 'readonly'} oninput="plans[currentPlan].days[${di}].name=this.value;save()">
                <div style="display:flex;gap:10px">
                    <button class="row-icon-btn" onclick="toggleDay(${di})" style="background:${day.active?'var(--gold)':'#222'}; border:none; border-radius:10px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:${day.active?'#000':'#666'}">
                        <i data-lucide="${day.active?'pause':'play'}" style="width:18px; height:18px"></i>
                    </button>
                    ${!isLocked ? `
                        <button class="row-icon-btn" onclick="toggleEdit(${di})" style="background:${isEditing?'#fff':'#222'}; border:none; border-radius:10px; width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:${isEditing?'#000':'#666'}">
                            <i data-lucide="edit-3" style="width:18px; height:18px"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="exercise-row header-row">
                <span>✔</span>
                <span>Ćwiczenie</span>
                <span>S</span>
                <span>P</span>
                <span>KG</span>
                <span class="col-pro-field">ODP</span>
                <span class="col-pro-field">RIR</span>
                <span class="col-pro-field">TMP</span>
                <span class="col-pro-field">PRG</span>
            </div>

            ${day.rows.map((r, ri) => `
                <div class="exercise-row ${dayChecks[ri]?'done':''}">
                    <div style="display:flex; justify-content:center;">
                        <input type="checkbox" ${dayChecks[ri]?'checked':''} onchange="toggleCheck(${di},${ri},this.checked)" ${isLocked ? 'disabled' : ''}>
                    </div>
                    
                    <input type="text" class="col-input name" value="${r[0]||''}" 
                        oninput="updRow(${di},${ri},0,this.value)" 
                        onclick="${!isEditing && !isLocked ? `openExerciseInfo(${di},${ri})` : ''}"
                        style="${!isEditing && r[7] && r[7] !== '...' ? 'border-bottom: 2px solid var(--gold); color:var(--gold);' : ''}"
                        ${isLocked ? 'readonly' : ''}>
                    
                    <input type="text" class="col-input" inputmode="decimal" value="${r[1]||''}" oninput="updRow(${di},${ri},1,this.value)" ${isLocked ? 'readonly' : ''}>
                    <input type="text" class="col-input" inputmode="decimal" value="${r[2]||''}" oninput="updRow(${di},${ri},2,this.value)" ${isLocked ? 'readonly' : ''}>
                    <input type="text" class="col-input" inputmode="decimal" value="${r[3]||''}" oninput="updRow(${di},${ri},3,this.value)" ${isLocked ? 'readonly' : ''}>
                    
                    <input type="text" class="col-input col-pro-field" value="${r[4]||''}" oninput="updRow(${di},${ri},4,this.value)" ${isLocked ? 'readonly' : ''}>
                    <input type="text" class="col-input col-pro-field" value="${r[5]||''}" oninput="updRow(${di},${ri},5,this.value)" ${isLocked ? 'readonly' : ''}>
                    <input type="text" class="col-input col-pro-field" value="${r[6]||''}" oninput="updRow(${di},${ri},6,this.value)" ${isLocked ? 'readonly' : ''}>
                    <input type="text" class="col-input col-pro-field" value="${r[8]||''}" oninput="updRow(${di},${ri},8,this.value)" ${isLocked ? 'readonly' : ''}>
                </div>
                ${isEditing ? `
                    <div class="edit-actions">
                        <button onclick="moveRow(${di},${ri},-1)" style="color:#fff;"><i data-lucide="arrow-up" style="width:14px"></i></button>
                        <button onclick="moveRow(${di},${ri},1)" style="color:#fff;"><i data-lucide="arrow-down" style="width:14px"></i></button>
                        <button onclick="delRow(${di},${ri})" style="color:var(--danger); border-color:var(--danger); font-size:11px; font-weight:700;"><i data-lucide="trash-2" style="width:14px; vertical-align:middle"></i> USUŃ</button>
                    </div>
                ` : ''}
            `).join('')}
            
            ${isEditing ? `<button class="btn-add-row" onclick="addRow(${di})">+ DODAJ NOWE ĆWICZENIE</button>` : ''}
        </div>`;
    }).join('');
    lucide.createIcons();
}

function updateMenuVisibility(full) {
    document.querySelectorAll(".edit-only").forEach(el => { el.style.display = full ? "flex" : "none"; });
}

function togglePro(){ if(!plans[currentPlan].isLocked) { plans[currentPlan].proMode = !plans[currentPlan].proMode; save(); render(); } }
function toggleDay(di){ if(!plans[currentPlan].isLocked) { plans[currentPlan].days[di].active = !plans[currentPlan].days[di].active; save(); render(); } }
function toggleEdit(di){ if(!plans[currentPlan].isLocked) { editStates[di] = !editStates[di]; render(); } }
function updRow(di,ri,ci,v){ if(!plans[currentPlan].isLocked){ plans[currentPlan].days[di].rows[ri][ci]=v; save(); } }
function addRow(di){ plans[currentPlan].days[di].rows.push(["","","","","","","","...",""]); save(); render(); }
function delRow(di,ri){ if(confirm("Usunąć ćwiczenie?")){ plans[currentPlan].days[di].rows.splice(ri,1); save(); render(); } }

function moveRow(di, ri, dir) {
    const rows = plans[currentPlan].days[di].rows;
    const target = ri + dir;
    if(target >= 0 && target < rows.length) {
        [rows[ri], rows[target]] = [rows[target], rows[ri]];
        save();
        render();
        
        // Podświetlenie przesuwanego wiersza
        setTimeout(() => {
            const dayElements = document.querySelectorAll(`.day`);
            if(dayElements[di]) {
                const exerciseRows = dayElements[di].querySelectorAll(`.exercise-row:not(.header-row)`);
                if(exerciseRows[target]) {
                    exerciseRows[target].classList.add('highlight');
                    setTimeout(() => exerciseRows[target].classList.remove('highlight'), 600);
                }
            }
        }, 10);
    }
}

function activatePlan() {
    const p = plans[currentPlan];
    const newName = prompt("Nazwij swoją kopię planu:", currentPlan.replace(" - by Koziar", ""));
    if(newName) {
        const copy = JSON.parse(JSON.stringify(p));
        copy.isLocked = false;
        plans[newName] = copy;
        currentPlan = newName;
        save(); initSelect(); render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function newPlan() {
    const n = prompt("Nazwa nowego planu:");
    if(n && n.trim()) {
        if(plans[n]) {
            alert("Plan z taką nazwą już istnieje!");
            return;
        }
        plans[n] = { 
            notes: "", 
            days: ["Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota","Niedziela"].map(d=>({name:d,active:true,rows:[]})), 
            isLocked: false, proMode: false 
        };
        currentPlan = n; save(); initSelect(); render();
    }
}

function deletePlan(){ if(confirm("Usunąć bezpowrotnie ten plan?")) { delete plans[currentPlan]; currentPlan = Object.keys(plans)[0] || ""; save(); location.reload(); } }
function resetWeek(){ if(confirm("Zresetować wszystkie odznaczenia (ptaszki)?")) { checks[currentPlan] = {}; save(); render(); } }

function toggleCheck(di,ri,v){
    if(!checks[currentPlan]) checks[currentPlan] = {};
    if(!checks[currentPlan][di]) checks[currentPlan][di] = {};
    checks[currentPlan][di][ri] = v; save(); render();
}



function openExerciseInfo(di,ri){
    currentEditingExercise = {di, ri};
    const row = plans[currentPlan].days[di].rows[ri];
    document.getElementById("editExerciseName").value = row[0] || "";
    const desc = row[7] === "..." ? "" : (row[7] || "");
    document.getElementById("editExerciseDesc").value = desc;
    document.getElementById("editExerciseDesc").focus();
    document.getElementById("editExerciseModal").classList.add("active");
}

function saveExerciseInfo(){
    if(!currentEditingExercise) return;
    const {di, ri} = currentEditingExercise;
    const newName = document.getElementById("editExerciseName").value.trim() || plans[currentPlan].days[di].rows[ri][0];
    const newDesc = document.getElementById("editExerciseDesc").value.trim();
    
    plans[currentPlan].days[di].rows[ri][0] = newName;
    plans[currentPlan].days[di].rows[ri][7] = newDesc || "...";
    
    currentEditingExercise = null;
    save();
    render();
    closeModals();
}

function showInfo(title, content) {
    if(!content || content === "...") return;
    document.getElementById("infoTitle").innerText = title;
    document.getElementById("infoContent").innerText = content;
    document.getElementById("infoModal").classList.add("active");
}

function closeModals() { document.querySelectorAll(".modal").forEach(m => m.classList.remove("active")); }

// zamykanie modali po kliknięciu w tło
document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => {
        if(e.target === m) closeModals();
    });
});

function openExport() {
    const p = plans[currentPlan];
    let out = [`!!NOTES!!\t${(p.notes||"").replace(/\n/g,"[BR]")}`];
    p.days.forEach(d => {
        out.push(`# ${d.name} | ${d.active?'AKTYWNY':'PRZERWA'}`);
        d.rows.forEach(r => out.push(r.join("\t")));
    });
    document.getElementById("exportText").value = out.join("\n");
    document.getElementById("exportModal").classList.add("active");
}

function downloadTSV() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([document.getElementById("exportText").value], {type: "text/tab-separated-values"}));
    a.download = currentPlan + ".tsv"; a.click();
}

function openImport() { document.getElementById("importModal").classList.add("active"); }
function handleFileSelect(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onerror = () => alert("Błąd wczytywania pliku!");
    reader.onload = (ev) => { document.getElementById("importText").value = ev.target.result; };
    reader.readAsText(file);
}

function applyImport() {
    const txt = document.getElementById("importText").value.trim();
    if(!txt) return;
    const imported = parseTSV(txt);
    let name = prompt("Nazwa planu:", "Import " + new Date().toLocaleDateString());
    if(name && name.trim()) {
        if(plans[name]) {
            const overwrite = confirm("Plan o tej nazwie istnieje! Nadpisać?");
            if(!overwrite) return;
        }
        plans[name] = imported; currentPlan = name; save(); location.reload();
    }
}

function parseTSV(text) {
    const lines = text.trim().split("\n");
    let week = [], day = null, notes = "";
    lines.forEach(l => {
        if(l.startsWith("!!NOTES!!")) notes = l.split("\t")[1]?.replace(/\[BR\]/g,"\n") || "";
        else if(l.startsWith("#")) {
            const parts = l.replace("#","").split("|").map(x=>x.trim());
            day = { name: parts[0], active: parts[1] !== "PRZERWA", rows: [] };
            week.push(day);
        } else if(day && l.trim()) {
            let row = l.split("\t"); while(row.length < 9) row.push(""); day.rows.push(row);
        }
    });
    return { notes, days: week, proMode: false, isLocked: false };
}

function initSelect() {
    const ps = document.getElementById("planSelect"); ps.innerHTML = "";
    const gL = document.createElement("optgroup"); gL.label = "📋 KLASYKI KOZIARA";
    const gU = document.createElement("optgroup"); gU.label = "💪 TWOJE PLANY";
    Object.keys(plans).sort().forEach(k => {
        const o = new Option(k, k);
        if(plans[k].isLocked) gL.appendChild(o); else gU.appendChild(o);
    });
    ps.add(gL); ps.add(gU); ps.value = currentPlan;
}

async function fetchRemotePlans() {
    for(const [name, file] of Object.entries(REMOTE_FILES)) {
        try {
            const r = await fetch(file);
            if(r.ok) {
                const text = await r.text();
                const parsed = parseTSV(text);
                parsed.isLocked = true; 
                plans[name] = parsed;
            }
        } catch(e) {}
    }
    if(!currentPlan || !plans[currentPlan]) currentPlan = Object.keys(plans)[0] || "";
    initSelect(); render();
}

function loadPlan(){ currentPlan=document.getElementById("planSelect").value; editStates={}; save(); render(); }
function autoHeight(el){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; }
function saveNotes(){ if(plans[currentPlan] && !plans[currentPlan].isLocked){ plans[currentPlan].notes=document.getElementById("planNotes").value; save(); }}

fetchRemotePlans();
