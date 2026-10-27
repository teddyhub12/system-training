/* ================= Training scenarios =================
   Pattern: brief, then a quiet heads-up display. The learner sees the goal and the next
   step in a few words; fuller help is there on request (Hint, then Show me where), and the
   learner can choose a test run with no help at all. Feedback is short, appears where the
   action happened and fades. Everything is reviewed in the debrief at the end. */
const SCENARIOS = {
  obs: {
    title:'Record a heart rate', label:'Scenario 1',
    brief:'22:00 on Ward 7. Robin Training in Bed 4 is due a heart rate check.',
    goal:'Read Robin’s heart rate and record it on the ward computer.',
    steps:[
      { s:'Read the heart rate', t:'The bedside monitor shows the heart rate. Have a look at it.', target:'monitor', done:() => WS.monitorChecked },
      { s:'Log in to the computer', t:'The ward computer is the laptop on the drug trolley. Select it and log in.', target:'laptop', done:() => E.loggedIn },
      { s:'Open observations', t:'In the patient record, open Assessments and observations.', target:'laptop', done:() => E.obsOpened },
      { s:'Record the heart rate', t:'Select Record heart rate, choose the value from the monitor, confirm it, then select OK.', target:'laptop', done:() => !!E.hrLogged }
    ]
  },
  para: {
    title:'Give paracetamol', label:'Scenario 2',
    brief:'22:00 on Ward 7. Paracetamol 1 g is due for Robin Training in Bed 4. Prepare it at the trolley, check and give it at the bedside, then record it.',
    goal:'Prepare, check, give and record the paracetamol that’s due.',
    steps:[
      { s:'Check the drug chart', t:'Log in to the ward computer on the drug trolley and open the Drug chart to see what’s due.', target:'laptop', done:() => E.chartViewed },
      { s:'Get the paracetamol', t:'Open the drugs drawer on the trolley and pick out the paracetamol. Check the name and strength.', target:'trolley', done:() => WS.pack === 'para' || WS.paraScanned || WS.given },
      { s:'Take the scanner', t:'The handheld scanner sits on top of the trolley. You’ll need it at the bedside.', target:'scanner', done:() => WS.scannerTaken },
      { s:'Scan Robin’s wristband', t:'At the bedside, scan the wristband first so the computer knows who the medicine is for.', target:'patient', done:() => WS.wristScanned },
      { s:'Scan the paracetamol', t:'Now scan the pack. The computer checks the drug and dose against the chart.', target:'patient', done:() => WS.paraScanned },
      { s:'Give it to Robin', t:'Give the paracetamol and make sure Robin takes it.', target:'patient', done:() => WS.given },
      { s:'Record it as given', t:'Back at the computer, open the Drug chart, select Administer, then Record as given.', target:'laptop', done:() => !!E.signed }
    ]
  }
};
let active = null, visitDone = false, lastStep = -1, hintOpen = false, hintUntil = Date.now() + 8000;
// finishing a step in one part of the bay and moving to another pulls the camera back:
// the learner finds the next thing themselves
const AREA = { monitor:'monitor', laptop:'trolley', glance:'trolley', scanner:'trolley', trolley:'trolley', drawer:'trolley', wrist:'bed', patient:'bed', board:'bed', pump:'bed', window:'window' };
const taskEl = document.getElementById('task'), toastEl = document.getElementById('toast');
const menuEl = document.getElementById('menu'), doneEl = document.getElementById('done');
const PACK = id => PACKS.find(p => p.id === id);
const mistake = text => { if(active && !WS.mistakes.includes(text)) WS.mistakes.push(text); };
const curStep = () => active ? active.s.steps.findIndex(st => !st.done()) : -1;
const guided = () => !!active && active.mode === 'guided';
setTimeout(() => updateCaption(), 8100);

