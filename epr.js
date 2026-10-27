/* ================= The ward computer: one patient's record ================= */
const PT = { name:'Robin Training', bed:4, dob:'22/07/1968', age:58, nhs:'999 345 6780', allergy:'Penicillin (rash)', consultant:'Dr Demo', admitted:'24/10/2026', reason:'a chest infection' };
const t0 = Date.now();
const now = () => { const mins = 22*60 + 4 + Math.floor((Date.now() - t0)/60000); return `${String(Math.floor(mins/60)%24).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`; };
const newsCls = n => n >= 7 ? 'high' : n >= 5 ? 'mid' : 'low';
const HR_OPTIONS = [58, 72, 88, 104];
const OBS = [
  { t:'18:00', hr:74, bp:'104/64', rr:17, spo2:'97%', temp:'37.0', news:1 },
  { t:'14:00', hr:71, bp:'112/70', rr:16, spo2:'97%', temp:'37.1', news:0 },
  { t:'10:00', hr:70, bp:'118/72', rr:16, spo2:'98%', temp:'36.9', news:0 }
];
const MEDS = [
  { id:'para', drug:'Paracetamol', dose:'1 g', route:'Oral', times:'06:00, 12:00, 18:00, 22:00', last:'18:00' },
  { id:'aml', drug:'Amlodipine', dose:'5 mg', route:'Oral', times:'08:00', last:'08:00' },
  { id:'ome', drug:'Omeprazole', dose:'20 mg', route:'Oral', times:'08:00', last:'08:00' },
  { id:'enox', drug:'Enoxaparin', dose:'40 mg', route:'Subcutaneous', times:'18:00', last:'18:00' }
];
const NAV = [['summary','Summary'],['obs','Assessments and observations'],['drugs','Drug chart'],['notes','Clinical notes'],['results','Results'],['care','Care plan'],['fluids','Fluid balance']];
let E;
function resetEPR(){
  E = { loggedIn:false, page:'summary', obsOpened:false, chartViewed:false,
        hrForm:false, hrChoice:null, hrError:null, hrConfirm:false, hrLogged:null,
        admin:false, adminConfirm:false, signed:null, flash:null,
        notes:[{ t:'21:40', by:'Staff nurse', text:'Settled this evening. Eating and drinking well. Mobilising to the toilet with one assist.' },
               { t:'14:20', by:'Dr Demo', text:'Ward round. Chest sounds improving. Repeat bloods tomorrow morning.' }] };
}
resetEPR();
let flashT = null;
function flash(ok, title, text){ E.flash = { ok, title, text }; clearTimeout(flashT); flashT = setTimeout(() => { E.flash = null; renderEPR(); }, 10000); }

