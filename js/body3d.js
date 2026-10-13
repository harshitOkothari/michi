// 3D body viewer for Measurements (and the admin view). Meshes: assets/body-female.glb / assets/body-male.glb
// Female: "Female body base mesh" by gus_thewise (CC BY 4.0) · Male: "Male body base mesh (highpoly)" by Mandrake (CC BY 4.0)
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const cache = {};
const loadBody = (g) => cache[g] || (cache[g] = new GLTFLoader().loadAsync(`assets/body-${g}.glb`));
// where each measurement ring sits (metres on a 1.8 m tall mesh) — tuned per body
const SPOTS = {
  female: { shoulders: { y: 1.56, rx: 0.2, rz: 0.1 }, chest: { y: 1.43, rx: 0.15, rz: 0.12 }, waist: { y: 1.2, rx: 0.115, rz: 0.085 }, thighs: { y: 0.8, rx: 0.075, rz: 0.075, x: 0.085 }, arms: { y: 1.4, rx: 0.045, rz: 0.045, x: 0.215 } },
  male:   { shoulders: { y: 1.5, rx: 0.27, rz: 0.11 },  chest: { y: 1.38, rx: 0.2, rz: 0.12 },   waist: { y: 1.12, rx: 0.17, rz: 0.1 },   thighs: { y: 0.84, rx: 0.095, rz: 0.095, x: 0.11 }, arms: { y: 1.36, rx: 0.06, rz: 0.06, x: 0.345 } },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function holoMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGold: { value: new THREE.Color(0xd6b26e) }, uBase: { value: new THREE.Color(0x3a2c30) } },
    transparent: true, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uGold; uniform vec3 uBase; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float lam = 0.55 + 0.75 * max(dot(normalize(vN), normalize(vec3(-0.4,0.7,0.6))), 0.0);
        float scan = 0.5 + 0.5 * sin(vY * 140.0 - uTime * 2.0); float sweep = smoothstep(0.02, 0.0, abs(fract(uTime * 0.18) * 1.9 - vY));
        vec3 c = uBase * lam + uGold * (f * 1.1 + scan * 0.06 + sweep * 0.8);
        gl_FragColor = vec4(c, 0.93); }`,
  });
}

function mount(el, opts = {}) {
  if (!el) return null;
  let gender = opts.gender === "female" ? "female" : "male", values = opts.values || {}, ask = opts.ask || null, alive = true, hover = null;
  el.innerHTML = ""; el.classList.add("body3d-host");
  const cv = document.createElement("canvas"); cv.className = "body3d-cv"; el.appendChild(cv);
  const tag = document.createElement("div"); tag.className = "body3d-tag"; el.appendChild(tag);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const pivot = new THREE.Group(); scene.add(pivot);
  const rings = {}, mat = holoMaterial();
  let bodyMesh = null, yaw = 0.4, vel = 0, dragging = false, lastX = 0, moved = 0, idle = 0;

  const fit = () => {
    const w = el.clientWidth || 300, h = Math.max(260, Math.min(520, Math.round(w * 1.15)));
    cv.style.height = h + "px"; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.position.set(0, 1.75, 4.6); cam.lookAt(0, 0.88, 0); cam.updateProjectionMatrix();
  };
  fit(); const ro = new ResizeObserver(fit); ro.observe(el);

  const buildRings = () => {
    Object.values(rings).forEach((r) => { pivot.remove(r.line); r.line.geometry.dispose(); });
    for (const k of Object.keys(rings)) delete rings[k];
    const S = SPOTS[gender];
    Object.entries(S).forEach(([key, s]) => {
      const sides = key === "thighs" || key === "arms" ? [-1, 1] : [0];
      sides.forEach((sd, i) => {
        const pts = []; for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2; pts.push(new THREE.Vector3((s.x || 0) * sd + Math.cos(t) * s.rx, s.y, Math.sin(t) * s.rz)); }
        const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false }));
        line.renderOrder = 5; pivot.add(line); rings[key + i] = { key, line };
      });
    });
    colorRings();
  };
  const colorRings = () => Object.values(rings).forEach(({ key, line }) => {
    const m = line.material, has = values[key] != null, isAsk = ask === key, isHover = hover === key;
    m.color.set(isAsk ? 0xff4a3d : has ? 0xd6b26e : 0xffffff); m.opacity = isAsk || isHover ? 1 : has ? 0.95 : 0.35;
  });

  const setBody = async (g) => {
    gender = g; if (bodyMesh) { pivot.remove(bodyMesh); bodyMesh = null; }
    const gltf = await loadBody(g); if (!alive) return;
    const m = gltf.scene.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.computeVertexNormals(); o.material = mat; } });
    bodyMesh = m; pivot.add(m); buildRings();
  };
  setBody(gender);

  // drag to spin · tap a body part to measure it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const partAt = (e) => {
    const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = bodyMesh && ray.intersectObject(bodyMesh, true)[0]; if (!hit) return null;
    const p = pivot.worldToLocal(hit.point.clone()), S = SPOTS[gender], h = p.y;
    if (h > S.shoulders.y + 0.08 || h < S.thighs.y - 0.25) return null;
    if (Math.abs(p.x) > S.arms.x - 0.06 && h > S.waist.y && h < S.shoulders.y + 0.02) return "arms";
    if (h < S.waist.y - 0.1) return "thighs";
    if (h < (S.waist.y + S.chest.y) / 2) return "waist";
    if (h < (S.chest.y + S.shoulders.y) / 2 + 0.02) return "chest";
    return "shoulders";
  };
  cv.style.touchAction = "pan-y";
  cv.addEventListener("pointerdown", (e) => { dragging = true; moved = 0; lastX = e.clientX; idle = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); yaw += dx * 0.012; vel = dx * 0.012; }
    else { const k = partAt(e); if (k !== hover) { hover = k; colorRings(); tag.textContent = k ? `Tap to measure · ${k}` : ""; cv.style.cursor = k ? "pointer" : "grab"; } }
  });
  cv.addEventListener("pointerup", (e) => { dragging = false; if (moved < 6) { const k = partAt(e); if (k && opts.onPick) opts.onPick(k); } });
  cv.addEventListener("pointerleave", () => { hover = null; colorRings(); tag.textContent = ""; });

  let t0 = performance.now(), visible = true; new IntersectionObserver(([x]) => (visible = x.isIntersecting)).observe(el);
  const frame = (now) => {
    if (!alive || !el.isConnected) { alive = false; renderer.dispose(); ro.disconnect(); return; }
    requestAnimationFrame(frame); if (!visible || document.hidden) return;
    const t = (now - t0) / 1000; mat.uniforms.uTime.value = t;
    if (!dragging) { idle += 1; yaw += vel; vel *= 0.94; if (idle > 120) yaw += 0.004; }
    pivot.rotation.y = yaw;
    Object.values(rings).forEach(({ key, line }) => { if (ask === key) line.material.opacity = 0.55 + 0.45 * Math.sin(t * 6); });
    renderer.render(scene, cam);
  };
  requestAnimationFrame(frame);
  return {
    update(v, a) { values = v || {}; ask = a || null; colorRings(); },
    setGender(g) { if (g !== gender) setBody(g); },
    dispose() { alive = false; },
  };
}
window.Body3D = { mount };
document.dispatchEvent(new Event("body3d-ready"));