function resetWorld(){
  Object.assign(WS, { wristAt:null, paraAt:null, givenAt:null, monitorChecked:false, scannerHeld:false, scannerTaken:false, wristScanned:false, drawerOpen:false, pack:null, paraScanned:false, given:false, msg:null, mistakes:[] });
  gun.visible = true; PACKS.forEach(p => { p.group.visible = true; p.group.position.y = -.028; p.group.scale.setScalar(1); }); trayG.visible = false; trayG.userData.leaving = false; headPivot.rotation.x = 0;
  drawers.forEach(d => { d.userData.target = 0; });
  clearTimeout(flashT); resetEPR();
  if(mode === 'computer') exitComputer(); else goHome();
}
function startScenario(id, runMode){
  resetWorld();
  active = { id, s:SCENARIOS[id], mode:runMode, t0:Date.now(), finished:false, hints:0, where:-1, stepAt:Date.now() };
  hintOpen = false; menuEl.hidden = true; doneEl.hidden = true; hintUntil = 0;
  fire(); stage.focus({ preventScroll:true });
}
function liftOut(g){ tween(380, u => { g.position.y = -.028 + .09*u; g.scale.setScalar(1 - u*.9); }, () => { g.visible = false; g.position.y = -.028; g.scale.setScalar(1); }); }
function dropIn(g){ g.visible = true; tween(380, u => { g.position.y = -.028 + .09*(1 - u); g.scale.setScalar(.1 + .9*u); }); }
// the medicine and a pot sit on the bedside locker while you're at the bedside holding them
function updateTray(){
  const show = !!WS.pack && mode === 'focus' && AREA[current] === 'bed';
  if(trayG.userData.leaving) return;
  if(show && !trayG.visible){
    trayTop.material.map = PACK(WS.pack).tex; trayTop.material.needsUpdate = true;
    tablets.forEach(tb => { tb.visible = WS.pack === 'para'; tb.position.copy(tb.userData.home); tb.scale.set(1, .42, 1); });
    trayG.visible = true; tween(320, u => trayG.scale.setScalar(.5 + .5*easeOutBack(u)));
  } else if(!show && trayG.visible) trayG.visible = false;
}
function returnItems(){
  WS.scannerHeld = false; gun.visible = true;
  if(WS.pack){ PACK(WS.pack).group.visible = true; WS.pack = null; }
  trayG.visible = false;
}
function endScenario(){ active = null; hintOpen = false; returnItems(); fire(); }

/* everything the learner does ends here */
function fire(){
  if(active && !active.finished){
    const c = active.s.steps.filter(st => st.done()).length;
    if(c > (active.count || 0)){
      if(mode === 'focus') visitDone = true;
      // a quiet tick for steps that didn't already say something
      if(!WS.msg){ const k = active.s.steps.findIndex((st, n) => n >= (active.count || 0) && st.done()); if(k >= 0) WS.msg = { ok:true, text:`✓ ${active.s.steps[k].s}` }; }
    }
    active.count = c;
  }
  if(WS.msg){ toast(WS.msg); WS.msg = null; }
  renderTask(); updateCaption(); renderEPR(); updateTray();
  if(active && !active.finished && curStep() === -1){ active.finished = true; setTimeout(showDone, 2000); }
}

/* short feedback near where things happen, then it fades */
let toastT = null;
function toast(m){
  toastEl.className = 'toast glass ' + (m.ok ? 'ok' : 'err');
  toastEl.setAttribute('role', m.ok ? 'status' : 'alert');
  toastEl.textContent = m.text; toastEl.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, m.ok ? 3200 : 6500);
}

