/* ================= 3D bay ================= */
const stage = document.getElementById('stage');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const col = h => new THREE.Color(h).convertSRGBToLinear();
let mode = 'explore'; // explore | focus | computer
// what the learner has done in the bay (the ward computer keeps its own state in E)
const WS = { wristAt:null, paraAt:null, givenAt:null, monitorChecked:false, scannerHeld:false, scannerTaken:false, wristScanned:false, drawerOpen:false, pack:null, paraScanned:false, given:false, msg:null, mistakes:[] };

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0b0d10, 1);
renderer.domElement.className = 'gl';
const cssRenderer = new THREE.CSS3DRenderer();
cssRenderer.domElement.className = 'css3d';
stage.prepend(renderer.domElement);
stage.prepend(cssRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 120);

/* ---------- helpers ---------- */
function ctex(w, h, draw, repeat){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  if(repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData = { c, g }; return t;
}
const rnd = (() => { let s = 7; return () => (s = (s*16807) % 2147483647) / 2147483647; })();
function std(hex, rough = .7, extra = {}){ return new THREE.MeshStandardMaterial(Object.assign({ color:col(hex), roughness:rough, metalness:0 }, extra)); }
function add(m, parent = scene, cast = true, receive = true){ m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m; }
function box(w, h, d, mat, x, y, z, parent, r = 0){
  const g = r > 0 ? new THREE.RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return add(m, parent);
}
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 20){ const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return add(m, parent); }
function rod(a, b, r, mat, parent = scene){
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 12), mat);
  m.position.copy(A).add(B).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), B.clone().sub(A).normalize());
  return add(m, parent);
}
function tube(pts, r, mat, parent = scene){
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  return add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, r, 8, false), mat), parent, false, false);
}
function plane(w, h, mat, x, y, z, parent = scene){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); return add(m, parent, false, true); }
function label(text, w, h, opts = {}){
  return ctex(w, h, (g, W, H) => {
    g.fillStyle = opts.bg || '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = opts.fg || '#1a1a1a'; g.font = `${opts.weight || 700} ${opts.size || Math.round(H*.55)}px Arial, Helvetica, sans-serif`;
    g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
    g.fillText(text, opts.align === 'left' ? W*.06 : W/2, H/2 + 1);
  });
}
function shadowBlob(w, d, x, z, strength = .55, parent = scene){
  const t = ctex(128, 128, (g) => { const gr = g.createRadialGradient(64,64,4,64,64,62); gr.addColorStop(0, `rgba(0,0,0,${strength})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,128,128); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map:t, transparent:true, depthWrite:false }));
  m.rotation.x = -Math.PI/2; m.position.set(x, .003, z); parent.add(m); return m;
}

/* ---------- textures ---------- */
const floorTex = ctex(512, 512, (g, W, H) => {
  g.fillStyle = '#a7a397'; g.fillRect(0,0,W,H);
  for(let i=0;i<5200;i++){ const v = rnd(); g.fillStyle = v < .5 ? `rgba(70,66,58,${.18*rnd()})` : `rgba(240,236,226,${.22*rnd()})`; g.fillRect(rnd()*W, rnd()*H, 1+rnd()*3, 1+rnd()*2); }
}, [5, 5]);
const ceilTex = ctex(256, 256, (g, W, H) => {
  g.fillStyle = '#d9d3c6'; g.fillRect(0,0,W,H);
  for(let i=0;i<2500;i++){ g.fillStyle = `rgba(90,85,75,${.14*rnd()})`; g.fillRect(rnd()*W, rnd()*H, 1.5, 1.5); }
  g.strokeStyle = '#a69f90'; g.lineWidth = 5; g.strokeRect(0,0,W,H);
}, [9, 8]);
const wallTex = ctex(256, 256, (g, W, H) => {
  g.fillStyle = '#ffffff'; g.fillRect(0,0,W,H);
  for(let i=0;i<1800;i++){ g.fillStyle = `rgba(0,0,0,${.035*rnd()})`; g.fillRect(rnd()*W, rnd()*H, 2+rnd()*4, 2+rnd()*4); }
}, [6, 3]);
const blanketTex = ctex(256, 256, (g, W, H) => {
  g.fillStyle = '#b4c3d3'; g.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=8) for(let x=(y/8)%2*4;x<W;x+=8){ g.fillStyle = 'rgba(55,72,95,.38)'; g.beginPath(); g.arc(x+2, y+2, 1.7, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.18)'; for(let y=0;y<H;y+=4){ g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
}, [5, 9]);
const gownTex = ctex(128, 128, (g, W, H) => {
  g.fillStyle = '#e6ecf0'; g.fillRect(0,0,W,H);
  g.fillStyle = '#2d4a74';
  for(let y=6;y<H;y+=16) for(let x=(y%32?14:6);x<W;x+=16){ g.beginPath(); g.ellipse(x, y, 2.6, 2, .5, 0, 7); g.fill(); }
}, [3, 3]);
const curtainTex = ctex(256, 512, (g, W, H) => {
  g.fillStyle = '#4c78a0'; g.fillRect(0,0,W,H);
  for(let i=0;i<900;i++){ g.fillStyle = `rgba(255,255,255,${.05*rnd()})`; g.fillRect(rnd()*W, rnd()*H, 1, 6+rnd()*14); }
  g.fillStyle = '#d7e2ea'; g.fillRect(0, 0, W, 46);
  g.strokeStyle = 'rgba(80,100,120,.5)'; for(let x=0;x<W;x+=6){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+20,46); g.stroke(); g.beginPath(); g.moveTo(x+20,0); g.lineTo(x,46); g.stroke(); }
});

/* ---------- materials ---------- */
const M = {
  wall: std('#d8cab0', .92, { map:wallTex }), wallBack: std('#d4c6ab', .92, { map:wallTex }),
  bumper: std('#8a9cad', .55), skirting: std('#6f6a62', .7),
  floor: std('#ffffff', .62, { map:floorTex }), ceil: std('#ffffff', .95, { map:ceilTex }),
  cream: std('#e6dfd0', .5), white: std('#f2f0ea', .55), sheet: std('#eeece6', .92),
  frame: std('#dcd6c8', .42), grey: std('#8d9298', .5), dark: std('#2b2e33', .55), black: std('#141518', .5),
  chrome: std('#c9ccd0', .28, { metalness:.85 }), steel: std('#a8adb3', .35, { metalness:.7 }),
  navy: std('#2d4c74', .45), blanket: std('#ffffff', .96, { map:blanketTex }), gown: std('#ffffff', .9, { map:gownTex }),
  skin: std('#c79a7c', .55, { emissive:col('#6a4230'), emissiveIntensity:.35 }), hair: std('#3a2a20', .95), trolley: std('#5d7ea3', .45), drawer: std('#ebe5d8', .5),
  yellow: std('#e5bd17', .5), curtain: std('#ffffff', .96, { map:curtainTex, side:THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color:col('#cfe0e8'), roughness:.08, transparent:true, opacity:.14, depthWrite:false }),
  bag: new THREE.MeshStandardMaterial({ color:col('#eef4f6'), roughness:.2, transparent:true, opacity:.55 }),
  jug: new THREE.MeshStandardMaterial({ color:col('#d8e8f0'), roughness:.1, transparent:true, opacity:.45 }),
  lineTube: std('#e8eef0', .3), lamp: new THREE.MeshStandardMaterial({ color:col('#fff3dd'), emissive:col('#ffd7a0'), emissiveIntensity:2.2 })
};

/* ---------- room: x -2.6..2.8, z -2.5..2.2, y 0..2.7 ---------- */
const RX0 = -2.6, RX1 = 2.8, RZ0 = -2.5, RZ1 = 2.2, RH = 2.7;
const floor = plane(RX1-RX0, RZ1-RZ0, M.floor, (RX0+RX1)/2, 0, (RZ0+RZ1)/2); floor.rotation.x = -Math.PI/2;
const ceil = plane(RX1-RX0, RZ1-RZ0, M.ceil, (RX0+RX1)/2, RH, (RZ0+RZ1)/2); ceil.rotation.x = Math.PI/2;
// back wall with a window opening (x 1.55..2.65, y .95..2.25)
const WX0 = 1.55, WX1 = 2.65, WY0 = .95, WY1 = 2.25;
plane(WX0-RX0, RH, M.wallBack, (RX0+WX0)/2, RH/2, RZ0);
plane(RX1-WX1, RH, M.wallBack, (WX1+RX1)/2, RH/2, RZ0);
plane(WX1-WX0, WY0, M.wallBack, (WX0+WX1)/2, WY0/2, RZ0);
plane(WX1-WX0, RH-WY1, M.wallBack, (WX0+WX1)/2, (WY1+RH)/2, RZ0);
const lw = plane(RZ1-RZ0, RH, M.wall, RX0, RH/2, (RZ0+RZ1)/2); lw.rotation.y = Math.PI/2;
const rw = plane(RZ1-RZ0, RH, M.wall, RX1, RH/2, (RZ0+RZ1)/2); rw.rotation.y = -Math.PI/2;
const fw = plane(RX1-RX0, RH, M.wall, (RX0+RX1)/2, RH/2, RZ1); fw.rotation.y = Math.PI;
// bumper rails and skirting
[[ (RX0+RX1)/2, RZ0+.02, RX1-RX0, 0 ], [ (RX0+RX1)/2, RZ1-.02, RX1-RX0, 0 ]].forEach(([x,z,len]) => { box(len, .1, .03, M.bumper, x, .95, z); box(len, .1, .02, M.skirting, x, .05, z); });
[[RX0+.02, (RZ0+RZ1)/2], [RX1-.02, (RZ0+RZ1)/2]].forEach(([x,z]) => { box(.03, .1, RZ1-RZ0, M.bumper, x, .95, z); box(.02, .1, RZ1-RZ0, M.skirting, x, .05, z); });
// window frame, sill, glass, radiator cover
const wframe = std('#ece8df', .5);
box(WX1-WX0+.1, .06, .12, wframe, (WX0+WX1)/2, WY1+.03, RZ0-.02); box(WX1-WX0+.16, .05, .22, wframe, (WX0+WX1)/2, WY0-.02, RZ0+.05);
box(.06, WY1-WY0, .12, wframe, WX0-.03, (WY0+WY1)/2, RZ0-.02); box(.06, WY1-WY0, .12, wframe, WX1+.03, (WY0+WY1)/2, RZ0-.02);
box(.04, WY1-WY0, .08, wframe, (WX0+WX1)/2, (WY0+WY1)/2, RZ0-.04);
plane(WX1-WX0, WY1-WY0, M.glass, (WX0+WX1)/2, (WY0+WY1)/2, RZ0-.05);
box(1.15, .62, .14, std('#e3ddcf', .6), (WX0+WX1)/2, .4, RZ0+.08, scene, .01);
// a deep reveal behind the frame so the city reads as outside
box(WX1-WX0, .02, .5, wframe, (WX0+WX1)/2, WY0-.01, RZ0-.3); box(WX1-WX0, .02, .5, wframe, (WX0+WX1)/2, WY1+.01, RZ0-.3);

/* ---------- city beyond the window (layered for parallax) ---------- */
function skyline(w, h, seed, opts){
  let s = seed; const r = () => (s = (s*48271) % 2147483647) / 2147483647;
  return ctex(w, h, (g, W, H) => {
    g.clearRect(0,0,W,H);
    let x = 0;
    while(x < W){
      const bw = opts.minW + r()*opts.varW, bh = opts.minH + r()*opts.varH;
      g.fillStyle = opts.body; g.fillRect(x, H-bh, bw, bh);
      for(let wy = H-bh+8; wy < H-6; wy += opts.gap) for(let wx = x+5; wx < x+bw-6; wx += opts.gap*.8){
        if(r() < opts.lit){ g.fillStyle = r() < .75 ? `rgba(255,${190+r()*50|0},${110+r()*60|0},${.55+r()*.45})` : `rgba(170,200,255,${.5+r()*.4})`; g.fillRect(wx, wy, opts.gap*.35, opts.gap*.45); }
      }
      if(r() < .25){ g.fillStyle = 'rgba(255,60,50,.9)'; g.fillRect(x+bw/2-2, H-bh-5, 4, 4); }
      x += bw + r()*opts.space;
    }
  });
}
const sky = ctex(64, 256, (g, W, H) => { const gr = g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#05070d'); gr.addColorStop(.6,'#141a2a'); gr.addColorStop(.85,'#3a2f35'); gr.addColorStop(1,'#6b4a3a'); g.fillStyle = gr; g.fillRect(0,0,W,H); });
const skyM = new THREE.MeshBasicMaterial({ map:sky }); const skyP = plane(80, 30, skyM, 2, 4, -40); skyP.receiveShadow = false;
const cityLayers = [
  { tex: skyline(2048, 512, 11, { minW:30, varW:60, minH:120, varH:260, body:'#0d1018', gap:14, lit:.32, space:6 }), w:46, h:11.5, z:-26, y:2.2 },
  { tex: skyline(2048, 512, 23, { minW:50, varW:90, minH:60, varH:200, body:'#090b10', gap:18, lit:.42, space:14 }), w:24, h:6, z:-12, y:.9 },
  { tex: skyline(1024, 512, 41, { minW:80, varW:120, minH:40, varH:120, body:'#06070a', gap:24, lit:.3, space:30 }), w:10, h:5, z:-5.5, y:-.3 }
];
cityLayers.forEach(L => { const p = plane(L.w, L.h, new THREE.MeshBasicMaterial({ map:L.tex, transparent:true }), 2.1, L.y, L.z); p.receiveShadow = false; });
// a train crossing between the layers
const train = new THREE.Group(); scene.add(train);
for(let i=0;i<6;i++){ const car = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .1), new THREE.MeshBasicMaterial({ color:col('#ffdca0') })); car.position.x = i*1.18; train.add(car); }
train.position.set(-12, .75, -16);
// street lights glow
for(let i=0;i<7;i++){ const s = new THREE.Mesh(new THREE.CircleGeometry(.07, 12), new THREE.MeshBasicMaterial({ color:col('#ffc27a') })); s.position.set(-1.2 + i*1.25, .15 + (i%2)*.05, -8); scene.add(s); }

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(col('#7d8db0'), col('#3a2d22'), .32));
const bedLight = new THREE.SpotLight(col('#ffcf96'), 22, 6, 1.1, 1, 2);
bedLight.position.set(0, 2.08, -2.2); bedLight.target.position.set(.05, .5, -.9); scene.add(bedLight, bedLight.target);
bedLight.castShadow = true; bedLight.shadow.mapSize.set(2048, 2048); bedLight.shadow.bias = -.0004; bedLight.shadow.normalBias = .02; bedLight.shadow.camera.near = .2; bedLight.shadow.camera.far = 6;
const wash = new THREE.PointLight(col('#ffcc8f'), 4, 3.2, 2); wash.position.set(0, 2.2, -2.3); scene.add(wash);
const moon = new THREE.PointLight(col('#6d8cc4'), 4, 4.5, 2); moon.position.set(2.1, 1.7, -2.1); scene.add(moon);
const corridor = new THREE.PointLight(col('#ffd9a8'), 4.5, 7, 2); corridor.position.set(.4, 2.45, 1.9); scene.add(corridor);
const sideFill = new THREE.PointLight(col('#ffbf80'), 3, 3, 2); sideFill.position.set(-1.9, 1.9, -1.0); scene.add(sideFill);
// soft fill in front of the patient's face, no shadows, so the face isn't lit only from the wall light behind it
const faceFill = new THREE.PointLight(col('#ffdcbf'), 1.7, 1.4, 2); faceFill.position.set(.1, 1.55, -1.45); scene.add(faceFill);

/* ---------- bedhead: trunking, wall light, bed board ---------- */
box(3.1, .22, .08, M.cream, -.25, 1.42, RZ0+.04, scene, .01);
[-1.2,-1.05,.55,.7].forEach(x => { box(.075, .075, .015, M.white, x, 1.42, RZ0+.085); box(.012, .025, .01, std('#c23a2e', .5), x-.015, 1.42, RZ0+.093); box(.012, .025, .01, std('#c23a2e', .5), x+.015, 1.42, RZ0+.093); });
[[-.55,'#f2f2f2'],[-.4,'#2f8f5b'],[.15,'#ececec']].forEach(([x,c]) => { cyl(.03, .03, .03, std(c, .4), x, 1.42, RZ0+.1).rotation.x = Math.PI/2; });
const lampStrip = box(1.25, .07, .1, M.lamp, 0, 2.06, RZ0+.06, scene, .02); lampStrip.castShadow = false; lampStrip.userData.noBake = true;
box(1.32, .12, .12, M.cream, 0, 2.12, RZ0+.06, scene, .02);
const boardTex = ctex(600, 400, (g, W, H) => {
  g.fillStyle = '#f7f6f2'; g.fillRect(0,0,W,H);
  g.fillStyle = '#1f2a33'; g.font = '700 54px Arial'; g.fillText('Bed 4', 34, 78);
  g.font = '30px Arial'; g.fillStyle = '#34424e';
  [['Name','Robin Training'],['Consultant','Dr Demo'],['Nurse','Demo nurse'],['Mobility','1 assist']].forEach(([k,v],i) => {
    g.fillText(k + ':', 34, 150 + i*58); g.fillStyle = '#1a4f8a'; g.font = 'italic 32px "Comic Sans MS", "Segoe Print", cursive'; g.fillText(v, 230, 150 + i*58); g.fillStyle = '#34424e'; g.font = '30px Arial';
  });
});
const board = new THREE.Group(); board.position.set(.95, 1.92, RZ0+.02); scene.add(board);
box(.64, .44, .02, std('#c9ccd0', .4, { metalness:.5 }), 0, 0, 0, board);
plane(.6, .4, new THREE.MeshStandardMaterial({ map:boardTex, roughness:.35 }), 0, 0, .011, board);

/* ---------- bed ---------- */
const TOP = .64, HINGE_Z = -1.6, FOOT_Z = -.32, TH = .5;
const HINGE_S = FOOT_Z - HINGE_Z; // 1.28
const bed = new THREE.Group(); scene.add(bed);
box(.84, .1, 1.9, M.grey, 0, .3, -1.33, bed, .02);
[[-.36,-2.15],[.36,-2.15],[-.36,-.5],[.36,-.5]].forEach(([x,z]) => { cyl(.055, .055, .045, M.black, x, .06, z, bed).rotation.z = Math.PI/2; box(.04, .2, .04, M.steel, x, .18, z, bed); });
box(.12, .2, .12, M.dark, 0, .2, -1.95, bed); box(.12, .2, .12, M.dark, 0, .2, -.7, bed);
box(.92, .05, 1.98, M.frame, 0, .45, -1.33, bed, .015);
// headboard and footboard
box(.96, .56, .05, M.frame, 0, .78, -2.36, bed, .02);
const foot = box(.98, .5, .06, M.frame, 0, .7, -.26, bed, .025);
box(.5, .16, .01, M.navy, .05, .62, -.225, bed, .01);
// flat mattress section (feet to hinge)
const lowLen = HINGE_S - .02;
box(.88, .16, lowLen, M.sheet, 0, TOP-.08, FOOT_Z - lowLen/2 - .01, bed, .05);
// raised back section
const back = new THREE.Group(); back.position.set(0, TOP, HINGE_Z); back.rotation.x = TH; bed.add(back);
box(.88, .16, .74, M.sheet, 0, -.08, -.37, back, .05);
box(.62, .12, .38, M.white, 0, .055, -.56, back, .05); // pillow
// rails: two along the back section, one along the foot section on the far side
function rail(parent, x, z0, z1, y0){
  const g = new THREE.Group(); parent.add(g);
  box(.035, .035, Math.abs(z1-z0), M.frame, x, y0+.26, (z0+z1)/2, g, .015);
  box(.035, .035, Math.abs(z1-z0)*.8, M.frame, x, y0+.08, (z0+z1)/2, g, .015);
  [z0+.05, (z0+z1)/2, z1-.05].forEach(z => box(.03, .2, .035, M.frame, x, y0+.17, z, g, .012));
  box(.012, .1, .2, std('#3a4f6b', .4), x + Math.sign(x)*.019, y0+.17, (z0+z1)/2 + .05, g, .004);
  return g;
}
rail(back, .47, -.05, -.62, -.06); rail(back, -.47, -.05, -.62, -.06);
rail(bed, -.47, -1.5, -.55, TOP-.06);

/* blanket draped over a body: s runs from the foot of the bed towards the head */
function bedSurface(s){
  if(s <= HINGE_S) return { p:new THREE.Vector3(0, TOP, FOOT_Z - s), n:new THREE.Vector3(0,1,0) };
  const t = s - HINGE_S;
  return { p:new THREE.Vector3(0, TOP + t*Math.sin(TH), HINGE_Z - t*Math.cos(TH)), n:new THREE.Vector3(0, Math.cos(TH), Math.sin(TH)) };
}
const gauss = (x, m, s) => Math.exp(-((x-m)*(x-m))/(2*s*s));
function bodyH(x, s){
  const legs = Math.max(gauss(x,.11,.065), gauss(x,-.11,.065)) * (.085 + .04*gauss(s, 1.0, .18)) * (s > .1 && s < 1.15 ? 1 : gauss(s, s<.1?.1:1.15, .05));
  const feet = Math.max(gauss(x,.12,.05), gauss(x,-.12,.05)) * .16 * gauss(s, .13, .055);
  const torso = gauss(x, 0, .2) * .15 * (s > 1.0 ? 1 : gauss(s, 1.0, .12));
  const m = Math.max(legs, feet, torso);
  return m;
}
function blanketPoint(x, s){
  const sf = bedSurface(s), h = Math.max(bodyH(x,s), bodyH(x*.8, s)*.9);
  const p = sf.p.clone().add(sf.n.clone().multiplyScalar(h + .018));
  p.x = x;
  const ax = Math.abs(x);
  if(ax > .43){ const d = ax - .43; p.y -= Math.min(d, .2)*1.15 + Math.max(0, d-.2)*.2; p.x = Math.sign(x)*(.43 + d*.25 + .02); }
  p.y += .004*Math.sin(s*31 + x*9) + .003*Math.sin(s*11 - x*23);
  return p;
}
const BL_S1 = 1.64;
function sheetGeo(s0, s1, xs, lift){
  const nx = 30, ns = 70, pos = [], uv = [], idx = [];
  for(let j=0;j<=ns;j++) for(let i=0;i<=nx;i++){
    const x = -xs + 2*xs*i/nx, s = s0 + (s1-s0)*j/ns, p = blanketPoint(x, s); p.y += lift;
    pos.push(p.x, p.y, p.z); uv.push(i/nx, j/ns);
  }
  for(let j=0;j<ns;j++) for(let i=0;i<nx;i++){ const a = j*(nx+1)+i, b = a+1, c = a+nx+1, d = c+1; idx.push(a,c,b, b,c,d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const blanket = add(new THREE.Mesh(sheetGeo(.02, BL_S1, .62, 0), M.blanket), bed);
M.blanket.side = THREE.DoubleSide;
const fold = add(new THREE.Mesh(sheetGeo(BL_S1-.14, BL_S1+.02, .6, .012), std('#f3f1ec', .9, { side:THREE.DoubleSide })), bed);
// patient: shoulders, neck, head
const patientG = new THREE.Group(); back.add(patientG);
const torso = box(.44, .13, .34, M.gown, 0, .062, -.3, patientG, .06);
cyl(.045, .05, .1, M.skin, 0, .12, -.47, patientG).rotation.x = Math.PI/2;
const headPivot = new THREE.Group(); headPivot.position.set(0, .13, -.5); patientG.add(headPivot);
const headG = new THREE.Group(); headG.position.set(0, -.13, .5); headPivot.add(headG);
const head = new THREE.Mesh(new THREE.SphereGeometry(.1, 32, 24), M.skin); head.scale.set(.92, 1, 1.1); head.position.set(0, .2, -.6); add(head, headG, true, false);
const hair = new THREE.Mesh(new THREE.SphereGeometry(.106, 32, 16, 0, Math.PI*2, 0, Math.PI*.5), M.hair); hair.rotation.x = -1.8; hair.position.set(0, .195, -.615); hair.scale.set(.95, 1, 1.12); add(hair, headG);
[-1,1].forEach(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(.022, 12, 10), M.skin); e.scale.set(.5,1,.8); e.position.set(sx*.09, .19, -.6); add(e, headG); });
const nose = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 10), M.skin); nose.scale.set(.8, 1.1, 1.3); nose.position.set(0, .292, -.565); add(nose, headG);
const lidM = std('#8a6450', .7); [-1,1].forEach(sx => { const l = box(.028, .004, .008, lidM, sx*.036, .287, -.6, headG); l.rotation.x = .3; });
box(.03, .004, .006, std('#9a6a58', .7), 0, .282, -.515, headG);
// left forearm resting on the blanket, wristband on the wrist
const arm = new THREE.Group(); bed.add(arm);
const yAt = (x, z) => blanketPoint(x, FOOT_Z - z).y;
const ELB = new THREE.Vector3(.27, yAt(.27, -1.4) + .03, -1.4), Wr = new THREE.Vector3(.15, yAt(.15, -1.1) + .035, -1.1);
rod(ELB.toArray(), Wr.toArray(), .033, M.skin, arm);
const sleeve = rod([.3, ELB.y+.01, -1.52], [ELB.x - .01, ELB.y + .005, ELB.z + .04], .045, M.gown, arm);
const dir = Wr.clone().sub(ELB).normalize();
const hand = new THREE.Mesh(new THREE.SphereGeometry(.043, 20, 14), M.skin); hand.scale.set(.95, .42, 1.35);
hand.position.copy(Wr).add(dir.clone().multiplyScalar(.062)); hand.position.y -= .008; hand.lookAt(hand.position.clone().add(dir)); add(hand, arm);
const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
rod(Wr.clone().add(dir.clone().multiplyScalar(.035)).add(side.clone().multiplyScalar(.03)).toArray(), Wr.clone().add(dir.clone().multiplyScalar(.075)).add(side.clone().multiplyScalar(.05)).add(new THREE.Vector3(0,-.006,0)).toArray(), .011, M.skin, arm);
const wbPos = Wr.clone().add(dir.clone().multiplyScalar(-.025));
const band = new THREE.Mesh(new THREE.CylinderGeometry(.037, .037, .024, 24, 1, true), std('#f6f6f2', .4, { side:THREE.DoubleSide }));
band.position.copy(wbPos); band.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir); add(band, arm);
const idTex = ctex(400, 150, (g, W, H) => {
  g.fillStyle = '#ffffff'; g.fillRect(0,0,W,H);
  g.fillStyle = '#111'; g.font = '700 34px Arial'; g.fillText('TRAINING, Robin', 14, 42);
  g.font = '24px Arial'; g.fillText('22/07/1968   999 345 6780', 14, 76);
  for(let x=14;x<W-14;){ const w = 2 + (Math.sin(x*1.7)+1)*1.6|0; g.fillRect(x, 92, w, 44); x += w + 2 + (Math.cos(x*.9)+1)*1.5|0; }
});
const idPanel = plane(.064, .024, new THREE.MeshStandardMaterial({ map:idTex, roughness:.4 }), 0, 0, 0, arm);
idPanel.position.copy(wbPos).add(new THREE.Vector3(0, .038, 0));
idPanel.lookAt(idPanel.position.clone().add(new THREE.Vector3(.35, 1, .55)));
idPanel.rotateZ(Math.atan2(dir.x, -dir.z) - .25 + Math.PI);
const wristAnchor = wbPos.clone();
shadowBlob(1.4, 2.6, 0, -1.3, .5);

/* ---------- bedside monitor on a stand ---------- */
const monStand = new THREE.Group(); monStand.position.set(-.82, 0, -2.0); scene.add(monStand);
for(let i=0;i<5;i++){ const a = i*Math.PI*2/5; rod([0,.07,0],[Math.cos(a)*.28,.05,Math.sin(a)*.28], .015, M.dark, monStand); cyl(.025,.025,.03,M.black,Math.cos(a)*.28,.025,Math.sin(a)*.28,monStand); }
cyl(.018, .018, 1.25, M.steel, 0, .68, 0, monStand);
const basket = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.32, .16, .22, 4, 2, 3)), new THREE.LineBasicMaterial({ color:col('#9aa0a6') }));
basket.position.set(.05, .95, .05); monStand.add(basket);
const monitor = new THREE.Group(); monitor.position.set(0, 1.42, .02); monitor.rotation.y = .5; monStand.add(monitor);
box(.4, .32, .11, std('#e7e4dc', .45), 0, 0, 0, monitor, .02);
box(.36, .04, .02, std('#d0ccc2', .5), 0, -.135, .052, monitor, .006);
const monCanvasTex = ctex(640, 480, () => {});
const monScreen = plane(.33, .245, new THREE.MeshBasicMaterial({ map:monCanvasTex, toneMapped:false }), 0, .02, .0565, monitor);
const monGlow = new THREE.PointLight(col('#7fd8b0'), .9, 1.4, 2); monGlow.position.set(.15, 0, .35); monitor.add(monGlow);
tube([[-.82+.05,1.3,-1.98],[-.6,1.05,-1.85],[-.3,.95,-1.6],[.05,.88,-1.5]], .005, std('#3a8dc4', .4));
shadowBlob(.8, .8, -.82, -2.0, .4);

/* ---------- drip stand and infusion pump ---------- */
const drip = new THREE.Group(); drip.position.set(.72, 0, -2.0); scene.add(drip);
for(let i=0;i<5;i++){ const a = i*Math.PI*2/5 + .3; rod([0,.07,0],[Math.cos(a)*.27,.05,Math.sin(a)*.27], .014, M.steel, drip); cyl(.022,.022,.03,M.black,Math.cos(a)*.27,.022,Math.sin(a)*.27,drip); }
cyl(.013, .013, 2.0, M.steel, 0, 1.06, 0, drip);
[0,1,2,3].forEach(i => { const a = i*Math.PI/2; rod([0,2.04,0],[Math.cos(a)*.1,2.08,Math.sin(a)*.1], .006, M.steel, drip); });
box(.13, .23, .035, M.bag, .1, 1.86, 0, drip, .02);
plane(.08, .1, new THREE.MeshStandardMaterial({ map:label('0.9% NaCl', 200, 250, { bg:'#ffffff', fg:'#1d3d6b', size:34 }), roughness:.4, transparent:true, opacity:.92 }), .1, 1.88, .019, drip);
cyl(.012, .012, .07, M.bag, .1, 1.71, 0, drip);
const drop = new THREE.Mesh(new THREE.SphereGeometry(.005, 8, 6), new THREE.MeshStandardMaterial({ color:col('#cfe8ff'), roughness:.1 })); drop.position.set(.1, 1.72, 0); drip.add(drop);
const pump = new THREE.Group(); pump.position.set(0, 1.22, .07); pump.rotation.y = .35; drip.add(pump);
box(.14, .22, .11, std('#efefea', .45), 0, 0, 0, pump, .015);
box(.04, .05, .03, M.steel, -.075, 0, -.03, pump);
const pumpTex = ctex(256, 160, () => {});
const pumpScreen = plane(.1, .062, new THREE.MeshBasicMaterial({ map:pumpTex, toneMapped:false }), 0, .055, .0555, pump);
for(let r=0;r<3;r++) for(let c=0;c<3;c++) box(.022, .014, .006, std(r===2&&c===2?'#3f9a5c':'#d6d3cb', .5), -.03 + c*.03, -.025 - r*.024, .056, pump, .003);
tube([[.82,1.7,-2.0],[.83,1.45,-1.96],[.75,1.33,-1.93],[.72,1.11,-1.92]], .0035, M.lineTube);
tube([[.72,1.1,-1.92],[.66,.95,-1.7],[.45,.86,-1.3],[Wr.x+.06, Wr.y+.02, Wr.z+.08],[Wr.x+.03, Wr.y+.01, Wr.z+.1]], .0035, M.lineTube);
shadowBlob(.7, .7, .72, -2.0, .35);

/* ---------- bedside cabinet and jug ---------- */
const cab = new THREE.Group(); cab.position.set(-1.35, 0, -2.05); cab.rotation.y = .12; scene.add(cab);
box(.48, .78, .46, M.cream, 0, .41, 0, cab, .02);
box(.44, .2, .01, std('#e9e3d6', .45), 0, .64, .232, cab, .005); box(.44, .44, .01, std('#e9e3d6', .45), 0, .3, .232, cab, .005);
box(.12, .015, .02, M.chrome, 0, .67, .245, cab); box(.12, .015, .02, M.chrome, 0, .45, .245, cab);
cyl(.06, .055, .2, M.jug, -.08, .9, -.02, cab); cyl(.064, .064, .025, std('#3f7fb0', .4), -.08, 1.01, -.02, cab);
cyl(.035, .03, .09, M.jug, .1, .845, .05, cab);
box(.1, .04, .07, std('#c8b89a', .6), .1, .815, -.1, cab, .01);
shadowBlob(.8, .8, -1.35, -2.05, .45);
// the medicine pot and pack sit on the blanket by Robin's hand while you're at the bedside
const trayG = new THREE.Group(); trayG.position.set(.3, yAt(.3, -1.2) + .004, -1.2); trayG.rotation.y = .9; trayG.visible = false; bed.add(trayG);
const pot = cyl(.026, .02, .036, std('#f4f4f1', .45), .07, .018, 0, trayG, 24);
const tablets = [[.063, .031, -.004], [.077, .031, .006]].map(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(.008, 14, 10), std('#ffffff', .6)); m.scale.set(1, .42, 1); m.position.set(...p); m.userData.home = m.position.clone(); add(m, trayG, false, false); return m; });
const trayPack = new THREE.Group(); trayPack.position.set(-.07, .014, 0); trayPack.rotation.y = .25; trayG.add(trayPack);
box(.1, .028, .065, std('#fbfbf8', .55), 0, 0, 0, trayPack, .004);
const trayTop = plane(.098, .063, new THREE.MeshStandardMaterial({ roughness:.5 }), 0, .0145, 0, trayPack); trayTop.rotation.x = -Math.PI/2;

/* ---------- visitor chair ---------- */
const chair = new THREE.Group(); chair.position.set(-1.55, 0, -.2); chair.rotation.y = .55; scene.add(chair);
const vinyl = std('#3b6f7c', .5);
box(.5, .1, .5, vinyl, 0, .46, 0, chair, .04); box(.5, .55, .1, vinyl, 0, .78, -.24, chair, .04);
[[-.22,-.22],[.22,-.22],[-.22,.22],[.22,.22]].forEach(([x,z]) => box(.035, .42, .035, M.steel, x, .21, z, chair));
box(.06, .05, .46, M.dark, -.27, .63, 0, chair, .02); box(.06, .05, .46, M.dark, .27, .63, 0, chair, .02);
shadowBlob(.9, .9, -1.55, -.2, .45);

/* ---------- privacy curtains and rails ---------- */
function curtain(x, z0, z1, folds){
  const w = Math.abs(z1-z0), g = new THREE.PlaneGeometry(w, 2.3, 60, 10), p = g.attributes.position;
  for(let i=0;i<p.count;i++){ const u = p.getX(i); p.setZ(i, Math.sin((u/w)*Math.PI*folds)*.045 + Math.sin(u*37)*.006); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, M.curtain); m.rotation.y = Math.PI/2; m.position.set(x, 1.4, (z0+z1)/2); return add(m);
}
curtain(-1.95, -2.45, -1.8, 9); curtain(1.45, -2.45, -1.95, 8); curtain(-1.95, .35, .9, 7);
const railM = std('#d9dcdf', .3, { metalness:.6 });
box(.03, .03, 3.4, railM, -1.95, 2.56, -.8); box(.03, .03, 3.4, railM, 1.45, 2.56, -.8); box(3.4, .03, .03, railM, -.25, 2.56, .9);
for(const z of [-2.1, -.8, .5]){ box(.01, .14, .01, railM, -1.95, 2.63, z); box(.01, .14, .01, railM, 1.45, 2.63, z); }

/* ---------- drug trolley ---------- */
const trolley = new THREE.Group(); trolley.position.set(1.6, 0, -.65); trolley.rotation.y = -.42; scene.add(trolley);
const TW = .66, TD = .5, TT = .98;
box(.04, .86, TD, M.trolley, -TW/2+.02, .53, 0, trolley, .01); box(.04, .86, TD, M.trolley, TW/2-.02, .53, 0, trolley, .01);
box(TW, .86, .02, std('#d9d4c8', .6), 0, .53, -TD/2+.01, trolley);
box(TW+.04, .05, TD+.04, std('#cfd3d6', .45), 0, TT, 0, trolley, .015);
box(TW, .06, TD, M.trolley, 0, .1, 0, trolley, .015);
box(TW-.04, .03, .02, M.trolley, 0, .945, TD/2-.005, trolley, .006);
[[-.27,-.2],[.27,-.2],[-.27,.2],[.27,.2]].forEach(([x,z]) => { cyl(.04,.04,.035,M.black,x,.04,z,trolley).rotation.z = Math.PI/2; box(.03,.05,.03,M.steel,x,.075,z,trolley); });
box(.035, .86, .035, std('#4c6b8f', .45), -TW/2-.005, .53, TD/2-.01, trolley, .01); box(.035, .86, .035, std('#4c6b8f', .45), TW/2+.005, .53, TD/2-.01, trolley, .01);
const PACKS = [
  { id:'para', name:'Paracetamol', str:'500 mg tablets', band:'#1f6fb2' },
  { id:'ibu', name:'Ibuprofen', str:'400 mg tablets', band:'#c2410c', why:'Ibuprofen isn’t prescribed for Robin Training.' },
  { id:'aml', name:'Amlodipine', str:'5 mg tablets', band:'#2f855a', why:'Amlodipine isn’t due. It was given at 08:00.' },
  { id:'ome', name:'Omeprazole', str:'20 mg capsules', band:'#7c3aed', why:'Omeprazole isn’t due. It was given at 08:00.' },
  { id:'coam', name:'Co-amoxiclav', str:'500/125 mg tablets', band:'#b42318', why:'Allergy alert. Robin Training is allergic to penicillin, and co-amoxiclav contains penicillin.' },
  { id:'sen', name:'Senna', str:'7.5 mg tablets', band:'#b7791f', why:'Senna isn’t prescribed for Robin Training.' },
  { id:'ond', name:'Ondansetron', str:'4 mg tablets', band:'#0e7490', why:'Ondansetron is only prescribed when needed, and as an injection.' },
  { id:'ator', name:'Atorvastatin', str:'40 mg tablets', band:'#475569', why:'Atorvastatin isn’t prescribed for Robin Training.' }
];
function packLabel(pk){
  return ctex(256, 168, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = pk.band; g.fillRect(0, 0, w, 26);
    g.fillStyle = '#14202b'; g.font = '700 38px Arial'; g.fillText(pk.name, 12, 74);
    g.fillStyle = '#3a4652'; g.font = '26px Arial'; g.fillText(pk.str, 12, 112);
    g.fillStyle = pk.band; g.fillRect(12, 134, 64, 8);
  });
}
const DRAWERS = ['DRUGS', 'IV FLUIDS', 'CANNULATION', 'WOUND CARE', 'CONSUMABLES'];
const drawers = [];
DRAWERS.forEach((name, i) => {
  const d = new THREE.Group(); const y = .86 - i*.15; d.position.set(0, y, 0); trolley.add(d);
  box(.57, .135, .02, M.drawer, 0, 0, TD/2-.005, d, .012);
  box(.2, .016, .03, M.chrome, .12, .02, TD/2+.012, d, .006);
  plane(.17, .032, new THREE.MeshStandardMaterial({ map:label(name, 340, 64, { size:30 }), roughness:.5 }), -.15, .02, TD/2+.0055, d);
  box(.55, .01, .44, std('#d3d0c8', .6), 0, -.055, .02, d); box(.01, .1, .44, std('#d3d0c8', .6), -.27, -.01, .02, d); box(.01, .1, .44, std('#d3d0c8', .6), .27, -.01, .02, d);
  if(i === 0){
    PACKS.forEach((pk, k) => {
      const g = new THREE.Group(); g.position.set(-.195 + (k%4)*.13, -.028, .08 + Math.floor(k/4)*.095); d.add(g);
      box(.115, .036, .075, std('#fbfbf8', .55), 0, 0, 0, g, .004);
      pk.tex = packLabel(pk);
      const top = plane(.113, .073, new THREE.MeshStandardMaterial({ map:pk.tex, roughness:.5 }), 0, .0185, 0, g); top.rotation.x = -Math.PI/2;
      g.traverse(o => { o.userData.pack = pk.id; });
      pk.group = g;
    });
  }
  d.userData = { drawer:true, open:0, target:0, baseZ:0, name };
  drawers.push(d);
});
// sharps bin on the side
const sharps = new THREE.Group(); sharps.position.set(TW/2+.09, .78, .02); trolley.add(sharps);
box(.14, .26, .2, M.yellow, 0, 0, 0, sharps, .01); box(.15, .03, .21, std('#e4a812', .5), 0, .14, 0, sharps, .008);
plane(.08, .08, new THREE.MeshStandardMaterial({ map:label('SHARPS', 160, 160, { bg:'#ffffff', fg:'#b42318', size:30 }), roughness:.5 }), .071, 0, 0, sharps).rotation.y = Math.PI/2;
// top: gloves, label printer, scanner in its cradle
box(.13, .06, .08, std('#3f6fb8', .5), .25, TT+.055, -.19, trolley, .006);
box(.11, .065, .09, M.white, -.26, TT+.057, -.19, trolley, .01);
const scanner = new THREE.Group(); scanner.position.set(.25, TT+.025, .1); scanner.rotation.y = -.6; trolley.add(scanner);
box(.07, .02, .07, M.dark, 0, 0, 0, scanner, .008);
const gun = new THREE.Group(); scanner.add(gun);
const handle = box(.032, .11, .04, M.black, 0, .06, 0, gun, .012); handle.rotation.x = -.25;
const headS = box(.05, .045, .085, M.black, 0, .12, .03, gun, .015); headS.rotation.x = -.25;
plane(.035, .02, new THREE.MeshBasicMaterial({ color:col('#c0281f') }), 0, .12, .0735, gun).rotation.x = -.25;
shadowBlob(1.1, 1.0, 1.6, -.65, .55);

/* ---------- laptop with the live ward computer on its screen ---------- */
const laptop = new THREE.Group(); laptop.position.set(-.05, TT+.026, .02); laptop.rotation.y = .1; trolley.add(laptop);
const kbTex = ctex(512, 360, (g, W, H) => {
  g.fillStyle = '#2b2e33'; g.fillRect(0,0,W,H);
  g.fillStyle = '#1a1c20';
  for(let r=0;r<5;r++) for(let c=0;c<14;c++) g.fillRect(28 + c*33, 24 + r*33, 28, 27);
  g.fillRect(110, 192, 290, 26);
  g.fillStyle = '#34383e'; g.fillRect(170, 236, 172, 108);
});
box(.34, .016, .24, std('#3a3d42', .4, { metalness:.4 }), 0, 0, 0, laptop, .006);
plane(.32, .225, new THREE.MeshStandardMaterial({ map:kbTex, roughness:.6 }), 0, .0085, .0, laptop).rotation.x = -Math.PI/2;
const lid = new THREE.Group(); lid.position.set(0, .008, -.118); lid.rotation.x = -.24; laptop.add(lid);
box(.34, .236, .008, std('#3a3d42', .4, { metalness:.4 }), 0, .118, 0, lid, .004);
const SCW = .31, SCH = SCW/1.4;
const hole = new THREE.Mesh(new THREE.PlaneGeometry(SCW, SCH), new THREE.MeshBasicMaterial({ color:0x000000, opacity:0, transparent:true, blending:THREE.NoBlending, side:THREE.FrontSide }));
hole.position.set(0, .124, .0042); lid.add(hole);
const epr = document.createElement('div'); epr.className = 'epr'; epr.id = 'epr'; epr.setAttribute('role','region'); epr.setAttribute('aria-label','Ward computer');
const eprObj = new THREE.CSS3DObject(epr); eprObj.scale.setScalar(SCW/1120); hole.add(eprObj);
// in computer mode the screen is moved to a flat layer that sits exactly over the 3D screen,
// so typing and clicking work like a normal web page
let eprFlat = false, epr3dTransform = '';
const flatHost = document.getElementById('flat');
function placeFlat(){
  const tl = hole.localToWorld(V(-SCW/2, SCH/2, 0)).project(camera), br = hole.localToWorld(V(SCW/2, -SCH/2, 0)).project(camera);
  const x0 = (tl.x*.5+.5)*W_, y0 = (-tl.y*.5+.5)*H_, x1 = (br.x*.5+.5)*W_, y1 = (-br.y*.5+.5)*H_;
  epr.style.transform = `translate(${x0}px,${y0}px) scale(${(x1-x0)/1120},${(y1-y0)/800})`;
}
function dockFlat(){
  if(eprFlat) return;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(); epr3dTransform = epr.style.transform;
  eprFlat = true; flatHost.appendChild(epr); epr.style.display = ''; epr.style.transformOrigin = '0 0'; placeFlat();
}
function undockFlat(){
  if(!eprFlat) return;
  eprFlat = false; epr.style.transformOrigin = ''; epr.style.transform = epr3dTransform;
  cssRenderer.domElement.firstChild.appendChild(epr);
}
const lapGlow = new THREE.PointLight(col('#a9c8ff'), .7, 1.1, 2); lapGlow.position.set(0, .14, .25); lid.add(lapGlow);


/* ---------- right wall: clock, hand gel, glove boxes ---------- */
const clockTex = ctex(256, 256, () => {});
function drawClock(){
  const { g } = clockTex.userData; const [hh, mm] = now().split(':').map(Number);
  g.clearRect(0,0,256,256); g.fillStyle = '#f7f6f1'; g.beginPath(); g.arc(128,128,124,0,7); g.fill();
  g.strokeStyle = '#2b2e33'; g.lineWidth = 10; g.stroke();
  for(let i=0;i<12;i++){ const a = i*Math.PI/6; g.lineWidth = i%3 ? 4 : 8; g.beginPath(); g.moveTo(128+Math.sin(a)*100, 128-Math.cos(a)*100); g.lineTo(128+Math.sin(a)*114, 128-Math.cos(a)*114); g.stroke(); }
  const hand = (a, len, w) => { g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(128,128); g.lineTo(128+Math.sin(a)*len, 128-Math.cos(a)*len); g.stroke(); };
  hand(((hh%12) + mm/60)*Math.PI/6, 62, 9); hand(mm*Math.PI/30, 92, 6);
  g.fillStyle = '#c0281f'; g.beginPath(); g.arc(128,128,7,0,7); g.fill();
  clockTex.needsUpdate = true;
}
const wallClock = new THREE.Group(); wallClock.position.set(RX1-.02, 2.12, -1.1); wallClock.rotation.y = -Math.PI/2; scene.add(wallClock);
cyl(.17, .17, .04, M.dark, 0, 0, 0, wallClock, 40).rotation.x = Math.PI/2;
const clockFace = new THREE.Mesh(new THREE.CircleGeometry(.155, 48), new THREE.MeshStandardMaterial({ map:clockTex, roughness:.4 })); clockFace.position.z = .021; wallClock.add(clockFace);
const gel = new THREE.Group(); gel.position.set(RX1-.04, 1.25, -.2); gel.rotation.y = -Math.PI/2; scene.add(gel);
box(.12, .24, .08, M.white, 0, 0, 0, gel, .015); box(.1, .06, .02, std('#2f6db5', .45), 0, .03, .042, gel, .008); box(.04, .03, .05, std('#d9d9d4', .4), 0, -.13, .02, gel, .006);
const gloves = new THREE.Group(); gloves.position.set(RX1-.06, 1.35, .45); gloves.rotation.y = -Math.PI/2; scene.add(gloves);
box(.42, .16, .1, M.steel, 0, 0, 0, gloves, .008);
['#3f6fb8','#6b4fb0','#2e8a64'].forEach((c, i) => box(.12, .12, .085, std(c, .5), -.135 + i*.135, 0, .015, gloves, .006));

/* ---------- baked lighting: which meshes carry a lightmap ---------- */
function bakeList(){
  const list = [];
  scene.traverse(o => { if(o.isMesh && o.visible && o.material && o.material.isMeshStandardMaterial && !o.material.transparent && !o.userData.noBake) list.push(o); });
  return list;
}

/* ---------- live screens ---------- */
const HR = 72, beat = 60/HR;
const ecgAt = p => .12*gauss(p,.1,.025) - .12*gauss(p,.2,.008) + 1*gauss(p,.22,.009) - .25*gauss(p,.245,.01) + .3*gauss(p,.45,.05);
const plethAt = p => gauss(p,.36,.07) + .35*gauss(p,.55,.05);
const MON = { x:0, last:null, numsAt:-1 };
function drawMonitor(t, dt){
  const { c, g } = monCanvasTex.userData, W = c.width, H = c.height, TW_ = 410;
  if(MON.last === null){ g.fillStyle = '#05080a'; g.fillRect(0,0,W,H); }
  const lanes = [
    { y:110, a:-62, f:() => ecgAt((t % beat)/beat), col:'#3ee07a' },
    { y:215, a:-42, f:() => plethAt(((t-.12) % beat + beat) % beat / beat) - .5, col:'#f2d24b' },
    { y:320, a:-26, f:() => Math.sin(t*2*Math.PI*18/60), col:'#7ec8f0' }
  ];
  const step = Math.max(1, dt*170), nx = MON.x + step;
  g.fillStyle = '#05080a'; g.fillRect(MON.x, 40, Math.min(18, TW_-MON.x) + step, 330);
  g.lineWidth = 3; g.lineJoin = 'round';
  lanes.forEach((L, i) => {
    const y = L.y + L.a*L.f();
    if(MON.last && MON.x > 0){ g.strokeStyle = L.col; g.beginPath(); g.moveTo(MON.x, MON.last[i]); g.lineTo(Math.min(nx, TW_), y); g.stroke(); }
    (MON.last = MON.last || [])[i] = y;
  });
  MON.x = nx; if(MON.x >= TW_){ MON.x = 0; MON.last = null; g.fillStyle = '#05080a'; g.fillRect(0, 40, 24, 330); }
  if(Math.floor(t) !== MON.numsAt){
    MON.numsAt = Math.floor(t);
    g.fillStyle = '#05080a'; g.fillRect(TW_+6, 30, W-TW_-6, H-30); g.fillRect(0, 0, W, 36); g.fillRect(0, 380, TW_, H-380);
    g.fillStyle = '#9fb0bd'; g.font = '20px Arial'; g.fillText('BED 4   TRAINING, ROBIN', 14, 26); g.textAlign = 'right'; g.fillText(now(), W-14, 26); g.textAlign = 'left';
    const big = (txt, x, y, color, size) => { g.fillStyle = color; g.font = `700 ${size}px Arial`; g.textAlign = 'right'; g.fillText(txt, x, y); g.textAlign = 'left'; };
    g.font = '16px Arial'; g.fillStyle = '#3ee07a'; g.fillText('HR', TW_+18, 70); big(String(HR), W-14, 120, '#3ee07a', 64);
    g.font = '16px Arial'; g.fillStyle = '#ff6b5a'; g.fillText('NIBP 21:40', TW_+18, 160); big('96/58', W-14, 204, '#ff6b5a', 46); big('(71)', W-14, 236, '#ff6b5a', 26);
    g.font = '16px Arial'; g.fillStyle = '#f2d24b'; g.fillText('SpO₂', TW_+18, 272); big('98', W-14, 316, '#f2d24b', 50);
    g.font = '16px Arial'; g.fillStyle = '#7ec8f0'; g.fillText('RR', TW_+18, 352); big('18', W-80, 400, '#7ec8f0', 42);
    g.fillStyle = '#e8ecef'; g.font = '16px Arial'; g.fillText('TEMP', TW_+18, 432); big('36.8', W-14, 466, '#e8ecef', 34);
    g.fillStyle = '#56636d'; g.font = '16px Arial'; g.fillText('II   x1.0', 14, 62); g.fillText('Pleth', 14, 170); g.fillText('Resp', 14, 276);
    g.fillStyle = '#0d1a14'; g.fillRect(14, 404, 220, 52); g.fillStyle = '#3ee07a'; g.font = '700 18px Arial'; g.fillText('ALARMS ON', 28, 437);
  }
  monCanvasTex.needsUpdate = true;
}
function drawPump(t){
  const { c, g } = pumpTex.userData, W = c.width, H = c.height;
  g.fillStyle = '#123d6b'; g.fillRect(0,0,W,H);
  g.fillStyle = '#e8f1fa'; g.font = '700 26px Arial'; g.fillText('NaCl 0.9%', 14, 36);
  g.font = '700 44px Arial'; g.fillText('83', 14, 92); g.font = '20px Arial'; g.fillText('mL/h', 76, 92);
  g.font = '18px Arial'; g.fillText('VTBI 412 mL', 14, 128);
  g.fillStyle = Math.floor(t*2) % 2 ? '#5fe08a' : '#1d5c3a'; g.beginPath(); g.arc(W-28, 30, 10, 0, 7); g.fill();
  g.fillStyle = '#9cc2e6'; g.font = '16px Arial'; g.textAlign = 'right'; g.fillText('RUNNING', W-14, 128); g.textAlign = 'left';
  pumpTex.needsUpdate = true;
}

/* ---------- interactive objects and views ---------- */
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const wp = o => o.getWorldPosition(new THREE.Vector3());
const wn = o => o.getWorldDirection(new THREE.Vector3());
const ITEMS = {
  monitor: { root:monitor, tag:'Bedside monitor', anchor:() => wp(monitor).add(V(0,.22,0)),
    view:() => { const c = wp(monScreen), n = wn(monScreen); return { pos:c.clone().add(n.multiplyScalar(.62)), target:c, fov:38 }; },
    text:'<b>Bedside monitor.</b> Read the patient’s observations from the screen.' },
  wrist: { root:arm, tag:'Wristband', anchor:() => wristAnchor.clone().add(V(0,.08,0)),
    view:() => ({ pos:wristAnchor.clone().add(V(.17,.3,.24)), target:wristAnchor.clone(), fov:30 }),
    text:'<b>Patient wristband.</b> Robin Training, born 22/07/1968, NHS number 999 345 6780.' },
  pump: { root:pump, tag:'Infusion pump', noLabel:true, anchor:() => wp(pump).add(V(0,.17,0)),
    view:() => { const c = wp(pumpScreen), n = wn(pumpScreen); return { pos:c.clone().add(n.multiplyScalar(.42)).add(V(0,.03,0)), target:c.clone().add(V(0,-.04,0)), fov:40 }; },
    text:'<b>Infusion pump.</b> Sodium chloride 0.9% running at 83 mL an hour.' },
  trolley: { root:trolley, tag:'Drug trolley', anchor:() => trolley.localToWorld(V(0,.62,TD/2+.05)),
    view:() => { const c = trolley.localToWorld(V(0,.62,.2)), f = trolley.localToWorld(V(0,.62,1.25)); f.y = 1.25; return { pos:f, target:c, fov:46 }; },
    text:'<b>Drug trolley.</b> Select a drawer to open it, or the laptop to use the ward computer.' },
  laptop: { root:laptop, tag:'Ward computer', anchor:() => hole.localToWorld(V(0,.15,0)), computer:true },
  patient: { root:patientG, tag:'Patient', anchor:() => patientG.localToWorld(V(0,.42,-.6)),
    view:() => ({ pos:V(.82, 1.5, -.55), target:V(.08, .86, -1.5), fov:48 }),
    text:'<b>Robin Training, Bed 4.</b> Awake and comfortable.' },
  drawer: { root:null, noLabel:true, view:() => ({ pos:trolley.localToWorld(V(0, 1.42, .8)), target:trolley.localToWorld(V(0, .82, .5)), fov:46 }),
    text:'<b>Drugs drawer.</b> Select a pack to pick it up.' },
  glance: { root:null, noLabel:true, view:() => { const c = wp(hole), n = wn(hole); return { pos:c.clone().add(n.multiplyScalar(.62)).add(V(0,.05,0)), target:c, fov:40 }; },
    text:'<b>Ward computer.</b> The screen shows the result of your scan.' },
  scanner: { root:scanner, tag:'Scanner', hidden:() => WS.scannerHeld, anchor:() => scanner.localToWorld(V(0,.2,0)),
    view:() => ({ pos:scanner.localToWorld(V(.03,.2,.36)), target:scanner.localToWorld(V(0,.085,0)), fov:34 }),
    text:'<b>Barcode scanner.</b> Scans the patient’s wristband and each medicine before a dose is given.' },
  board: { root:board, tag:'Bed board', noLabel:true, anchor:() => wp(board).add(V(0,.28,0)),
    view:() => { const c = wp(board); return { pos:c.clone().add(V(-.15,-.25,1.05)), target:c, fov:38 }; },
    text:'<b>Bed board.</b> Bed 4, Robin Training.' },
  window: { root:null, tag:'Window', noLabel:true, anchor:() => V((WX0+WX1)/2, WY1-.2, RZ0+.05),
    view:() => ({ pos:V(1.35, 1.6, -.9), target:V(2.3, 1.45, -6), fov:52 }), text:'<b>Window.</b> The city at night, a train crossing in the distance.' }
};
// clone materials under interactive roots so hover highlights one object only
Object.entries(ITEMS).forEach(([id, it]) => {
  if(!it.root) return;
  it.root.traverse(o => { o.userData.item = o.userData.item || id; if(o.isMesh && o.material && o.material.emissive && o !== hole){ o.material = o.material.clone(); o.material.userData.e0 = o.material.emissive.clone(); } });
});
laptop.traverse(o => { o.userData.item = 'laptop'; });
scanner.traverse(o => { o.userData.item = 'scanner'; });
const winPick = new THREE.Mesh(new THREE.PlaneGeometry(WX1-WX0, WY1-WY0), new THREE.MeshBasicMaterial({ visible:false }));
winPick.position.set((WX0+WX1)/2, (WY0+WY1)/2, RZ0-.04); winPick.userData.item = 'window'; scene.add(winPick);
const picks = []; scene.traverse(o => { if(o.isMesh && o.userData.item) picks.push(o); });

/* ---------- camera control: stand, look around, fly to things ---------- */
const HOME = { pos:V(.62, 1.55, 1.9), target:V(.05, .84, -1.45), fov:54 };
const homeFov = () => { const a = W_/H_; return a >= 1 ? 54 : Math.min(78, 54/Math.max(a, .62)); };
const look = { yaw:0, pitch:0, baseYaw:0, basePitch:0, fov:52, pos:HOME.pos.clone() };
let fly = null, current = 'home', parallax = { x:0, y:0, tx:0, ty:0 };
function poseFrom(pos, target){ const c = new THREE.PerspectiveCamera(); c.position.copy(pos); c.lookAt(target); return c.quaternion.clone(); }
function setLookFromQuat(q){ const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); look.yaw = look.baseYaw = e.y; look.pitch = look.basePitch = e.x; }
function flyTo(v, dur = 1200, done){
  const q1 = poseFrom(v.pos, v.target);
  if(reduceMotion) dur = 0;
  fly = { p0:camera.position.clone(), q0:camera.quaternion.clone(), f0:camera.fov, p1:v.pos.clone(), q1, f1:v.fov, t0:performance.now(), dur, done };
}
function laptopView(){
  const c = wp(hole), n = wn(hole), fov = 40, tan = Math.tan(THREE.MathUtils.degToRad(fov/2));
  const usableH = Math.max(.5, (H_ - (H_ < 520 ? 16 : 140))/H_);
  const d = Math.max(SCH/(2*tan*usableH), SCW/(2*tan*(W_/H_)*.94));
  return { pos:c.clone().add(n.multiplyScalar(d)), target:c, fov };
}
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
const caption = document.getElementById('caption'), backBtn = document.getElementById('backBtn');
const HINT = 'Drag to look around. Scroll or pinch to zoom. Select things to use them.';
function goTo(id){
  const it = ITEMS[id];
  if(it.computer){ enterComputer(); return; }
  setHover(null); tooltip.hidden = true;
  mode = 'focus'; current = id; stage.classList.remove('computer'); stage.classList.add('focused');
  WS.msg = null; visitDone = false; if(id === 'monitor') WS.monitorChecked = true;
  backBtn.hidden = false; backBtn.textContent = 'Back to the bay';
  lastView = it.view(); flyTo(lastView); fire();
}
let lastView = null;
function goHome(view){
  mode = 'explore'; current = 'home'; stage.classList.remove('computer','focused');
  WS.msg = null; backBtn.hidden = true; drawers.forEach(d => d.userData.target = 0);
  flyTo(view || { ...HOME, fov:homeFov() }, 1100); fire();
}
function enterComputer(){
  setHover(null); tooltip.hidden = true;
  mode = 'computer'; current = 'laptop'; stage.classList.add('computer'); stage.classList.remove('focused');
  backBtn.hidden = false; backBtn.textContent = 'Step back from the computer';
  document.getElementById('rotateHint').hidden = !(W_ < 600 && H_ > W_);
  renderEPR();
  flyTo(laptopView(), 1300, () => { dockFlat(); const f = epr.querySelector('button,[tabindex="0"]'); f && f.focus({ preventScroll:true }); });
}
function exitComputer(){ undockFlat(); document.getElementById('rotateHint').hidden = true; goHome(); stage.focus({ preventScroll:true }); }
backBtn.onclick = () => mode === 'computer' ? exitComputer() : goHome();
document.addEventListener('keydown', e => { if(e.key === 'Escape' && mode !== 'explore') { mode === 'computer' ? exitComputer() : goHome(); } });

/* pointer handling */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pts = new Map(); let dragged = false, downAt = null, last = null, pinchD = 0, hovered = null;
const tooltip = document.getElementById('tooltip');
function pick(clientX, clientY){
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left)/r.width)*2 - 1, -((clientY - r.top)/r.height)*2 + 1);
  ray.setFromCamera(ndc, camera);
  for(const hit of ray.intersectObjects(picks, false)){
    let shown = true; for(let q = hit.object; q; q = q.parent) if(!q.visible){ shown = false; break; }
    if(!shown) continue;
    let drawer = null, pack = null;
    for(let q = hit.object; q; q = q.parent){ if(q.userData.pack && !pack) pack = q.userData.pack; if(q.userData.drawer){ drawer = q; break; } }
    return { item:hit.object.userData.item, drawer, pack };
  }
  return null;
}
const anims = [];
function tween(dur, fn, done){ anims.push({ t0:performance.now(), dur: reduceMotion ? Math.min(dur, 120) : dur, fn, done }); }
const easeOutBack = u => 1 + 2.2*Math.pow(u - 1, 3) + 1.2*Math.pow(u - 1, 2);
// a red scanner line sweeps across a label, then the thing that was scanned glows briefly
function scanFx(planeMesh, w, h, ok = true, glowTarget = null, done){
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(w*1.2, Math.max(.002, h*.09)), new THREE.MeshBasicMaterial({ color:col('#ff3b2f'), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false }));
  beam.position.z = .0015; planeMesh.add(beam);
  tween(560, u => { beam.position.y = -h/2 + h*u; beam.material.opacity = Math.sin(Math.PI*u)*.95; },
    () => { planeMesh.remove(beam); beam.geometry.dispose(); glowFx(glowTarget || planeMesh.parent, ok ? '#3ee07a' : '#ff5a4a'); done && done(); });
}
function glowFx(root, hex = '#3ee07a', dur = 900){
  const c = col(hex), mats = [];
  const each = f => Array.isArray(root) ? root.forEach(f) : root.traverse(f);
  each(o => {
    if(!o.isMesh || !o.material || !o.material.emissive) return;
    if(!o.material.userData.own){ o.material = o.material.clone(); o.material.userData.own = true; o.material.userData.e0 = o.material.userData.e0 || o.material.emissive.clone(); }
    mats.push(o.material);
  });
  tween(dur, u => { const k = Math.sin(Math.PI*u)*.6; mats.forEach(m => m.emissive.copy(m.userData.e0 || new THREE.Color(0,0,0)).lerp(c, k)); },
    () => mats.forEach(m => m.emissive.copy(m.userData.e0 || new THREE.Color(0,0,0))));
}
function setHover(id){
  if(hovered === id) return;
  if(hovered && ITEMS[hovered] && ITEMS[hovered].root) ITEMS[hovered].root.traverse(o => { if(o.isMesh && o.material.emissive && o.material !== M.lamp) o.material.emissive.copy(o.material.userData.e0 || new THREE.Color(0,0,0)); });
  hovered = id;
  if(id && ITEMS[id].root && !(mode === 'focus' && current === id)) ITEMS[id].root.traverse(o => { if(o.isMesh && o.material.emissive && o.material !== M.lamp) o.material.emissive.copy(col('#1e4a3a')).add(o.material.userData.e0 || new THREE.Color(0,0,0)); });
  stage.style.cursor = id ? 'pointer' : '';
}
renderer.domElement.addEventListener('pointerdown', e => {
  if(mode === 'computer') return;
  pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pts.size === 1){ dragged = false; downAt = { x:e.clientX, y:e.clientY }; last = { x:e.clientX, y:e.clientY }; }
  if(pts.size === 2){ const [a,b] = [...pts.values()]; pinchD = Math.hypot(a.x-b.x, a.y-b.y); }
});
window.addEventListener('pointermove', e => {
  const r = stage.getBoundingClientRect();
  parallax.tx = ((e.clientX - r.left)/r.width - .5); parallax.ty = ((e.clientY - r.top)/r.height - .5);
  if(!pts.has(e.pointerId)){
    if(mode !== 'computer' && !fly && e.target === renderer.domElement){
      const atTrolley = current === 'trolley' || current === 'drawer';
      const p = pick(e.clientX, e.clientY), id = p && (p.drawer && atTrolley ? 'trolley' : p.item);
      setHover(id);
      if(id){ tooltip.hidden = false; tooltip.textContent = p.pack && current === 'drawer' ? (() => { const k = PACKS.find(x => x.id === p.pack); return `Pick up ${k.name} ${k.str}`; })() : p.drawer && atTrolley ? (p.drawer.userData.open > .5 ? 'Close ' : 'Open ') + p.drawer.userData.name.toLowerCase() + ' drawer' : ITEMS[id].tag; tooltip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`; }
      else tooltip.hidden = true;
    } else tooltip.hidden = true;
    return;
  }
  pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if(pts.size >= 2){ const [a,b] = [...pts.values()], d = Math.hypot(a.x-b.x, a.y-b.y); look.fov = THREE.MathUtils.clamp(look.fov * pinchD/d, 18, 82); pinchD = d; dragged = true; return; }
  if(!dragged && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5){ dragged = true; stage.classList.add('dragging'); tooltip.hidden = true; }
  if(dragged){
    const k = .0032 * (look.fov/52);
    look.yaw = THREE.MathUtils.clamp(look.yaw + (e.clientX - last.x)*k, look.baseYaw - 1.1, look.baseYaw + 1.1);
    look.pitch = THREE.MathUtils.clamp(look.pitch + (e.clientY - last.y)*k, look.basePitch - .6, look.basePitch + .55);
  }
  last = { x:e.clientX, y:e.clientY };
});
window.addEventListener('pointerup', e => {
  if(!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if(pts.size === 0){
    stage.classList.remove('dragging');
    if(!dragged && mode !== 'computer'){
      const p = pick(e.clientX, e.clientY);
      if(p){
        if(p.pack && current === 'drawer') pickPack(p.pack);
        else if(p.drawer && (current === 'trolley' || current === 'drawer')) toggleDrawer(p.drawer);
        else if(p.item === current) primaryAction(current);
        else goTo(p.item);
      }
    }
  } else if(pts.size === 1){ const [p] = [...pts.values()]; last = { ...p }; }
});
window.addEventListener('pointercancel', e => { pts.delete(e.pointerId); stage.classList.remove('dragging'); });
renderer.domElement.addEventListener('wheel', e => {
  if(mode === 'computer') return; e.preventDefault();
  look.fov = THREE.MathUtils.clamp(look.fov * Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0012)), 18, 82);
}, { passive:false });
stage.addEventListener('keydown', e => {
  if(mode === 'computer' || e.target !== stage) return;
  const k = .06;
  if(e.key === 'ArrowLeft') look.yaw = Math.min(look.yaw + k, look.baseYaw + 1.1);
  else if(e.key === 'ArrowRight') look.yaw = Math.max(look.yaw - k, look.baseYaw - 1.1);
  else if(e.key === 'ArrowUp') look.pitch = Math.min(look.pitch + k, look.basePitch + .55);
  else if(e.key === 'ArrowDown') look.pitch = Math.max(look.pitch - k, look.basePitch - .6);
  else if(e.key === '+' || e.key === '=') look.fov = Math.max(18, look.fov*.9);
  else if(e.key === '-') look.fov = Math.min(82, look.fov*1.1);
  else return;
  e.preventDefault();
});

