// Origami crane that glides around an ID card and perches on its corner now and then.
// Model: "3D Origami crane" by JuanG3D (CC BY 4.0) — https://sketchfab.com/3d-models/3d-origami-crane-38fe6bfec0664af3b7660b2d18cfaf94
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let modelP = null;
const loadCrane = () => modelP || (modelP = new GLTFLoader().loadAsync("assets/crane.glb"));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };

async function attach(wrap) {
  if (!wrap || wrap._crane) return;
  const card = wrap.querySelector(".idc-scene"); if (!card) return;
  wrap._crane = true;
  const cv = document.createElement("canvas"); cv.className = "crane-cv"; cv.setAttribute("aria-hidden", "true"); wrap.appendChild(cv);
  try {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcdb8a0, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-200, 300, 400); scene.add(key);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000); cam.position.z = 500;

    const g = (await loadCrane()).scene.clone(true);
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.name === "Sombra") { o.visible = false; return; }               // baked shadow plane: we use our own
      o.material = new THREE.MeshStandardMaterial({ map: o.material.map, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide });
    });
    const bb = new THREE.Box3().setFromObject(g), ctr = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    g.position.sub(ctr); const body = new THREE.Group(); body.add(g);
    const base = new THREE.Group(); base.add(body); base.rotation.x = Math.PI / 2 - 0.4;   // lay it down, tilted a little toward the viewer
    const bank = new THREE.Group(); bank.add(base);
    const yaw = new THREE.Group(); yaw.add(bank); scene.add(yaw);
    const unit = 1 / Math.max(sz.x, sz.z);

    let W = 1, H = 1, cw = 1, ch = 1, cx = 0, cy = 0, S = 60;
    const layout = () => {
      W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(W, H, false);
      cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2; cam.updateProjectionMatrix();
      const k = cv.getBoundingClientRect(), r = card.getBoundingClientRect();
      cw = card.offsetWidth; ch = card.offsetHeight;
      cx = r.left + r.width / 2 - (k.left + W / 2); cy = -(r.top + r.height / 2 - (k.top + H / 2));
      S = clamp(cw * 0.27, 54, 118); yaw.scale.setScalar(S * unit);
    };
    layout(); new ResizeObserver(layout).observe(wrap); addEventListener("resize", layout);

    let visible = true; new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(wrap);
    const T = 30, t0 = performance.now() + Math.random() * 6000;
    let px = 0, py = 0, head = 0, bnk = 0, first = true, last = performance.now();
    const orbit = (t) => {
      const th = t * 0.3, a = cw * 0.5 + S * 0.5, b = ch * 0.5 + S * 0.5;
      return [cx + a * Math.cos(th), cy + b * Math.sin(th) + Math.sin(t * 1.6) * 3];
    };
    const frame = (now) => {
      if (!wrap.isConnected) { renderer.dispose(); cv.remove(); wrap._crane = false; return; }   // card was re-rendered / page closed
      requestAnimationFrame(frame);
      if (!visible || document.hidden || !W) return;
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      const c = reduced ? 22 : ((t % T) + T) % T;
      // 0-19 orbit · 19-22 land · 22-27 perched · 27-30 take off
      const w = sm(19, 22, c) * (1 - sm(27, 30, c));
      const [ox, oy] = orbit(reduced ? 0 : t);
      const P = [cx + cw / 2 - S * 0.5, cy + ch / 2 + S * 0.02];
      const x = ox + (P[0] - ox) * w, y = oy + (P[1] - oy) * w;
      if (first) { px = x; py = y; first = false; }
      const vx = x - px, vy = y - py; px = x; py = y;
      const sp = Math.hypot(vx, vy);
      let target = sp > 0.05 ? Math.atan2(vx, -vy) : head;
      target = angLerp(target, -Math.PI / 2, sm(0.6, 1, w));                          // perched: look left, over the card
      const prev = head; head = angLerp(head, target, 1 - Math.pow(0.001, dt));
      const turn = angLerp(0, head - prev, 1) / Math.max(dt, 0.001);
      bnk += (clamp(turn * 0.35, -0.6, 0.6) * (1 - w) - bnk) * 0.08;
      yaw.position.set(x, y, 0); yaw.rotation.z = head; bank.rotation.y = bnk + Math.sin(t * 0.9) * 0.05 * w;
      const flap = reduced ? 0 : (1 - w) * 0.14 + w * 0.015;
      body.scale.set(1 + flap * Math.sin(t * 9.5), 1, 1);                              // wings fold in/out
      body.position.y = Math.sin(t * 2.1) * 0.02 * (1 - w);
      renderer.render(scene, cam);
    };
    requestAnimationFrame(frame);
  } catch (err) { console.warn("crane unavailable", err); cv.remove(); }
}
window.Crane = { attach };
document.dispatchEvent(new Event("crane-ready"));