/* the heads-up display: goal or next step, progress, what's in your hand, help on request */
function renderTask(){
  document.getElementById('trainBtn').hidden = !!active;
  document.getElementById('scnBtn').hidden = !active;
  const i = curStep();
  if(active && i !== lastStep){
    taskEl.classList.remove('bump'); void taskEl.offsetWidth; taskEl.classList.add('bump');
    active.stepAt = Date.now(); active.where = -1; hintOpen = false;
  }
  lastStep = active ? i : -1;
  labelEls.forEach(({ id, b }) => b.classList.toggle('where', !!active && i >= 0 && active.where === i && active.s.steps[i].target === id));
  const held = [], keys = [];
  const chip = (key, cls, html) => { keys.push(key); held.push(`<span class="chip ${cls}${renderTask.keys && !renderTask.keys.includes(key) ? ' pop' : ''}">${html}</span>`); };
  if(WS.scannerHeld) chip('scanner', '', `Scanner<button type="button" data-a="putscanner" aria-label="Put the scanner back">×</button>`);
  if(WS.pack){ const k = PACK(WS.pack), scanned = WS.pack === 'para' && WS.paraScanned;
    chip(WS.pack + (scanned ? '-ok' : ''), scanned ? 'ok' : '', `${k.name}${scanned ? ' ✓' : ''}${WS.given ? '' : `<button type="button" data-a="putback" aria-label="Put the ${k.name.toLowerCase()} back">×</button>`}`); }
  renderTask.keys = keys;
  const hand = held.length ? `<div class="h-hand"><span class="lbl">In hand</span>${held.join('')}</div>` : '';
  if(!active){ taskEl.hidden = !held.length; taskEl.innerHTML = hand; return; }
  const steps = active.s.steps, n = steps.length, done = i === -1;
  taskEl.hidden = false;
  taskEl.innerHTML = `<div class="h-top"><span class="h-title">${active.s.title}${active.mode === 'test' ? ' <em>Test</em>' : ''}</span>
      <span class="h-dots" aria-hidden="true">${steps.map((st, k) => `<i class="${st.done() ? 'd' : k === i ? 'c' : ''}"></i>`).join('')}</span>
      <span class="h-count">${done ? n : i+1}/${n}</span></div>
    <div class="h-step">${done ? 'All done' : guided() ? steps[i].s : active.s.goal}</div>
    ${hand}
    ${guided() && hintOpen && !done ? `<div class="h-hint">${steps[i].t}<button type="button" class="act mini sec" data-t="where">Show me where</button></div>` : ''}
    <div class="h-acts">${guided() && !done ? `<button type="button" data-t="hint" class="${Date.now() - active.stepAt > 45000 && !hintOpen ? 'nudge' : ''}" aria-expanded="${hintOpen}">${hintOpen ? 'Hide hint' : 'Hint'}</button>` : ''}<button type="button" data-t="exit">Exit</button></div>`;
  taskEl.setAttribute('aria-label', `${active.s.label}: ${active.s.title}. Step ${done ? n : i+1} of ${n}.`);
}
// a gentle nudge towards the hint if someone's been stuck on a step for a while
setInterval(() => { if(guided() && !active.finished && !hintOpen && Date.now() - active.stepAt > 45000){ const h = taskEl.querySelector('[data-t="hint"]'); if(h && !h.classList.contains('nudge')) h.classList.add('nudge'); } }, 5000);

/* close-up captions: just the name of the thing and what you can do with it */
const NAMES = { drawer:'Drugs drawer', glance:'Ward computer', patient:'Robin Training, Bed 4', wrist:'Robin’s wristband' };
function updateCaption(){
  if(mode === 'computer'){ caption.innerHTML = ''; return; }
  if(mode !== 'focus'){ caption.innerHTML = Date.now() < hintUntil ? HINT : ''; return; }
  const id = current, acts = [];
  if(id === 'scanner') acts.push(WS.scannerHeld ? ['putscanner', 'Put the scanner back', 'sec'] : ['pickup', 'Pick up the scanner']);
  if(id === 'wrist' || id === 'patient'){
    // practice shows the next bedside check only; a test offers everything, so the order is up to the learner
    const free = !guided(), med = WS.pack ? PACK(WS.pack).name.toLowerCase() : '';
    if(!WS.wristScanned || free) acts.push(['scanwrist', WS.wristScanned ? 'Scan the wristband again' : 'Scan the wristband', WS.wristScanned ? 'sec' : '']);
    if(id === 'patient' && WS.pack && !(WS.pack === 'para' && WS.paraScanned) && (free || WS.wristScanned)) acts.push(['scanpack', `Scan the ${med}`]);
    if(id === 'patient' && WS.pack && !WS.given && (free || WS.paraScanned)) acts.push(['give', `Give the ${med}`]);
  }
  if(id === 'drawer'){
    if(WS.pack){ acts.push(['closedrawer', 'Close the drawer']); acts.push(['putback', 'Put it back', 'sec']); }
    else PACKS.filter(p => p.group.visible).forEach(p => acts.push(['pack:' + p.id, p.name, 'chip']));
  }
  const i = curStep(), tgt = i >= 0 ? active.s.steps[i].target : null;
  if(tgt && visitDone && AREA[tgt] !== AREA[id]) acts.push(['next', 'Continue', 'sec']);
  caption.innerHTML = `<b>${NAMES[id] || ITEMS[id].tag}</b>${acts.length ? `<div class="acts">${acts.map(([a, l, k]) => `<button class="act ${k || ''}" type="button" data-a="${a}">${l}</button>`).join('')}</div>` : ''}`;
}