/* floating labels, which double as keyboard-accessible buttons */
const labelLayer = document.getElementById('labels');
const labelEls = Object.entries(ITEMS).filter(([id, it]) => !it.noLabel).map(([id, it]) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tag3d'; b.textContent = it.tag;
  b.setAttribute('aria-label', it.computer ? 'Use the ward computer' : `Look at the ${it.tag.toLowerCase()}`);
  b.onclick = () => goTo(id); labelLayer.appendChild(b); return { id, it, b };
});

/* sound */
let soundOn = true, actx = null;
document.getElementById('soundBtn').onclick = e => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? 'Sound on' : 'Sound off'; e.currentTarget.setAttribute('aria-pressed', soundOn); };
function beep(ok = true, vol = .05, freq){
  if(!soundOn) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    (ok ? [[freq || 1400,0,.09]] : [[330,0,.13],[262,.17,.2]]).forEach(([f,st,du]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + st;
      o.type = freq ? 'sine' : 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+.01); g.gain.exponentialRampToValueAtTime(.0001,t0+du);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0+du+.02);
    });
  }catch(err){}
}

/* ---------- render loop ---------- */
let W_ = 1, H_ = 1;
function resize(){
  W_ = stage.clientWidth; H_ = stage.clientHeight;
  renderer.setSize(W_, H_); cssRenderer.setSize(W_, H_);
  camera.aspect = W_/H_; camera.updateProjectionMatrix();
  if(mode === 'computer' && !fly){ const v = laptopView(); camera.position.copy(v.pos); camera.quaternion.copy(poseFrom(v.pos, v.target)); camera.fov = v.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); if(eprFlat) placeFlat(); }
}
window.addEventListener('resize', resize);
const clock = new THREE.Clock(); let tPrev = 0, lastBeat = 0;
const tmpQ = new THREE.Quaternion(), right = new THREE.Vector3(), up = new THREE.Vector3();
function frame(){
  const t = clock.getElapsedTime(), dt = Math.min(.05, t - tPrev); tPrev = t;
  if(fly){
    const k = fly.dur ? Math.min(1, (performance.now() - fly.t0)/fly.dur) : 1, e = ease(k);
    camera.position.lerpVectors(fly.p0, fly.p1, e); camera.position.y += Math.sin(Math.PI*e) * .08 * (fly.p0.distanceTo(fly.p1) > 1 ? 1 : 0);
    camera.quaternion.slerpQuaternions(fly.q0, fly.q1, e);
    camera.fov = fly.f0 + (fly.f1 - fly.f0)*e;
    if(k >= 1){ const done = fly.done; look.pos.copy(fly.p1); look.fov = fly.f1; setLookFromQuat(fly.q1); fly = null; done && done(); }
  } else if(mode !== 'computer'){
    parallax.x += (parallax.tx - parallax.x)*.06; parallax.y += (parallax.ty - parallax.y)*.06;
    camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw, 0, 'YXZ'));
    right.set(1,0,0).applyQuaternion(camera.quaternion); up.set(0,1,0).applyQuaternion(camera.quaternion);
    const amp = mode === 'explore' ? 1 : .35;
    camera.position.copy(look.pos).addScaledVector(right, parallax.x*.06*amp).addScaledVector(up, -parallax.y*.035*amp);
    camera.fov += (look.fov - camera.fov)*.15;
  }
  camera.updateProjectionMatrix();
  // living details
  drawMonitor(t, dt); if(Math.floor(t*4) !== Math.floor((t-dt)*4)) drawPump(t);
  if(Math.floor(t/20) !== Math.floor((t-dt)/20)) drawClock();
  if(t - lastBeat > beat){ lastBeat = t; if(current === 'monitor') beep(true, .025, 980); }
  blanket.scale.y = 1 + Math.sin(t*2*Math.PI*18/60)*.004; fold.scale.y = blanket.scale.y; torso.scale.y = 1 + Math.sin(t*2*Math.PI*18/60)*.03;
  const dp = (t*1.4) % 1; drop.position.y = 1.735 - dp*.05; drop.visible = dp < .9;
  train.position.x = -14 + ((t*1.6) % 34);
  const kDraw = 1 - Math.exp(-Math.min(.5, t - (frame.tLast || t))*9); frame.tLast = t;
  drawers.forEach(d => { const u = d.userData; u.open += (u.target - u.open)*kDraw; d.position.z = u.open*(d === drawers[0] ? .38 : .3); });
  const nowMs = performance.now();
  for(let k = anims.length - 1; k >= 0; k--){ const a = anims[k], u = Math.min(1, (nowMs - a.t0)/a.dur); a.fn(u); if(u >= 1){ anims.splice(k, 1); a.done && a.done(); } }
  renderer.render(scene, camera); if(!eprFlat) cssRenderer.render(scene, camera);
  // labels follow their objects
  const showLabels = mode === 'explore' && !fly;
  labelEls.forEach(({ it, b }) => {
    const p = it.anchor().project(camera);
    const vis = showLabels && !(it.hidden && it.hidden()) && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
    b.style.display = vis ? '' : 'none';
    if(vis) b.style.transform = `translate(${(p.x*.5+.5)*W_}px,${(-p.y*.5+.5)*H_}px) translate(-50%,-100%)`;
  });
  requestAnimationFrame(frame);
}
