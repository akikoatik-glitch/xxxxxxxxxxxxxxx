/* ============================================================
   XWhiz 3D layer  (add-on, visual-only)
   Uses Three.js (loaded via CDN <script>). Never blocks scroll
   or touch. Fully disabled under prefers-reduced-motion, small
   viewports, absence of WebGL, or when THREE is unavailable.
   ============================================================ */
(function () {
  "use strict";

  var PREFER_REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SMALL_VIEW = window.innerWidth < 768;
  var hasWebGL = (function () {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  })();

  document.documentElement.classList.add('xw-js');

  /* ---------- Scroll-reveal (works with or without WebGL/3D) ---------- */
  function initReveal() {
    var items = document.querySelectorAll('main .grid > *, main section, main article, h1');
    if (!items.length) return;
    items.forEach(function (el) {
      if (el.closest('nav')) return;
      el.classList.add('xw-reveal');
    });
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('xw-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('xw-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }
  initReveal();

  /* ---------- Pointer 3D tilt on [data-tilt] cards ---------- */
  function initTilt() {
    if (PREFER_REDUCED || SMALL_VIEW || !window.matchMedia('(pointer: fine)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.transform =
          'perspective(900px) rotateX(' + ((0.5 - py) * 9).toFixed(2) + 'deg) ' +
          'rotateY(' + ((px - 0.5) * 11).toFixed(2) + 'deg) translateY(-3px) scale3d(1.015,1.015,1)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transform = '';
      });
    });
  }
  initTilt();

  /* ---------- Three.js background ---------- */
  if (PREFER_REDUCED || SMALL_VIEW || !hasWebGL || typeof THREE === 'undefined') return;

  var canvas = document.createElement('canvas');
  canvas.id = 'xw-bg-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  var renderer, scene, camera, ball, particles, field, mouseX = 0, mouseY = 0, w, h;
  var clock = new THREE.Clock();

  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) { canvas.remove(); return; }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* Build the 3D scene */
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  camera.position.set(0, 0.6, 10);
  camera.lookAt(0, 0, 0);

  var group = new THREE.Group();
  scene.add(group);

  /* Seashell-white soccer ball built from a sphere + 3D seams */
  var ballGeo = new THREE.SphereGeometry(1.15, 48, 48);
  var mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25
  });
  ball = new THREE.Mesh(ballGeo, mat);
  group.add(ball);

  /* Black pentagon-ish seam rings (simplified classic ball look) */
  var seamMat = new THREE.MeshStandardMaterial({ color: 0x052018, roughness: 0.55 });
  var ringGeo = new THREE.TorusGeometry(0.72, 0.045, 12, 64);
  [-1, 0, 1].forEach(function (i) {
    var r = new THREE.Mesh(ringGeo, seamMat);
    r.rotation.z = Math.PI / 2;
    r.position.set(i * 0.85, 0, 0);
    group.add(r);
  });
  var ring2 = new THREE.Mesh(ringGeo, seamMat);
  ring2.rotation.y = Math.PI / 2;
  group.add(ring2);

  /* Floating green particle field */
  var PCOUNT = SMALL_VIEW ? 0 : 220;
  var pPos = new Float32Array(PCOUNT * 3);
  var pGeo = new THREE.BufferGeometry();
  var pSeed = [];
  for (var i = 0; i < PCOUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 26;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 2;
    pSeed.push({ dx: Math.random() * 0.4 - 0.2, dy: (Math.random() - 0.5) * 0.014, s: 0.6 + Math.random() * 1.2 });
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var pMat = new THREE.PointsMaterial({
    color: 0x00d46a,
    size: 0.10,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* Perspective grass-field horizon line (subtle green glow) */
  var fieldGeo = new THREE.PlaneGeometry(40, 40);
  var fieldMat = new THREE.MeshBasicMaterial({
    color: 0x00a651,
    transparent: true,
    opacity: 0.18,
    fog: false
  });
  field = new THREE.Mesh(fieldGeo, fieldMat);
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -4.6, -6);
  scene.add(field);

  /* Ambient + green lighting */
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  var key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 6, 6);
  scene.add(key);
  var rim = new THREE.PointLight(0x00ff9a, 1.4, 30);
  rim.position.set(-5, 2, -4);
  scene.add(rim);
  var rim2 = new THREE.PointLight(0xffb020, 0.8, 24);
  rim2.position.set(6, -2, 3);
  scene.add(rim2);

  resize();
  window.addEventListener('resize', function () { resize(); }, { passive: true });

  /* subtle mouse parallax (fine pointers only) */
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      mouseX = (e.clientX / w - 0.5) * 1.6;
      mouseY = (e.clientY / h - 0.5) * 1.0;
    }, { passive: true });
  }
  document.addEventListener('scroll', function () {
    var sy = (window.scrollY || 0) / (document.body.scrollHeight || window.innerHeight || 1);
    if (ball) ball.position.y = 0.4 + sy * 1.2;
  }, { passive: true });

  /* slow spin: the ball rotates on its own axis */
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    ball.rotation.y += 0.008;
    ball.rotation.z = Math.sin(t * 0.4) * 0.15;
    group.position.x = mouseX;
    group.position.y = 0.6 + mouseY * 0.4 + Math.sin(t * 0.6) * 0.15;
    group.rotation.y += 0.0025;
    group.rotation.x = mouseY * 0.06;

    var pos = particles.geometry.attributes.position.array;
    for (var i = 0; i < PCOUNT; i++) {
      var o = pSeed[i];
      pos[i * 3] += o.dx * 0.01;
      pos[i * 3 + 1] += o.dy;
      if (pos[i * 3] > 14) pos[i * 3] = -14;
      if (pos[i * 3] < -14) pos[i * 3] = 14;
      if (pos[i * 3 + 1] > 9) pos[i * 3 + 1] = -9;
      if (pos[i * 3 + 1] < -9) pos[i * 3 + 1] = 9;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    if (field) { field.position.z = -6 + (mouseX * 0.4); }
    renderer.render(scene, camera);
  }
  animate();
})();
