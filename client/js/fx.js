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

export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.ambient = false;
    this.reduced = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
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

  burstAt(selector, type, opts = {}) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    const r = el.getBoundingClientRect();
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

  _loop(now) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (this.ambient && !this.reduced && Math.random() < 0.14) {
      const x = Math.random() * window.innerWidth;
      const y = window.innerHeight * (0.55 + Math.random() * 0.4);
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
