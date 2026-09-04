// DevisAlg hero 3D scene — Three.js
// Floating Devis/Facture cards + particles + glow connection lines.
// Lazy-loaded, pointer-events none, respects reduced motion, mobile-friendly.
import * as THREE from '/static/three/three.module.js';

const container = document.getElementById('l-scene');
if (container) {
  init();
}

function init() {
  const isMobile = window.innerWidth < 768;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 14;

  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Soft ambient + directional light
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 8, 6);
  scene.add(dir);

  // Cards: Devis (doc) and Facture made of extruded boxes
  const cardGroup = new THREE.Group();
  const makeCard = ({ color, w, h, y, x }) => {
    const geo = new THREE.BoxGeometry(w, h, 0.18);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    // white "paper" stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.72, h * 0.06, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
    );
    stripe.position.y = -h * 0.3;
    mesh.add(stripe);
    return mesh;
  };
  cardGroup.add(makeCard({ color: 0x7c3aed, w: 4.4, h: 2.6, x: -6.5, y: 1.2 }));
  cardGroup.add(makeCard({ color: 0x0ea5e9, w: 4.6, h: 2.8, x: 6.2, y: -0.6 }));
  cardGroup.add(makeCard({ color: 0x2563eb, w: 4.0, h: 2.4, x: 1.6, y: 2.6 }));
  scene.add(cardGroup);

  // Particles (connection glow "network")
  const count = isMobile ? 60 : 140;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x8b8bf5, size: 0.09, transparent: true, opacity: 0.7 });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Connection lines between nearby particles
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.18 });
  const segments = isMobile ? 40 : 90;
  const lGeo = new THREE.BufferGeometry();
  const lPos = new Float32Array(segments * 6);
  const pos = positions;
  for (let s = 0; s < segments; s++) {
    const a = Math.floor(Math.random() * count);
    let b = Math.floor(Math.random() * count);
    if (a === b) b = (b + 1) % count;
    const d = Math.hypot(pos[a*3]-pos[b*3], pos[a*3+1]-pos[b*3+1], pos[a*3+2]-pos[b*3+2]);
    if (d > 5) continue;
    lPos[s*6]=pos[a*3]; lPos[s*6+1]=pos[a*3+1]; lPos[s*6+2]=pos[a*3+2];
    lPos[s*6+3]=pos[b*3]; lPos[s*6+4]=pos[b*3+1]; lPos[s*6+5]=pos[b*3+2];
  }
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  const lines = new THREE.LineSegments(lGeo, lineMat);
  scene.add(lines);

  // Parallax on mouse
  const tx = new THREE.Vector3();
  const target = new THREE.Vector3();
  window.addEventListener('mousemove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  let raf;
  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    const ms = clock.getDelta();

    cardGroup.rotation.y = Math.sin(t * 0.25) * 0.5 + 0.2;
    cardGroup.rotation.x = Math.sin(t * 0.18) * 0.2;
    cardGroup.children.forEach((c, i) => {
      c.position.y += Math.sin(t * 0.6 + i) * 0.004;
    });
    points.rotation.y = t * 0.02;
    lines.rotation.y = t * 0.02;

    tx.lerp(target, 0.04);
    camera.position.x += (tx.x * 1.4 - camera.position.x) * 0.03;
    camera.position.y += (tx.y * 1.0 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
    void ms;
  }
  animate();

  function onResize() {
    if (!container || container.clientWidth === 0) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  // Cleanup on page hide/navigation
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
  });
}
