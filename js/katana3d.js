// Landing katana: ONE fixed 3D layer. It starts big and level in the dark hero, then turns blade-down and follows you
// down the page along the right edge of the white section, and fades out before the login area.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("katana3d");
const hero = document.getElementById("ld-hero");
const begin = document.getElementById("begin");
if (canvas && hero) {
  (async () => {
    try {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.7;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xfff0e0, 3.4); key.position.set(-3, 4, 5); scene.add(key);
      const fill = new THREE.DirectionalLight(0xcfe0ff, 1.6); fill.position.set(4, -2, 3); scene.add(fill);
      const rim = new THREE.PointLight(0xd9362b, 500, 0, 2); rim.position.set(4, -1.5, -3); scene.add(rim);
      const D = 40, FOV = 24, cam = new THREE.PerspectiveCamera(FOV, 1, 1, 200); cam.position.set(0, 0, D);

      const gltf = await new GLTFLoader().loadAsync("assets/katana.glb");
      const model = gltf.scene, hold = new THREE.Group(), pivot = new THREE.Group();
      const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      model.position.sub(c); model.rotation.y = Math.PI / 2;               // length axis -> x, handle on the right
      hold.add(model); hold.scale.setScalar(10 / Math.max(sz.x, sz.z));     // model is in cm: normalise to 10 units long
      pivot.add(hold); scene.add(pivot);

      pivot.rotation.order = "ZYX";                                          // roll about the sword's own axis, then stand it up
      let vw = 1, vh = 1, mobile = false;
      const fit = () => {
        const w = innerWidth, h = innerHeight; mobile = w < 700;
        renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2)); renderer.setSize(w, h, false);
        cam.aspect = w / h; cam.updateProjectionMatrix();
        vh = 2 * D * Math.tan(THREE.MathUtils.degToRad(FOV / 2)); vw = vh * cam.aspect;   // world size visible at z = 0
      };
      fit(); addEventListener("resize", fit);

      const mouse = { x: 0 }, cur = { x: 0 };
      addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; }, { passive: true });
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
      const ease = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
      const t0 = performance.now(); let shown = 0;
      hero.classList.add("has3d");

      const frame = () => {
        requestAnimationFrame(frame);
        if (!canvas.getClientRects().length || document.hidden) return;        // landing hidden (logged in) -> idle
        const t = reduced ? 0 : (performance.now() - t0) / 1000;
        const heroRange = Math.max(1, hero.offsetHeight - innerHeight), sy = scrollY;
        const p = clamp(sy / heroRange, 0, 1);                                  // scroll-driven, no lag
        const after = Math.max(0, sy - heroRange) / innerHeight;                // screens scrolled past the hero
        const e = ease(0.2, 0.85, p);                                           // 0 = level in hero, 1 = blade-down on the right
        cur.x += (mouse.x - cur.x) * 0.06;

        const lenH = vw * (mobile ? 0.9 : 0.58), lenV = vh * (mobile ? 0.5 : 0.8);
        pivot.scale.setScalar(lerp(lenH, lenV, e) / 10);
        const lane = mobile ? 0.85 : 0.9;
        pivot.position.x = lerp(0, (lane - 0.5) * vw, e);
        pivot.position.y = lerp((mobile ? -0.17 : -0.15) * vh, 0, e) + Math.sin(t * 0.8) * 0.12;
        pivot.rotation.z = e * Math.PI / 2;                                      // handle up, tip points down the page
        pivot.rotation.x = 0.2 + p * 5 + after * 1.4 + Math.sin(t * 0.6) * 0.04; // roll along its length as you scroll
        pivot.rotation.y = -0.04 + cur.x * 0.3 * (1 - e);
        rim.position.x = 4 + Math.sin(t * 0.5) * 2;

        let fade = 1;                                                            // fade out before the login area
        if (begin) fade = clamp((begin.getBoundingClientRect().top - innerHeight * 0.5) / (innerHeight * 0.45), 0, 1);
        shown = Math.min(1, (performance.now() - t0) / 900);
        canvas.style.opacity = (fade * shown).toFixed(3);
        if (fade > 0.01) renderer.render(scene, cam);
      };
      frame();
    } catch (err) { hero.classList.remove("has3d"); hero.classList.add("no3d"); console.warn("3D katana unavailable, using drawn sword", err); }
  })();
}