/* actions in the bay */
// Continue always returns to the same overview of the bay, where every station is in view:
// a predictable hub makes it easy to get from the trolley to the bedside, but the learner still chooses
function pullBack(){ goHome(); }
function primaryAction(id){ if(id === 'scanner') (WS.scannerHeld ? putScannerBack() : pickUpScanner()); else if(id === 'wrist') scanWrist(); else if(id === 'patient') give(); }
function putScannerBack(){
  if(!WS.scannerHeld) return;
  WS.scannerHeld = false; gun.visible = true; beep(true, .02, 520);
  WS.msg = { ok:true, text:'Scanner back in its cradle' }; fire();
}
function pickUpScanner(){
  if(WS.scannerHeld) return;
  WS.scannerHeld = true; WS.scannerTaken = true; gun.visible = false; setHover(null); beep(true, .02, 660);
  WS.msg = { ok:true, text:'✓ Scanner picked up' }; fire();
}
function scanWrist(){
  if(!WS.scannerHeld){ WS.msg = { ok:false, text:'You need the barcode scanner first.' }; fire(); return; }
  beep(); WS.wristScanned = true; WS.wristAt = WS.wristAt || now();
  scanFx(idPanel, .064, .024, true, [band, idPanel]);
  flash(true, 'Patient confirmed', 'Robin Training, born 22/07/1968. NHS number 999 345 6780.');
  WS.msg = { ok:true, text:'✓ Wristband scanned: Robin Training' }; fire();
}
function toggleDrawer(d){
  const u = d.userData, opening = !u.target; u.target = opening ? 1 : 0; beep(true, .02);
  if(d !== drawers[0]) return;
  if(opening){ WS.drawerOpen = true; goTo('drawer'); }
  else if(current === 'drawer') goTo('trolley');
}
function pickPack(id){
  if(WS.given && id === 'para') return;
  if(WS.pack === id) return;
  if(WS.pack) dropIn(PACK(WS.pack).group);
  WS.pack = id; liftOut(PACK(id).group); setHover(null); beep(true, .02, 560);
  WS.msg = { ok:true, text:`Picked up ${PACK(id).name.toLowerCase()}` }; fire();
}
function putBack(){
  if(!WS.pack) return;
  dropIn(PACK(WS.pack).group); WS.pack = null;
  WS.msg = { ok:true, text:'Pack back in the drawer' }; fire();
}
function scanPack(){
  if(!WS.pack) return;
  const k = PACK(WS.pack);
  if(!WS.scannerHeld){ WS.msg = { ok:false, text:'You need the barcode scanner first.' }; fire(); return; }
  if(!WS.wristScanned){ beep(false); mistake('Scanned a medicine before scanning the patient’s wristband.'); WS.msg = { ok:false, text:'Scan the patient’s wristband first, so the computer knows who the medicine is for.' }; fire(); return; }
  if(k.id !== 'para'){
    beep(false); mistake(`Picked up ${k.name.toLowerCase()} instead of paracetamol.`);
    if(trayG.visible) scanFx(trayTop, .098, .063, false, trayPack);
    flash(false, 'Wrong medicine', k.why);
    WS.msg = { ok:false, text:k.why }; fire(); return;
  }
  beep(); WS.paraScanned = true; WS.paraAt = now();
  if(trayG.visible) scanFx(trayTop, .098, .063, true, trayPack);
  flash(true, 'Correct dose scanned', 'Paracetamol 500 mg tablets × 2 = 1 g. This matches the drug chart.');
  WS.msg = { ok:true, text:'✓ Correct dose: paracetamol 500 mg × 2 = 1 g' }; fire();
}
function give(){
  if(WS.given) return;
  if(WS.pack !== 'para'){ WS.msg = { ok:false, text: WS.pack ? 'That isn’t the medicine that’s due.' : 'You aren’t holding any medicine.' }; fire(); return; }
  if(!WS.paraScanned){ beep(false); mistake('Tried to give the paracetamol before scanning it.'); WS.msg = { ok:false, text:'Scan the paracetamol before you give it.' }; fire(); return; }
  WS.given = true; WS.givenAt = now(); WS.pack = null; beep(true, .02, 880);
  if(trayG.visible){
    trayG.userData.leaving = true;
    const mouth = trayG.worldToLocal(headG.localToWorld(V(0, .27, -.52)));
    tablets.forEach((tb, n) => { const a = tb.userData.home.clone();
      tween(700 + n*120, u => { tb.position.lerpVectors(a, mouth, u); tb.position.y += Math.sin(Math.PI*u)*.12; tb.scale.setScalar(1 - .7*u); tb.scale.y *= .42; }, () => { tb.visible = false; }); });
    setTimeout(() => tween(900, u => { headPivot.rotation.x = Math.sin(Math.PI*u)*.14; }, () => { headPivot.rotation.x = 0; }), 650);
    setTimeout(() => tween(300, u => trayG.scale.setScalar(1 - u), () => { trayG.visible = false; trayG.userData.leaving = false; trayG.scale.setScalar(1); }), 1700);
  }
  WS.msg = { ok:true, text:'✓ Robin has taken the paracetamol' }; fire();
}
function showWhere(){
  const i = curStep(); if(!active || i < 0) return;
  active.where = i; active.hints++;
  if(mode === 'computer') exitComputer(); else if(mode === 'focus') goHome(); else fire();
}
function act(a){
  if(a === 'pickup') pickUpScanner();
  else if(a === 'scanwrist') scanWrist();
  else if(a === 'give') give();
  else if(a === 'scanpack') scanPack();
  else if(a === 'putback') putBack();
  else if(a === 'putscanner') putScannerBack();
  else if(a.startsWith('pack:')) pickPack(a.slice(5));
  else if(a === 'next') pullBack();
  else if(a === 'closedrawer') toggleDrawer(drawers[0]);
}
caption.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if(b) act(b.dataset.a); });
taskEl.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if(a){ act(a.dataset.a); return; }
  const b = e.target.closest('[data-t]'); if(!b) return;
  if(b.dataset.t === 'exit') endScenario();
  else if(b.dataset.t === 'hint'){ if(!hintOpen) active.hints++; hintOpen = !hintOpen; renderTask(); }
  else if(b.dataset.t === 'where') showWhere();
});

