// 3D katana for the landing hero (your model: assets/katana.glb). Falls back to the drawn SVG sword if WebGL or the file fails.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("katana3d");
const hero = document.getElementById("ld-hero");
if (canvas && hero) {
  (async () => {
    try {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.7;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xfff0e0, 3.4); key.position.set(-3, 4, 5); scene.add(key);
      const fill = new THREE.DirectionalLight(0xcfe0ff, 1.6); fill.position.set(4, -2, 3); scene.add(fill);
      const rim = new THREE.PointLight(0xd9362b, 900, 0, 2); rim.position.set(4, -1.5, -3); scene.add(rim);
      const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

      const gltf = await new GLTFLoader().loadAsync("assets/katana.glb");
      const model = gltf.scene, pivot = new THREE.Group();
      const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      model.position.sub(c); model.rotation.y = Math.PI / 2;           // length axis (z) -> screen x, handle on the right
      pivot.add(model); scene.add(pivot);
      const k = 10 / Math.max(sz.x, sz.z); pivot.scale.setScalar(k);     // model is in cm — normalise so the sword is 10 units long
      const len = 10; sz.multiplyScalar(k);

      const fit = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight || 1; renderer.setSize(w, h, false);
        cam.aspect = w / h; const halfV = THREE.MathUtils.degToRad(cam.fov / 2);
        const needW = (len * 0.56) / Math.tan(halfV) / cam.aspect, needH = (sz.y * 1.7) / Math.tan(halfV);
        cam.position.set(0, 0, Math.max(needW, needH) * 1.0); cam.updateProjectionMatrix();
      };
      hero.classList.add("has3d");                 // show the canvas first so it has a real size
      fit(); new ResizeObserver(fit).observe(canvas);

      const mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
      addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
      let visible = true;
      new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);
      const t0 = performance.now();
      const frame = () => {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        const p = parseFloat(hero.style.getPropertyValue("--p")) || 0;
        cur.x += (mouse.x - cur.x) * 0.06; cur.y += (mouse.y - cur.y) * 0.06;
        const t = reduced ? 0 : (performance.now() - t0) / 1000;
        pivot.rotation.x = 0.2 + p * 6.2 + Math.sin(t * 0.6) * 0.04;   // roll along its length as you scroll
        pivot.rotation.y = -0.18 + cur.x * 0.35;
        pivot.rotation.z = -0.06 + cur.y * 0.12;
        pivot.position.x = -p * len * 0.55;                            // slides away like the video
        rim.position.x = 4 + Math.sin(t * 0.5) * 2;
        renderer.render(scene, cam);
      };
      frame();
    } catch (err) { hero.classList.remove("has3d"); console.warn("3D katana unavailable, using drawn sword", err); }
  })();
}