function pSummary(){
  const st = (v, t) => v ? `<span class="muted">Done ${t}</span>` : '<span class="due-txt">Due</span>';
  return `<h1>Summary</h1>
  <dl class="kv"><dt>Admitted</dt><dd>${PT.admitted}, ${PT.reason}</dd><dt>Consultant</dt><dd>${PT.consultant}</dd>
    <dt>Latest NEWS2</dt><dd>1 at 18:00</dd><dt>Allergies</dt><dd class="flag">${PT.allergy}</dd></dl>
  <h2>Due tonight</h2>
  <table class="t"><tbody>
    <tr><td>Heart rate</td><td>22:00</td><td class="r">${st(E.hrLogged, E.hrLogged && E.hrLogged.t)}</td></tr>
    <tr><td>Paracetamol 1 g oral</td><td>22:00</td><td class="r">${st(E.signed, E.signed)}</td></tr>
    <tr><td>Pressure area check</td><td>00:00</td><td class="r"><span class="muted">Later</span></td></tr>
  </tbody></table>`;
}
function pObs(){
  const rows = (E.hrLogged ? [{ t:E.hrLogged.t, hr:E.hrLogged.hr, fresh:true }] : []).concat(OBS);
  const form = !E.hrForm
    ? `<div class="row"><span><b>Heart rate</b> <span class="muted">due 22:00</span></span><button class="btn primary" type="button" data-e="hrform">Record heart rate</button></div>`
    : `<div class="row"><b>Heart rate (bpm)</b>${HR_OPTIONS.map(v => `<label class="radio"><input type="radio" name="hr" data-e="hrpick" data-v="${v}" ${E.hrChoice === v ? 'checked' : ''}>${v}</label>`).join('')}</div>
       ${E.hrError ? `<div class="notice err" role="alert">${E.hrError}</div>` : ''}
       <div class="actions"><button class="btn" type="button" data-e="hrcancel">Cancel</button><button class="btn primary" type="button" data-e="hrconfirm" ${E.hrChoice ? '' : 'disabled'}>Confirm</button></div>`;
  return `<h1>Assessments and observations</h1>
  ${E.hrLogged ? `<div class="notice" role="status">Heart rate logged: ${E.hrLogged.hr} bpm at ${E.hrLogged.t}.</div>` : ''}
  <div class="form">${form}</div>
  <table class="t"><thead><tr><th>Time</th><th>Heart rate</th><th>BP</th><th>Resp rate</th><th>SpO₂</th><th>Temp</th><th>NEWS2</th></tr></thead><tbody>
  ${rows.map(r => `<tr${r.fresh ? ' class="new"' : ''}><td>${r.t}</td><td>${r.hr}</td><td>${r.bp || '–'}</td><td>${r.rr || '–'}</td><td>${r.spo2 || '–'}</td><td>${r.temp || '–'}</td><td>${r.news === undefined ? '–' : r.news}</td></tr>`).join('')}
  </tbody></table>`;
}
function pDrugs(){
  const row = m => {
    const due = m.id === 'para' && !E.signed;
    const status = m.id === 'para' ? (E.signed ? `<span class="muted">Given ${E.signed}</span>` : '<span class="due-txt">Due 22:00</span>') : `<span class="muted">Given ${m.last}</span>`;
    return `<tr${due ? ' class="due"' : ''}><td>${m.drug}</td><td>${m.dose}</td><td>${m.route}</td><td>${m.times.replace(/, /g, '  ')}</td><td>${status}</td><td class="r">${due ? '<button class="btn primary" type="button" data-e="admin">Administer</button>' : ''}</td></tr>`;
  };
  return `<h1>Drug chart</h1>
  ${E.signed ? `<div class="notice" role="status">Paracetamol 1 g recorded as given at ${E.signed} by Demo nurse.</div>` : ''}
  <h2 style="margin-top:0">Regular</h2>
  <table class="t"><thead><tr><th>Medicine</th><th>Dose</th><th>Route</th><th>Times</th><th>Status</th><th></th></tr></thead><tbody>${MEDS.map(row).join('')}</tbody></table>
  <h2>When required</h2>
  <table class="t"><tbody><tr><td>Ondansetron</td><td>4 mg</td><td>IV</td><td>Up to 3 times a day</td><td><span class="muted">Not given</span></td><td></td></tr></tbody></table>`;
}
function pNotes(){
  return `<h1>Clinical notes</h1>
  ${E.notes.map(n => `<div class="note"><div class="h">${n.t}, ${n.by}</div>${n.text}</div>`).join('')}
  <h2><label for="noteText">Add a note</label></h2>
  <textarea id="noteText"></textarea>
  <button class="btn primary" type="button" data-e="addnote">Save note</button>`;
}
function pResults(){
  const r = [['Haemoglobin','128 g/L','130 to 170',true],['White cell count','13.2 ×10⁹/L','4.0 to 11.0',true],['CRP','86 mg/L','under 5',true],['Sodium','138 mmol/L','133 to 146',false],['Potassium','4.1 mmol/L','3.5 to 5.3',false],['Creatinine','78 µmol/L','60 to 110',false]];
  return `<h1>Results</h1><p class="muted" style="margin:-6px 0 12px">Bloods, 26/10/2026 07:30</p>
  <table class="t"><thead><tr><th>Test</th><th>Result</th><th>Range</th></tr></thead><tbody>
  ${r.map(([t,v,n,flag]) => `<tr><td>${t}</td><td${flag ? ' class="flag"' : ''}>${v}${flag ? ' H' : ''}</td><td class="muted">${n}</td></tr>`).join('')}</tbody></table>`;
}
function pCare(){
  const c = [['Breathing','Sit upright. Deep breathing every hour while awake.'],['Mobility','Walks with one assist. Call bell within reach.'],['Skin','Check pressure areas every 4 hours.'],['Nutrition','Normal diet. Encourage fluids.']];
  return `<h1>Care plan</h1><dl class="kv">${c.map(([h,t]) => `<dt>${h}</dt><dd>${t}</dd>`).join('')}</dl>`;
}
function pFluids(){
  return `<h1>Fluid balance</h1><p class="muted" style="margin:-6px 0 12px">Since 08:00</p>
  <dl class="kv"><dt>Intake</dt><dd>1,450 mL (oral 1,150, IV 300)</dd><dt>Output</dt><dd>1,100 mL urine</dd><dt>Balance</dt><dd>+350 mL</dd><dt>Target</dt><dd>2 L oral</dd></dl>`;
}
const dlg = (title, body, foot, close) => `<div class="dlg-bg"><div class="dlg" role="dialog" aria-modal="true" aria-label="${title}"><h3>${title}${close ? `<button type="button" data-e="${close}" aria-label="Close">×</button>` : ''}</h3><div class="bd">${body}</div><div class="ft">${foot}</div></div></div>`;
function mHr(){
  return dlg('Confirm observation', `Heart rate <b>${E.hrChoice} bpm</b> for TRAINING, Robin at ${now()}.`,
    `<button class="btn" type="button" data-e="hrback">Cancel</button><button class="btn primary" type="button" data-e="hrok">OK</button>`);
}
function mAdmin(){
  const n = [WS.wristScanned, WS.paraScanned, WS.given].filter(Boolean).length;
  const row = (k, ok, title, todo, doneText, at) => `<li class="${ok ? 'ok' : ''}"><span class="n">${ok ? '✓' : k}</span><div><b>${title}</b><span class="s">${ok ? doneText : todo}</span></div><span class="tag ${ok ? 'done' : ''}">${ok ? `Done${at ? ' ' + at : ''}` : 'To do'}</span></li>`;
  return dlg('Administer paracetamol 1 g oral', `<p class="muted" style="margin:0 0 10px">Due 22:00. Last given 18:00. Complete these checks at the bedside, then record the dose.</p>
    <ol class="chk">
      ${row(1, WS.wristScanned, 'Confirm the patient’s identity', 'Scan the patient’s wristband.', 'Wristband scanned: TRAINING, Robin. NHS 999 345 6780.', WS.wristAt)}
      ${row(2, WS.paraScanned, 'Check the medicine', 'Scan the paracetamol pack.', 'Paracetamol 500 mg × 2 = 1 g. Matches the prescription.', WS.paraAt)}
      ${row(3, WS.given, 'Give the medicine', 'Give it to the patient and check they take it.', 'Taken by the patient.', WS.givenAt)}
    </ol>`,
    `<span class="muted">${n} of 3 checks complete</span><button class="btn" type="button" data-e="adminclose">Close</button><button class="btn primary" type="button" data-e="adminrecord" ${n === 3 ? '' : 'disabled'}>Record as given</button>`, 'adminclose');
}
function mAdminConfirm(){
  return dlg('Confirm administration', `Paracetamol <b>1 g oral</b> given to TRAINING, Robin at ${now()}.`,
    `<button class="btn" type="button" data-e="adminback">Cancel</button><button class="btn primary" type="button" data-e="adminok">OK</button>`);
}
function mFlash(){
  const f = E.flash;
  return `<div class="scan-bg"><div class="scan ${f.ok ? '' : 'bad'}" role="alert"><h2><span>${f.ok ? '✓' : '✕'}</span> ${f.title}</h2><p>${f.text}</p><button class="btn primary" type="button" data-e="flashok">OK</button></div></div>`;
}
function renderEPR(){
  let html;
  if(!E.loggedIn){
    html = `<div class="lock"><div class="clock">${now()}</div><div class="where">Ward 7, Bay B</div><p>Tap your smartcard, or log in to the demo.</p><button class="btn primary" type="button" data-e="login">Log in</button></div>`;
  } else {
    const page = { summary:pSummary, obs:pObs, drugs:pDrugs, notes:pNotes, results:pResults, care:pCare, fluids:pFluids }[E.page]();
    html = `<div class="app">
      <div class="topbar"><span class="name">Ward EPR</span><span>Ward 7, Bay B</span><span>Demo nurse</span><span id="eprClock">${now()}</span><button class="btn" type="button" data-e="lock">Log out</button></div>
      <div class="ptbar"><span class="nm">TRAINING, Robin</span><span class="meta">Bed ${PT.bed}</span><span class="meta">DOB ${PT.dob} (${PT.age}y)</span><span class="meta">NHS ${PT.nhs}</span><span class="alg">Allergy: Penicillin</span></div>
      <nav class="nav" aria-label="Patient record">${NAV.map(([k, l]) => `<button type="button" data-e="nav" data-v="${k}" aria-current="${E.page === k}">${l}</button>`).join('')}</nav>
      <div class="main">${page}</div>
    </div>${E.hrConfirm ? mHr() : ''}${E.admin && !E.adminConfirm ? mAdmin() : ''}${E.adminConfirm ? mAdminConfirm() : ''}`;
  }
  if(E.flash) html += mFlash();
  epr.innerHTML = html;
  epr.inert = mode !== 'computer';
  epr.setAttribute('aria-hidden', mode === 'computer' ? 'false' : 'true');
}
epr.addEventListener('click', e => {
  const b = e.target.closest('[data-e]'); if(!b || mode !== 'computer') return;
  switch(b.dataset.e){
    case 'login': E.loggedIn = true; E.page = 'summary'; break;
    case 'lock': E.loggedIn = false; E.admin = false; E.adminConfirm = false; E.hrForm = false; E.hrConfirm = false; break;
    case 'nav': E.page = b.dataset.v; E.admin = false; if(E.page === 'obs') E.obsOpened = true; if(E.page === 'drugs') E.chartViewed = true; break;
    case 'hrform': E.hrForm = true; E.hrChoice = null; E.hrError = null; break;
    case 'hrpick': E.hrChoice = +b.dataset.v; E.hrError = null; break;
    case 'hrcancel': E.hrForm = false; E.hrChoice = null; E.hrError = null; break;
    case 'hrconfirm':
      if(E.hrChoice !== HR){ beep(false); E.hrError = `${E.hrChoice} bpm doesn’t match the bedside monitor. Check the monitor and try again.`; mistake(`Chose ${E.hrChoice} bpm when the monitor showed ${HR} bpm.`); }
      else E.hrConfirm = true;
      break;
    case 'hrback': E.hrConfirm = false; break;
    case 'hrok': E.hrLogged = { t:now(), hr:E.hrChoice }; E.hrConfirm = false; E.hrForm = false; beep(true, .03, 880); break;
    case 'admin': E.admin = true; break;
    case 'adminclose': E.admin = false; break;
    case 'adminrecord': E.adminConfirm = true; break;
    case 'adminback': E.adminConfirm = false; break;
    case 'adminok': E.signed = now(); E.admin = false; E.adminConfirm = false; beep(true, .03, 880); break;
    case 'flashok': E.flash = null; break;
    case 'addnote': {
      const ta = epr.querySelector('#noteText'); if(!ta.value.trim()){ ta.focus(); return; }
      E.notes.unshift({ t:now(), by:'Demo nurse', text:ta.value.trim() }); break;
    }
    default: return;
  }
  fire();
});
setInterval(() => { const c = epr.querySelector('#eprClock, .lock .clock'); if(c) c.textContent = now(); }, 15000);
