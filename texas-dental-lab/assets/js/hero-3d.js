/* Texas Dental Lab — hero-3d.js
   Procedural premium crown + scan rings + particles.
   Lazy, mobile-aware, reduced-motion + WebGL fallbacks. No external models. */
(function(){
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const isMobile = window.matchMedia('(max-width: 860px)').matches;

  function webglOK(){
    try{
      const c=document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl')));
    }catch(e){ return false; }
  }

  // Only init when canvas visible — lazy via IntersectionObserver
  function lazyInit(selector, init){
    const el=document.querySelector(selector);
    if(!el) return;
    if(prefersReduced || saveData || !webglOK()){
      el.closest('[data-3d-wrap]')?.classList.add('no-webgl');
      const fb=el.parentElement?.querySelector('.hero-fallback'); if(fb) fb.style.display='grid';
      return;
    }
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{
        if(en.isIntersecting){ io.disconnect(); init(el); }
      });
    },{rootMargin:'200px'});
    io.observe(el);
  }

  async function loadThree(){
    // Use importmap if present, else dynamic CDN ESM
    if(!document.querySelector('script[type="importmap"]')){
      const m=document.createElement('script');
      m.type='importmap';
      m.textContent=JSON.stringify({imports:{
        'three':'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
        'three/addons/':'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/'
      }});
      document.head.appendChild(m);
    }
    const three=await import('three');
    let RoomEnvironment=null;
    try{ ({RoomEnvironment}=await import('three/addons/environments/RoomEnvironment.js')); }catch(e){}
    return {three,RoomEnvironment};
  }

  // ---- HERO CROWN ----
  lazyInit('#heroCanvas', async (canvas)=>{
    try{
      const {three:THREE, RoomEnvironment}=await loadThree();
      const wrap=canvas.parentElement;
      const renderer=new THREE.WebGLRenderer({canvas, antialias:!isMobile, alpha:true, powerPreference:'high-performance'});
      const dpr=Math.min(window.devicePixelRatio||1, isMobile?1.5:2);
      renderer.setPixelRatio(dpr);
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.05;

      const scene=new THREE.Scene();
      scene.fog=new THREE.FogExp2(0xe9eff7, 0.035);
      const camera=new THREE.PerspectiveCamera(38, 1, .1, 100);
      camera.position.set(0, .6, 7.2);

      // Environment for ceramic reflections
      if(RoomEnvironment){
        const pmrem=new THREE.PMREMGenerator(renderer);
        scene.environment=pmrem.fromScene(new RoomEnvironment(), .04).texture;
      }

      const root=new THREE.Group(); scene.add(root);
      root.position.y=-.15;

      // --- Crown body: tapered cylinder with cusp displacement ---
      function crownGeometry(){
        const geo=new THREE.CylinderGeometry(1.05, .78, 1.25, isMobile?48:96, 24, false);
        const pos=geo.attributes.position;
        const v=new THREE.Vector3();
        for(let i=0;i<pos.count;i++){
          v.fromBufferAttribute(pos,i);
          const ang=Math.atan2(v.z,v.x);
          const r=Math.hypot(v.x,v.z);
          const ny=(v.y+.625)/1.25; // 0 bottom → 1 top
          // subtle vertical flute (molar grooves)
          const flute=1 + Math.cos(ang*4)*.035*(ny);
          // occlusal cusps: lift 4 quadrants on top edge
          let y=v.y;
          if(ny>.72){
            const cusp=Math.pow(Math.abs(Math.cos(ang*2)),1.6)*.22*((ny-.72)/.28);
            y+=cusp;
            // central fossa dip
            const dip=(1-Math.min(1,r/.9))*.14*((ny-.72)/.28);
            y-=dip;
          }
          // slight bulge mid-body (anatomy)
          const bulge=1+Math.sin(ny*Math.PI)*.04;
          v.x*=flute*bulge; v.z*=flute*bulge; v.y=y;
          pos.setXYZ(i,v.x,v.y,v.z);
        }
        geo.computeVertexNormals();
        return geo;
      }
      const ceramic=new THREE.MeshPhysicalMaterial({
        color:0xe9eff8, metalness:.04, roughness:.24,
        clearcoat:1, clearcoatRoughness:.18,
        transmission:.12, thickness:1.4, ior:1.46,
        sheen:.4, sheenColor:new THREE.Color(0x9be9dd),
        envMapIntensity:1.1
      });
      const crown=new THREE.Mesh(crownGeometry(), ceramic);
      crown.position.y=.55;
      root.add(crown);

      // Margin line (copper)
      const margin=new THREE.Mesh(
        new THREE.TorusGeometry(.79, .022, 16, 128),
        new THREE.MeshStandardMaterial({color:0xe5a65b, metalness:1, roughness:.28, envMapIntensity:1.4})
      );
      margin.rotation.x=Math.PI/2; margin.position.y=-.08;
      root.add(margin);

      // Titanium abutment + threads below
      const tiMat=new THREE.MeshStandardMaterial({color:0x9fb4d0, metalness:1, roughness:.32, envMapIntensity:1.2});
      const abut=new THREE.Mesh(new THREE.CylinderGeometry(.5,.42,.7,48), tiMat);
      abut.position.y=-.6; root.add(abut);
      for(let i=0;i<4;i++){
        const t=new THREE.Mesh(new THREE.TorusGeometry(.46-i*.02,.018,12,64), tiMat);
        t.rotation.x=Math.PI/2; t.position.y=-.42-i*.16; root.add(t);
      }
      const implantTip=new THREE.Mesh(new THREE.ConeGeometry(.4,.5,48), tiMat);
      implantTip.rotation.x=Math.PI; implantTip.position.y=-1.18; root.add(implantTip);

      // Scan rings
      const ringMat1=new THREE.MeshBasicMaterial({color:0x0d9488, transparent:true, opacity:.85});
      const ringMat2=new THREE.MeshBasicMaterial({color:0x0284c7, transparent:true, opacity:.55});
      const ring1=new THREE.Mesh(new THREE.TorusGeometry(2.05,.012,8,160), ringMat1);
      const ring2=new THREE.Mesh(new THREE.TorusGeometry(2.35,.008,8,160), ringMat2);
      ring1.rotation.x=Math.PI/2.15; ring2.rotation.x=Math.PI/1.9;
      root.add(ring1,ring2);

      // Scan plane (translucent)
      const scanMat=new THREE.MeshBasicMaterial({color:0x0d9488, transparent:true, opacity:.14, side:THREE.DoubleSide, depthWrite:false});
      const scanPlane=new THREE.Mesh(new THREE.PlaneGeometry(4.6,4.6), scanMat);
      scanPlane.rotation.x=-Math.PI/2; root.add(scanPlane);

      // Orbit dots (technical callouts)
      const dotGeo=new THREE.SphereGeometry(.03,12,12);
      const dotMat=new THREE.MeshBasicMaterial({color:0xb96a1b});
      const dots=[];
      for(let i=0;i<3;i++){ const d=new THREE.Mesh(dotGeo,dotMat); root.add(d); dots.push(d); }

      // Particles
      const pCount=isMobile?130:380;
      const pGeo=new THREE.BufferGeometry();
      const pArr=new Float32Array(pCount*3);
      for(let i=0;i<pCount;i++){
        const r=2.6+Math.random()*3.2, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
        pArr[i*3]=r*Math.sin(ph)*Math.cos(th);
        pArr[i*3+1]=(Math.random()-.5)*5;
        pArr[i*3+2]=r*Math.sin(ph)*Math.sin(th);
      }
      pGeo.setAttribute('position', new THREE.BufferAttribute(pArr,3));
      const pts=new THREE.Points(pGeo, new THREE.PointsMaterial({color:0x0284c7, size:.024, transparent:true, opacity:.45, depthWrite:false}));
      scene.add(pts);

      // Grid floor
      const grid=new THREE.GridHelper(14, 28, 0x9db4d4, 0xc9d6ea);
      grid.position.y=-1.9; grid.material.transparent=true; grid.material.opacity=.85;
      scene.add(grid);

      // Lights — bright studio
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c39a, .95));
      const key=new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3,4,5); scene.add(key);
      const rim=new THREE.PointLight(0x14b8a6, 18, 20); rim.position.set(-4,1.5,-2); scene.add(rim);
      const warm=new THREE.PointLight(0xe5a65b, 14, 18); warm.position.set(3.5,-.5,2.5); scene.add(warm);

      // Interaction
      let mx=0,my=0,tx=0,ty=0;
      const fine=window.matchMedia('(pointer:fine)').matches;
      if(fine && !prefersReduced){
        window.addEventListener('pointermove',e=>{
          tx=(e.clientX/window.innerWidth-.5)*2;
          ty=(e.clientY/window.innerHeight-.5)*2;
        },{passive:true});
      }

      function resize(){
        const w=wrap.clientWidth||600, h=wrap.clientHeight||520;
        renderer.setSize(w,h,false);
        camera.aspect=w/h; camera.updateProjectionMatrix();
      }
      resize(); window.addEventListener('resize',resize);

      let running=true;
      const visIO=new IntersectionObserver(en=>{running=en[0].isIntersecting;},{threshold:.02});
      visIO.observe(canvas);
      document.addEventListener('visibilitychange',()=>{running=!document.hidden;});

      const clock=new THREE.Clock();
      function frame(){
        requestAnimationFrame(frame);
        if(!running) return;
        const t=clock.getElapsedTime();
        mx+=(tx-mx)*.04; my+=(ty-my)*.04;

        root.rotation.y=t*.32+mx*.55;
        root.rotation.x=Math.sin(t*.4)*.06+my*.22;
        root.position.y=-.15+Math.sin(t*.9)*.09;
        ring1.rotation.z=t*.5; ring2.rotation.z=-t*.35;
        scanPlane.position.y=Math.sin(t*1.1)*1.1+.3;
        scanMat.opacity=.07+Math.abs(Math.sin(t*1.1))*.07;
        pts.rotation.y=t*.03;
        grid.position.y=-1.9+Math.sin(t*.7)*.03;

        // callout dots orbit crown shoulder
        dots.forEach((d,i)=>{
          const a=t*.6+i*(Math.PI*2/3);
          d.position.set(Math.cos(a)*1.02,.62+Math.sin(t*.8+i)*.05,Math.sin(a)*1.02);
        });

        // scroll parallax: lift camera slightly
        const sc=Math.min(1,window.scrollY/(window.innerHeight||800));
        camera.position.y=.6+sc*1.1;
        camera.position.x=mx*.5;
        camera.lookAt(0,.1,0);
        renderer.render(scene,camera);
      }
      if(prefersReduced){
        renderer.render(scene,camera);
      } else frame();
    }catch(err){
      console.warn('Hero 3D fallback:',err);
      const fb=canvas.parentElement?.querySelector('.hero-fallback'); if(fb) fb.style.display='grid';
    }
  });

  // ---- PRECISION MINI SCENE ----
  lazyInit('#precisionCanvas', async (canvas)=>{
    try{
      const {three:THREE, RoomEnvironment}=await loadThree();
      const wrap=canvas.parentElement;
      const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isMobile?1.25:1.75));
      const scene=new THREE.Scene();
      const camera=new THREE.PerspectiveCamera(40,1,.1,50);
      camera.position.set(0,.4,6.4);
      if(RoomEnvironment){
        const pm=new THREE.PMREMGenerator(renderer);
        scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;
      }
      const g=new THREE.Group(); scene.add(g);
      const solid=new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.35, 24),
        new THREE.MeshPhysicalMaterial({color:0xdfe8f5, roughness:.28, metalness:.05, clearcoat:1, clearcoatRoughness:.2, transparent:true, opacity:.92, envMapIntensity:1})
      );
      // deform to tooth-ish: scale + pinch bottom
      const p=solid.geometry.attributes.position; const vv=new THREE.Vector3();
      for(let i=0;i<p.count;i++){ vv.fromBufferAttribute(p,i); vv.y*=1.25; if(vv.y<0){vv.x*=.72; vv.z*=.72;} p.setXYZ(i,vv.x,vv.y,vv.z); }
      solid.geometry.computeVertexNormals();
      g.add(solid);
      const wire=new THREE.Mesh(
        solid.geometry.clone(),
        new THREE.MeshBasicMaterial({color:0x0d9488, wireframe:true, transparent:true, opacity:.28})
      );
      wire.scale.setScalar(1.002); g.add(wire);
      const ringM=new THREE.MeshBasicMaterial({color:0xb96a1b, transparent:true, opacity:.9});
      const r1=new THREE.Mesh(new THREE.TorusGeometry(1.9,.01,8,140), ringM); r1.rotation.x=Math.PI/2; g.add(r1);
      const r2=new THREE.Mesh(new THREE.TorusGeometry(1.9,.01,8,140), new THREE.MeshBasicMaterial({color:0x0284c7, transparent:true, opacity:.6})); r2.rotation.x=Math.PI/2; r2.position.y=.7; r2.scale.setScalar(.82); g.add(r2);
      scene.add(new THREE.HemisphereLight(0xffffff,0xd8c39a,1.0));
      const d=new THREE.DirectionalLight(0xffffff,2.0); d.position.set(3,4,5); scene.add(d);
      const pt=new THREE.PointLight(0x14b8a6,12,20); pt.position.set(-3,2,-2); scene.add(pt);

      function resize(){ const w=wrap.clientWidth||500,h=wrap.clientHeight||420; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
      resize(); window.addEventListener('resize',resize);
      let run=true;
      new IntersectionObserver(en=>{run=en[0].isIntersecting;},{threshold:.05}).observe(canvas);
      const clock=new THREE.Clock();
      (function loop(){
        requestAnimationFrame(loop);
        if(!run||prefersReduced){ if(prefersReduced){renderer.render(scene,camera);} return; }
        const t=clock.getElapsedTime();
        g.rotation.y=t*.4; g.rotation.z=Math.sin(t*.3)*.08;
        r1.rotation.z=t*.4; r2.rotation.z=-t*.5;
        renderer.render(scene,camera);
      })();
      if(prefersReduced) renderer.render(scene,camera);
    }catch(e){ console.warn('Precision 3D fallback',e); }
  });
})();
