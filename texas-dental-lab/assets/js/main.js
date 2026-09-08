/* Texas Dental Lab — main.js : nav, loader, reveals, counters, forms, analytics stub */
(function(){
  'use strict';
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>Array.from(c.querySelectorAll(s));

  // Year
  $$('[data-year]').forEach(el=>{el.textContent=new Date().getFullYear()});

  // Loader
  const loader=$('#loader');
  function hideLoader(){ if(!loader) return; loader.classList.add('done'); setTimeout(()=>loader.remove(),700); }
  if(document.readyState==='complete') setTimeout(hideLoader,400);
  else window.addEventListener('load',()=>setTimeout(hideLoader,400));
  // Safety: never trap user
  setTimeout(hideLoader,3500);

  // Progress + header
  const header=$('.site-header'), prog=$('#progress');
  function onScroll(){
    const y=window.scrollY;
    if(header) header.classList.toggle('scrolled',y>10);
    if(prog){
      const h=document.documentElement.scrollHeight-window.innerHeight;
      prog.style.width=(h>0?(y/h*100):0)+'%';
    }
  }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  // Mobile menu
  const btn=$('#menuBtn'), menu=$('#mobileMenu');
  if(btn&&menu){
    btn.addEventListener('click',()=>{
      const open=menu.classList.toggle('open');
      btn.setAttribute('aria-expanded',open?'true':'false');
    });
    menu.addEventListener('click',e=>{ if(e.target.closest('a')) menu.classList.remove('open'); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') menu.classList.remove('open'); });
  }

  // Reveal on scroll
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('visible'); io.unobserve(en.target);} });
  },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  $$('.reveal').forEach(el=>io.observe(el));

  // Counters
  const cio=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(!en.isIntersecting) return;
      const el=en.target; cio.unobserve(el);
      const target=parseFloat(el.dataset.count||'0');
      const suffix=el.dataset.suffix||'';
      if(prefersReduced){ el.textContent=target+suffix; return; }
      const dur=1400, t0=performance.now();
      function tick(t){
        const p=Math.min(1,(t-t0)/dur);
        const e=1-Math.pow(1-p,3);
        const val=target%1!==0?(target*e).toFixed(1):Math.round(target*e).toString();
        el.textContent=val+suffix;
        if(p<1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  },{threshold:.4});
  $$('[data-count]').forEach(el=>cio.observe(el));

  // Workflow interactive steps
  const steps=$$('.step[data-step]');
  const vizTitle=$('#vizTitle'), vizDesc=$('#vizDesc'), vizCode=$('#vizCode');
  const copy={
    scan:{t:'01 — Intraoral Scan',d:'A digital impression captures the arch in minutes. No trays, no distortion — just a clean digital file ready for design.',c:['Upper and lower arch captured digitally','Bite alignment and occlusion check','Shade photos linked to the case']},
    design:{t:'02 — CAD Design',d:'Technicians design anatomy, contacts and occlusion in 3D — cusp by cusp, micron by micron.',c:['Anatomy designed for the exact tooth','Contacts and bite shaped virtually','Shade A2 mapped tooth by tooth']},
    make:{t:'03 — Mill / Print',d:'The design is nested and milled from a zirconia puck or printed in biocompatible resin — lights-out precision.',c:['Nested for strength and shade blend','Milled on 5 axes for fine detail','Sintered on a controlled furnace cycle']},
    finish:{t:'04 — Finish & Characterize',d:'Stain, glaze and polish bring translucency and texture to life — matched to the neighbouring teeth.',c:['Warm cervical blend to bright incisal','Hand glaze for natural light play','Polished to a lifelike luster']},
    qc:{t:'05 — Quality Control',d:'Every unit is checked on the model and under magnification: margins, contacts, occlusion, shade.',c:['Margins verified under magnification','Contacts and bite confirmed on model','Shade approved before packing']},
    deliver:{t:'06 — Delivery',d:'Case is disinfected, packed and shipped with a clear lab slip — ready for confident seating.',c:['Disinfected and sealed for transit','Clear lab slip in every box','Tracked shipping across Texas']}
  };
  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function setStep(key){
    steps.forEach(s=>{
      const on=s.dataset.step===key;
      s.classList.toggle('active',on);
      s.setAttribute('aria-selected',on?'true':'false');
      const bar=s.querySelector('.step-bar i');
      if(bar) bar.style.width=on?'100%':'0';
    });
    if(vizTitle&&copy[key]){ vizTitle.textContent=copy[key].t; vizDesc.textContent=copy[key].d; vizCode.innerHTML=copy[key].c.map(item=>'<li><span class="tick" aria-hidden="true">✓</span><span>'+esc(item)+'</span></li>').join(''); }
    track('workflow_step',{step:key});
  }
  steps.forEach(s=>{
    s.setAttribute('tabindex','0');
    s.setAttribute('role','button');
    s.addEventListener('click',()=>setStep(s.dataset.step));
    s.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setStep(s.dataset.step);} });
  });
  if(steps.length) setStep('scan');
  // auto-cycle unless reduced motion or hover
  let idx=0, cycling=null;
  const order=['scan','design','make','finish','qc','deliver'];
  if(!prefersReduced && steps.length){
    const viz=$('.workflow-viz');
    cycling=setInterval(()=>{ idx=(idx+1)%order.length; if(!document.hidden) setStep(order[idx]); },4200);
    if(viz){ viz.addEventListener('pointerenter',()=>clearInterval(cycling)); }
  }

  // Card tilt (desktop, fine pointer only)
  if(window.matchMedia('(pointer:fine)').matches && !prefersReduced){
    $$('[data-tilt]').forEach(card=>{
      card.addEventListener('pointermove',e=>{
        const r=card.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
        card.style.transform=`translateY(-6px) perspective(900px) rotateX(${-y*6}deg) rotateY(${x*8}deg)`;
      });
      card.addEventListener('pointerleave',()=>{card.style.transform='';});
    });
  }

  // Magnetic buttons
  if(window.matchMedia('(pointer:fine)').matches && !prefersReduced){
    $$('.btn-primary').forEach(b=>{
      b.addEventListener('pointermove',e=>{
        const r=b.getBoundingClientRect();
        const x=e.clientX-(r.left+r.width/2), y=e.clientY-(r.top+r.height/2);
        b.style.transform=`translate(${x*.08}px,${y*.12}px)`;
      });
      b.addEventListener('pointerleave',()=>{b.style.transform='';});
    });
  }

  // Custom cursor dot
  const cursor=$('#cursor');
  if(cursor && window.matchMedia('(pointer:fine)').matches){
    window.addEventListener('pointermove',e=>{
      cursor.style.left=e.clientX+'px'; cursor.style.top=e.clientY+'px';
    },{passive:true});
    $$('a,button,.step,summary').forEach(el=>{
      el.addEventListener('pointerenter',()=>cursor.classList.add('hovering'));
      el.addEventListener('pointerleave',()=>cursor.classList.remove('hovering'));
    });
  }

  // Analytics stub — wire to your provider via window.TDL_ANALYTICS_ID
  function track(event, data){
    try{
      if(window.dataLayer) window.dataLayer.push({event,...data});
      if(window.plausible) window.plausible(event,{props:data});
      // console.debug('[track]',event,data);
    }catch(e){}
  }
  window.tdlTrack=track;
  $$('[data-track]').forEach(el=>{
    el.addEventListener('click',()=>track(el.dataset.track,{label:el.textContent.trim().slice(0,60)}));
  });

  // Forms: validation + honeypot + safe mailto fallback
  function sanitize(s){ return s.replace(/[<>"'`]/g,'').slice(0,2000); }
  function wireForm(formId, okId, errId, kind){
    const form=document.getElementById(formId);
    if(!form) return;
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const err=document.getElementById(errId), ok=document.getElementById(okId);
      if(err) err.style.display='none'; if(ok) ok.style.display='none';
      // honeypot
      const hp=form.querySelector('input[name="company_website"]');
      if(hp && hp.value){ return; } // silently drop bots
      const data={};
      let valid=true;
      form.querySelectorAll('[required]').forEach(inp=>{
        const v=inp.value.trim();
        if(!v){ valid=false; inp.setAttribute('aria-invalid','true'); }
        else inp.removeAttribute('aria-invalid');
        if(inp.type==='email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){ valid=false; inp.setAttribute('aria-invalid','true'); }
        data[inp.name]=sanitize(v);
      });
      if(!valid){ if(err){ err.textContent='Please complete the highlighted fields with a valid email.'; err.style.display='block'; } track('form_error',{kind}); return; }
      // No backend in static demo: store locally + offer mailto
      try{ localStorage.setItem('tdl_'+kind+'_'+Date.now(), JSON.stringify({...data,ts:new Date().toISOString()})); }catch(e){}
      if(ok){ ok.style.display='block'; ok.innerHTML='Thank you — your inquiry was prepared. This concept site has no live inbox yet; the buyer can connect any lab email/CRM here. <button type="button" id="'+formId+'_mailto" class="btn btn-ghost btn-small" style="margin-top:10px">Open in email app</button>'; 
        const mb=document.getElementById(formId+'_mailto');
        if(mb) mb.addEventListener('click',()=>{
          const subject=encodeURIComponent((kind==='domain'?'Domain inquiry — TexasDentalLab.com':'Lab contact — TexasDentalLab.com'));
          const body=encodeURIComponent(Object.entries(data).map(([k,v])=>k+': '+v).join('\n'));
          window.location.href=`mailto:hello@texasdentallab.com?subject=${subject}&body=${body}`;
        });
      }
      form.reset();
      track(kind==='domain'?'domain_inquiry':'contact_submit',{});
    });
  }
  wireForm('contactForm','contactOk','contactErr','contact');
  wireForm('domainForm','domainOk','domainErr','domain');

  // Smooth anchor offset for fixed header
  $$('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const id=a.getAttribute('href');
      if(id.length<2) return;
      const t=document.querySelector(id);
      if(!t) return;
      e.preventDefault();
      const y=t.getBoundingClientRect().top+window.scrollY-84;
      window.scrollTo({top:y,behavior:prefersReduced?'auto':'smooth'});
      track('anchor_click',{label:id});
    });
  });
})();
