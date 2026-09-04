(function () {
  const canvas = document.getElementById('robot-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W, H, frame = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Orbital ring particles ──
  const particles = [];
  for (let i = 0; i < 40; i++) {
    particles.push({
      angle: (i / 40) * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.008,
      radius: 130 + Math.random() * 30,
      size: 2 + Math.random() * 3,
      alpha: 0.3 + Math.random() * 0.5,
    });
  }

  function draw() {
    frame++;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 - 10;
    const bob = Math.sin(frame * 0.025) * 8;

    // ── Glow backdrop ──
    const glow = ctx.createRadialGradient(cx, cy + bob, 20, cx, cy + bob, 180);
    glow.addColorStop(0, 'rgba(0,132,255,0.12)');
    glow.addColorStop(0.5, 'rgba(49,154,255,0.06)');
    glow.addColorStop(1, 'rgba(0,132,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Head ──
    const headY = cy + bob - 40;
    ctx.beginPath();
    ctx.ellipse(cx, headY, 56, 52, 0, 0, Math.PI * 2);
    const headGrad = ctx.createLinearGradient(cx - 56, headY - 52, cx + 56, headY + 52);
    headGrad.addColorStop(0, '#E8F4FF');
    headGrad.addColorStop(0.5, '#FFFFFF');
    headGrad.addColorStop(1, '#D4EAFF');
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,132,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Eyes ──
    const blink = Math.sin(frame * 0.04) > 0.97;
    const eyeY = headY - 4;
    const eyeH = blink ? 2 : 10;
    [[-18, '#0084FF'], [18, '#0084FF']].forEach(([ox, color]) => {
      ctx.beginPath();
      ctx.ellipse(cx + ox, eyeY, 8, eyeH, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (!blink) {
        ctx.beginPath();
        ctx.arc(cx + ox + 2, eyeY - 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    });

    // ── Antenna ──
    ctx.beginPath();
    ctx.moveTo(cx, headY - 52);
    ctx.lineTo(cx, headY - 70);
    ctx.strokeStyle = 'rgba(0,132,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const pulse = 4 + Math.sin(frame * 0.08) * 2;
    ctx.beginPath();
    ctx.arc(cx, headY - 72, pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,132,255,${0.6 + Math.sin(frame * 0.08) * 0.3})`;
    ctx.fill();

    // ── Smile ──
    ctx.beginPath();
    ctx.arc(cx, eyeY + 16, 12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = '#0084FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Body ──
    const bodyY = headY + 50;
    ctx.beginPath();
    ctx.ellipse(cx, bodyY, 48, 40, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createLinearGradient(cx - 48, bodyY - 40, cx + 48, bodyY + 40);
    bodyGrad.addColorStop(0, '#D4EAFF');
    bodyGrad.addColorStop(0.5, '#FFFFFF');
    bodyGrad.addColorStop(1, '#E8F4FF');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,132,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Chest light ──
    const chestPulse = 0.5 + Math.sin(frame * 0.06) * 0.3;
    ctx.beginPath();
    ctx.arc(cx, bodyY, 8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,132,255,${chestPulse})`;
    ctx.fill();

    // ── Arms ──
    const armSwing = Math.sin(frame * 0.03) * 6;
    [[-56, 1], [56, -1]].forEach(([ox, dir]) => {
      ctx.beginPath();
      ctx.moveTo(cx + ox * 0.6, bodyY - 10);
      ctx.quadraticCurveTo(cx + ox, bodyY + armSwing * dir, cx + ox * 0.9, bodyY + 35 + armSwing * dir);
      ctx.strokeStyle = 'rgba(0,132,255,0.25)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + ox * 0.9, bodyY + 35 + armSwing * dir, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0084FF';
      ctx.fill();
    });

    // ── Orbital ring particles ──
    particles.forEach(p => {
      p.angle += p.speed;
      const px = cx + Math.cos(p.angle) * p.radius;
      const py = cy + Math.sin(p.angle) * p.radius * 0.35;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,132,255,${p.alpha * (0.5 + Math.sin(frame * 0.02 + p.angle) * 0.5)})`;
      ctx.fill();
    });

    // ── Shadow ──
    ctx.beginPath();
    ctx.ellipse(cx, cy + 95, 60, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,132,255,0.08)';
    ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
})();
