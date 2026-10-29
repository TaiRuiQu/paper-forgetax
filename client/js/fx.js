const COLORS = {
  break: ['#e05a4f', '#ff9a6a', '#6b2620', '#ffd0a0'],
  damage: ['#ff9a4c', '#ffd166', '#7c4420'],
  hold: ['#a89d8b', '#d8cbb0', '#5d5448'],
  success: ['#78c69c', '#c9f0d8', '#3d7257'],
  great: ['#ffdc92', '#ff9a3c', '#fff6d8', '#e8b45a'],
  ember: ['#ff7a3c', '#ffd166', '#ffa45c'],
  gold: ['#e8b45a', '#ffdc92'],
  ghost: ['#7fd8c0', '#bff5e6', '#3d8a76'],
};

function visibleRect(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return null;
  return r;
}

export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.ambient = false;
    this.reduced = false;
    this.resize();
    // Size the drawing surface from the canvas itself, not window.innerWidth/innerHeight:
    // on phones those can disagree with the real viewport (fullscreen, rotation, an
    // inflated layout viewport), which scaled every particle towards the top-left.
    const resize = () => this.resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.visualViewport?.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', resize);
    if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // Particles are positioned in viewport (client) coordinates; map them onto the canvas.
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width || window.innerWidth;
    this.h = r.height || window.innerHeight;
    this.left = r.left;
    this.top = r.top;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.w * this.dpr));
    const height = Math.max(1, Math.round(this.h * this.dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  setReduced(v) { this.reduced = Boolean(v); }
  setAmbient(v) { this.ambient = Boolean(v); }

  spawn(x, y, count, colors, opts = {}) {
    const n = this.reduced ? Math.ceil(count * 0.3) : count;
    for (let i = 0; i < n; i++) {
      const angle = opts.direction !== undefined ? opts.direction + (Math.random() - 0.5) * 1.5 : Math.random() * Math.PI * 2;
      const speed = (opts.speed || 2.2) * (0.35 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (opts.lift || 0.6),
        life: (opts.life || 0.8) * (0.6 + Math.random() * 0.7),
        maxLife: opts.life || 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: (opts.size || 3) * (0.6 + Math.random()),
        gravity: opts.gravity ?? 0.08,
        glow: opts.glow ?? false,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  // Bursts from the first target that is actually on screen. Panels are hidden
  // in the phone layouts, and a hidden element's box sits at 0,0, which piled
  // the particles up in the top-left corner.
  burstAt(selectors, type, opts = {}) {
    const r = [].concat(selectors).map(visibleRect).find(Boolean);
    if (!r) return;
    const x = r.left + r.width * (opts.x ?? 0.5);
    const y = r.top + r.height * (opts.y ?? 0.45);
    const colors = COLORS[type] || COLORS.ember;
    this.spawn(x, y, opts.count || 26, colors, { speed: 3.2, size: 3.2, gravity: 0.1, lift: 1 });
  }

  floatText(x, y, text, color = '#ffdc92', big = false) {
    const el = document.createElement('div');
    el.className = 'float-num';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    if (big) el.style.fontSize = '20px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  shake(selector) {
    if (this.reduced) return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 380);
  }

  forgeImpact({ broken = false, great = false } = {}) {
    const rig = document.getElementById('forge-rig');
    const flash = document.getElementById('forge-flash');
    if (!rig || !flash || !visibleRect(rig)) return;
    const r = flash.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    // Hot steel flies sideways and falls; forge feedback is not result confetti.
    const sparks = ['#fff0c3', '#ffd178', '#ff9d3e', '#e36b26'];
    const count = great ? 22 : 14;
    this.spawn(x, y, count, sparks, { direction: -2.65, speed: 8, size: 2.5, life: .45, gravity: .28, lift: .6 });
    this.spawn(x, y, count, sparks, { direction: -.5, speed: 8, size: 2.5, life: .45, gravity: .28, lift: .6 });
    this.spawn(x, y + 8, broken ? 20 : 8, ['#afa28a', '#716656', '#54493e'], { direction: -.1, speed: 3.6, size: 4, life: .55, gravity: .24 });
    flash.getAnimations().forEach(a => a.cancel());
    flash.animate([{ opacity: .95 }, { opacity: .35, offset: .3 }, { opacity: 0 }], { duration: this.reduced ? 70 : 115 });
    if (this.reduced) return;
    rig.getAnimations().forEach(a => a.cancel());
    rig.animate([
      { transform: 'translateX(-50%) translate(0,6px)' },
      { transform: 'translateX(-50%) translate(-3px,-2px)', offset: .2 },
      { transform: 'translateX(-50%) translate(2px,2px)', offset: .43 },
      { transform: 'translateX(-50%) translate(-1px,0)', offset: .7 },
      { transform: 'translateX(-50%)' },
    ], { duration: great || broken ? 230 : 190, easing: 'ease-out' });
    document.querySelector('.game-bg')?.animate([
      { transform: 'translate(0,3px)' },
      { transform: 'translate(-3px,-1px)', offset: .22 },
      { transform: 'translate(2px,1px)', offset: .46 },
      { transform: 'translate(0,0)' },
    ], { duration: 160, easing: 'ease-out' });
  }

  _loop(now) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    const sx = this.canvas.width / this.w;
    const sy = this.canvas.height / this.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(sx, 0, 0, sy, -this.left * sx, -this.top * sy);

    if (this.ambient && !this.reduced && Math.random() < 0.14) {
      const x = this.left + this.w * (0.02 + Math.random() * 0.18);
      const y = this.top + this.h * (0.4 + Math.random() * 0.24);
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.25 - Math.random() * 0.5,
        life: 3 + Math.random() * 2, maxLife: 5, color: Math.random() < 0.25 ? '#ffdc92' : '#ff7a3c',
        size: 1.5 + Math.random() * 2, gravity: -0.005, glow: true,
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt * 60;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      const alpha = Math.max(0, Math.min(1, p.life / Math.max(0.001, p.maxLife)));
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.size)), Math.max(1, Math.round(p.size)));
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    requestAnimationFrame(this._loop);
  }
}