/* choosing a scenario, and the debrief */
function showMenu(){
  menuEl.querySelector('.menu').innerHTML = `<h2 id="menuTitle">Scenario training</h2>
    <p>Practise with hints available, or test yourself with no help.</p>
    ${Object.entries(SCENARIOS).map(([id, s]) => `<div class="scn"><b>${s.label}: ${s.title}</b><span>${s.brief}</span>
      <div class="row"><button class="act" type="button" data-s="${id}" data-m="guided">Practise</button><button class="act sec" type="button" data-s="${id}" data-m="test">Test yourself</button></div></div>`).join('')}
    <button class="linkish" type="button" data-s="explore">Close</button>`;
  menuEl.hidden = false; menuEl.querySelector('.act').focus({ preventScroll:true });
}
function showDone(){
  const s = active.s, secs = Math.round((Date.now() - active.t0)/1000), other = active.id === 'obs' ? 'para' : 'obs';
  const time = `${Math.floor(secs/60)} min ${String(secs%60).padStart(2,'0')} s`, clean = !WS.mistakes.length;
  const meta = [active.mode === 'test' ? 'Test' : 'Practice', time, active.mode === 'guided' ? `${active.hints} hint${active.hints === 1 ? '' : 's'} used` : ''].filter(Boolean).join(' · ');
  doneEl.querySelector('.menu').innerHTML = `<h2 id="doneTitle">${active.mode === 'test' ? (clean ? 'Passed' : 'Not quite') : 'Scenario complete'}</h2>
    <p>${s.label}: ${s.title}<br>${meta}</p>
    ${clean ? '<p class="clean">Every check done, in the right order.</p>' : `<h3>To review</h3><ul>${WS.mistakes.map(m => `<li>${m}</li>`).join('')}</ul>`}
    <div class="row">${active.mode === 'guided' ? `<button class="act" type="button" data-s="${active.id}" data-m="test">Test yourself</button><button class="act sec" type="button" data-s="${active.id}" data-m="guided">Practise again</button>`
      : `<button class="act" type="button" data-s="${active.id}" data-m="test">Try again</button>`}
      <button class="act sec" type="button" data-s="${other}" data-m="guided">${SCENARIOS[other].label}</button><button class="act sec" type="button" data-s="explore">Close</button></div>`;
  doneEl.hidden = false; doneEl.querySelector('.act').focus({ preventScroll:true });
}
[menuEl, doneEl].forEach(el => el.addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if(!b) return;
  const s = b.dataset.s;
  if(s === 'explore'){ menuEl.hidden = true; doneEl.hidden = true; if(active && active.finished){ active = null; returnItems(); } fire(); stage.focus({ preventScroll:true }); }
  else startScenario(s, b.dataset.m || 'guided');
}));
document.getElementById('scnBtn').onclick = showMenu;
document.getElementById('trainBtn').onclick = e => { e.currentTarget.classList.add('seen'); showMenu(); };
