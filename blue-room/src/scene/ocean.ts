/** A small, dependency-free underwater engine drawn on a 2D canvas.
 *  Layers (back → front): water gradient · light rays · surface caustics · rocks · far school ·
 *  far silhouettes (shark / ray) · jellyfish · near school · marine snow · bubbles · vignette.
 *  Everything is time-based, seeded for composition and random for behaviour, and cheap enough
 *  to run at ~30fps on ordinary hardware. */

export type OceanVariant = 'window' | 'intro' | 'mini' | 'immersive';
export type OceanMotion = 'full' | 'gentle' | 'off';

export interface OceanOptions {
  variant: OceanVariant;
  motion: OceanMotion;
  /** 0.3 – 1 : how many fish / particles to draw. */
  density?: number;
  /** seconds between shark visits (0 disables). */
  sharkEvery?: number;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fish { a: number; r: number; w: number; phase: number; size: number; ox: number; oy: number; px: number; py: number }
interface School { fish: Fish[]; cx: number; cy: number; vx: number; rx: number; ry: number; depth: number; color: string; alpha: number; scale: number; dir: 1 | -1 }
interface Jelly { x: number; y: number; r: number; phase: number; vx: number; hue: number }
interface Mote { x: number; y: number; r: number; vy: number; sway: number; phase: number }
interface Bubble { x: number; y: number; r: number; vy: number; wob: number; phase: number }
interface Ray { x0: number; x1: number; w0: number; w1: number; speed: number; phase: number; alpha: number }

export class Ocean {
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private dpr = 1; private s = 1;
  private t = 0; private last = 0;
  private raf = 0; private running = false;
  private pointer: { x: number; y: number } | null = null;
  private smoothPointer = { x: 0.5, y: 0.5 };
  private rand = mulberry32(7);
  private schools: School[] = [];
  private jellies: Jelly[] = [];
  private motes: Mote[] = [];
  private bubbles: Bubble[] = [];
  private rays: Ray[] = [];
  private rocks: { far: [number, number][]; near: [number, number][] } = { far: [], near: [] };
  private caustic: HTMLCanvasElement | null = null;
  private shark = { active: false, x: 0, y: 0, dir: 1 as 1 | -1, speed: 0, next: 0, size: 0, phase: 0 };
  private ray = { active: false, x: 0, y: 0, dir: 1 as 1 | -1, speed: 0, next: 0, size: 0, phase: 0 };
  private nextBubble = 1;
  private frameGap: number;
  /** 0 → 1 : used by the intro to let the light “arrive”. */
  lightLevel = 1;

  constructor(private canvas: HTMLCanvasElement, private opts: OceanOptions) {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.frameGap = opts.motion === 'gentle' ? 1000 / 24 : 1000 / 30;
    const every = opts.sharkEvery ?? (opts.variant === 'mini' ? 0 : 38);
    this.shark.next = every ? 7 + this.rand() * 6 : Infinity;
    this.ray.next = opts.variant === 'mini' ? Infinity : 16 + this.rand() * 10;
  }

  // ---------------------------------------------------------------- setup

  resize(w: number, h: number, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
    if (w < 2 || h < 2) return;
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.s = Math.min(w, h) / 480;
    this.compose();
    if (!this.running) this.draw();
  }

  setPointer(nx: number | null, ny?: number) { this.pointer = nx === null ? null : { x: nx * this.W, y: (ny ?? 0) * this.H }; }

  private compose() {
    const { W, H, opts } = this;
    const rnd = mulberry32(opts.variant === 'intro' ? 21 : 7);
    const d = Math.max(0.3, Math.min(1, opts.density ?? 1)) * (opts.variant === 'mini' ? 0.7 : 1);
    const mk = (n: number, rx: number, ry: number, size: number): Fish[] =>
      Array.from({ length: Math.round(n * d) }, () => {
        const r = Math.sqrt(rnd());
        return { a: rnd() * Math.PI * 2, r, w: (0.55 + (1 - r) * 0.7) * (0.8 + rnd() * 0.4), phase: rnd() * 10, size: size * (0.75 + rnd() * 0.6), ox: (rnd() - 0.5) * rx * 0.3, oy: (rnd() - 0.5) * ry * 0.3, px: 0, py: 0 };
      });
    const wide = opts.variant === 'mini' || opts.variant === 'intro' || opts.variant === 'immersive';
    const R = wide ? Math.min(W * 0.22, H * 0.9) : Math.min(W, H) * 0.34;
    this.schools = [
      // far dark school (silhouettes, like the aquarium reference)
      { fish: mk(70, R, R, 6.2), cx: W * 0.7, cy: H * 0.38, vx: 9 * this.s, rx: R * 0.8, ry: R * 0.6, depth: 0.4, color: '#06315c', alpha: 0.5, scale: this.s, dir: 1 },
      // main silver bait-ball
      { fish: mk(130, R, R, 7), cx: W * 0.28, cy: H * 0.46, vx: -6 * this.s, rx: R, ry: R * 0.85, depth: 0.75, color: '#dff3ff', alpha: 0.78, scale: this.s, dir: -1 },
      // a few larger close fish
      { fish: mk(7, R * 1.4, R * 0.5, 15), cx: W * 0.2, cy: H * 0.62, vx: 24 * this.s, rx: R * 1.5, ry: R * 0.35, depth: 1, color: '#0b3d6e', alpha: 0.62, scale: this.s, dir: 1 },
    ];
    if (opts.variant === 'intro' || opts.variant === 'immersive') {
      this.schools.push({ fish: mk(90, R, R, 7), cx: W * 0.85, cy: H * 0.3, vx: -14 * this.s, rx: R * 1.1, ry: R * 0.6, depth: 0.6, color: '#bfe6fb', alpha: 0.65, scale: this.s, dir: -1 });
    }
    const jn = opts.variant === 'mini' ? 2 : opts.variant === 'window' ? 3 : 4;
    this.jellies = Array.from({ length: jn }, (_, i) => ({ x: W * (0.15 + 0.7 * rnd()), y: H * (0.2 + 0.7 * rnd()), r: (13 + rnd() * 11) * this.s, phase: rnd() * 6, vx: (rnd() - 0.5) * 4 * this.s, hue: i % 2 }));
    this.motes = Array.from({ length: Math.round(70 * d * (W * H) / (500 * 480)) + 14 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.5 + rnd() * 1.5, vy: -(1 + rnd() * 3) * this.s, sway: 2 + rnd() * 6, phase: rnd() * 6 }));
    this.rays = Array.from({ length: wide ? 9 : 6 }, (_, i) => ({ x0: W * (0.05 + (i / (wide ? 9 : 6)) * 0.95 + rnd() * 0.06), x1: W * (0.0 + (i / (wide ? 9 : 6)) * 0.95 - 0.12 + rnd() * 0.1), w0: W * (0.025 + rnd() * 0.05), w1: W * (0.1 + rnd() * 0.12), speed: 0.05 + rnd() * 0.08, phase: rnd() * 6, alpha: 0.1 + rnd() * 0.16 }));

    // rocks: heavier on the right (as in the reference), lower elsewhere
    const rock = (base: number, amp: number, rightBias: number): [number, number][] => {
      const pts: [number, number][] = [[0, H]];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W;
        const bias = Math.pow(i / n, 2.2) * rightBias;
        const y = H - H * (base + amp * rnd() + bias * (0.55 + 0.45 * rnd()));
        pts.push([x, y]);
      }
      pts.push([W, H]);
      return pts;
    };
    this.rocks = { far: rock(0.05, 0.09, 0.3), near: rock(0.02, 0.05, 0.24) };
    if (opts.variant === 'mini') this.rocks = { far: rock(0.02, 0.04, 0.05), near: rock(0.0, 0.02, 0.04) };

    this.makeCaustics(rnd);
  }

  private makeCaustics(rnd: () => number) {
    if (typeof document === 'undefined') return;
    const c = document.createElement('canvas'); c.width = 320; c.height = 160;
    const g = c.getContext('2d')!;
    try { (g as any).filter = 'blur(1.4px)'; } catch { /* older Safari: unblurred is fine */ }
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 320, y = rnd() * 160, len = 20 + rnd() * 50, a = rnd() * Math.PI;
      g.lineWidth = 1 + rnd() * 3.2; g.globalAlpha = 0.25 + rnd() * 0.6;
      for (const ox of [-320, 0, 320]) for (const oy of [-160, 0, 160]) {
        g.beginPath(); g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 14, y + oy + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 14, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
        g.stroke();
      }
    }
    this.caustic = c;
  }

  // ---------------------------------------------------------------- loop

  start() {
    if (this.running || this.opts.motion === 'off') { if (!this.running) this.draw(); return; }
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < this.frameGap) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() { this.stop(); }

  setMotion(m: OceanMotion) {
    this.opts.motion = m;
    this.frameGap = m === 'gentle' ? 1000 / 24 : 1000 / 30;
    if (m === 'off') { this.stop(); this.draw(); }
  }

  // ---------------------------------------------------------------- simulation

  private step(dt: number) {
    const { W, H, s } = this;
    this.t += dt;
    // eased pointer for parallax
    const tx = this.pointer ? this.pointer.x / W : 0.5, ty = this.pointer ? this.pointer.y / H : 0.5;
    this.smoothPointer.x += (tx - this.smoothPointer.x) * Math.min(1, dt * 2.2);
    this.smoothPointer.y += (ty - this.smoothPointer.y) * Math.min(1, dt * 2.2);

    for (const sc of this.schools) {
      sc.cx += sc.vx * dt;
      const pad = sc.rx * 1.4;
      if (sc.vx > 0 && sc.cx - pad > W) sc.cx = -pad;
      if (sc.vx < 0 && sc.cx + pad < 0) sc.cx = W + pad;
      sc.cy += Math.sin(this.t * 0.2 + sc.depth * 5) * 3 * s * dt;
      for (const f of sc.fish) {
        f.a += f.w * dt * (sc.vx >= 0 ? 1 : -1);
        // relax any scatter displacement
        f.px *= Math.exp(-dt * 1.8); f.py *= Math.exp(-dt * 1.8);
        if (this.pointer) {
          const x = this.fishX(sc, f), y = this.fishY(sc, f);
          const dx = x - this.pointer.x, dy = y - this.pointer.y, d = Math.hypot(dx, dy) || 1, R = 95 * s;
          if (d < R) { const k = (1 - d / R) * 260 * s * dt; f.px += (dx / d) * k; f.py += (dy / d) * k; }
        }
      }
    }
    for (const j of this.jellies) {
      const pulse = Math.sin(this.t * 1.5 + j.phase);
      j.y -= (4 + 9 * Math.max(0, pulse)) * s * dt;
      j.x += (j.vx + Math.sin(this.t * 0.4 + j.phase) * 3 * s) * dt;
      if (this.pointer && Math.hypot(this.pointer.x - j.x, this.pointer.y - j.y) < 70 * s) j.phase += dt * 3.5; // a gentle startled pulse
      if (j.y < -j.r * 4) { j.y = H + j.r * 3; j.x = Math.random() * W; }
      if (j.x < -j.r * 3) j.x = W + j.r * 2; if (j.x > W + j.r * 3) j.x = -j.r * 2;
    }
    for (const m of this.motes) {
      m.y += m.vy * dt; m.x += Math.sin(this.t * 0.5 + m.phase) * m.sway * 0.3 * dt;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
    }
    this.nextBubble -= dt;
    if (this.nextBubble <= 0 && this.opts.variant !== 'mini') {
      this.nextBubble = 2.5 + Math.random() * 4;
      const n = 1 + Math.floor(Math.random() * 3), x = Math.random() * W;
      for (let i = 0; i < n; i++) this.bubbles.push({ x: x + i * 6 * s, y: H * (0.85 + Math.random() * 0.15), r: (1.6 + Math.random() * 2.6) * s, vy: -(18 + Math.random() * 16) * s, wob: 3 + Math.random() * 4, phase: Math.random() * 6 });
    }
    for (const b of this.bubbles) { b.y += b.vy * dt; b.x += Math.sin(this.t * 3 + b.phase) * b.wob * dt; }
    this.bubbles = this.bubbles.filter((b) => b.y > -10);

    // shark & ray visits
    const every = this.opts.sharkEvery ?? 38;
    if (!this.shark.active && this.t > this.shark.next && every) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.shark = { active: true, dir, size: W * (this.opts.variant === 'window' ? 0.34 : 0.22), x: dir === 1 ? -W * 0.3 : W * 1.3, y: H * (0.28 + Math.random() * 0.2), speed: W * 0.032, next: 0, phase: 0 };
    }
    if (this.shark.active) {
      this.shark.x += this.shark.dir * this.shark.speed * dt; this.shark.phase += dt * 1.7;
      if ((this.shark.dir === 1 && this.shark.x > W * 1.35) || (this.shark.dir === -1 && this.shark.x < -W * 0.35)) { this.shark.active = false; this.shark.next = this.t + every * (0.8 + Math.random() * 0.8); }
    }
    if (!this.ray.active && this.t > this.ray.next) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.ray = { active: true, dir, size: W * 0.2, x: dir === 1 ? -W * 0.2 : W * 1.2, y: H * (0.58 + Math.random() * 0.12), speed: W * 0.024, next: 0, phase: 0 };
    }
    if (this.ray.active) {
      this.ray.x += this.ray.dir * this.ray.speed * dt; this.ray.phase += dt * 1.1;
      if ((this.ray.dir === 1 && this.ray.x > W * 1.25) || (this.ray.dir === -1 && this.ray.x < -W * 0.25)) { this.ray.active = false; this.ray.next = this.t + 30 + Math.random() * 25; }
    }
  }

  private fishX(sc: School, f: Fish) { return sc.cx + Math.cos(f.a) * sc.rx * f.r + f.ox + f.px; }
  private fishY(sc: School, f: Fish) { return sc.cy + Math.sin(f.a) * sc.ry * f.r * 0.72 + Math.sin(f.a * 2.3 + f.phase) * 6 * this.s + f.oy + f.py; }

  // ---------------------------------------------------------------- drawing

  draw() {
    const { ctx, W, H, dpr } = this;
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.water();
    const px = (this.smoothPointer.x - 0.5), py = (this.smoothPointer.y - 0.5);
    this.drawRays(px);
    this.drawCaustics(px);
    this.drawRocks(this.rocks.far, '#0a3f78', 'rgba(150,210,245,0.18)', px * -0.012 * W, 0.8);
    this.drawSchool(this.schools[0], px, py);
    this.drawShark(); this.drawManta();
    this.drawRocks(this.rocks.near, '#05244a', 'rgba(150,215,250,0.26)', px * -0.03 * W, 1);
    for (const j of this.jellies) this.drawJelly(j, px);
    for (let i = 1; i < this.schools.length; i++) this.drawSchool(this.schools[i], px, py);
    this.drawMotes(px);
    this.drawBubbles();
    this.vignette();
  }

  private water() {
    const { ctx, W, H } = this;
    const L = this.lightLevel, intro = this.opts.variant === 'intro';
    const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(v + (b[i] - v) * L));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const top = mix(intro ? [8, 35, 78] : [26, 90, 150], intro ? [92, 190, 238] : [118, 200, 238]);
    const mid = mix(intro ? [6, 28, 66] : [16, 78, 140], intro ? [26, 128, 198] : [30, 132, 200]);
    const low = mix(intro ? [4, 18, 44] : [10, 52, 104], intro ? [14, 82, 150] : [18, 90, 160]);
    const bot = mix([3, 14, 36], intro ? [8, 44, 94] : [8, 48, 100]);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(0.3, `rgb(${mid})`); g.addColorStop(0.65, `rgb(${low})`); g.addColorStop(1, `rgb(${bot})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  private drawRays(px: number) {
    const { ctx, W, H, t } = this;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rays) {
      const sway = Math.sin(t * r.speed * 2 + r.phase) * W * 0.035 + px * W * 0.03;
      const a = r.alpha * (0.65 + 0.35 * Math.sin(t * 0.55 + r.phase * 1.7)) * (0.25 + 0.75 * this.lightLevel);
      const x0 = r.x0 + sway, x1 = r.x1 + sway * 1.6;
      const g = ctx.createLinearGradient(x0, 0, x1, H);
      g.addColorStop(0, `rgba(200,238,255,${a})`); g.addColorStop(0.55, `rgba(150,215,250,${a * 0.35})`); g.addColorStop(1, 'rgba(150,215,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0 - r.w0 / 2, 0); ctx.lineTo(x0 + r.w0 / 2, 0); ctx.lineTo(x1 + r.w1 / 2, H); ctx.lineTo(x1 - r.w1 / 2, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  private drawCaustics(px: number) {
    const { ctx, W, H, t, caustic } = this;
    if (!caustic) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const band = H * 0.42, strips = 9, sh = band / strips;
    const scale = Math.max(1, W / 420);
    const tw = caustic.width * scale, th = caustic.height * scale;
    for (let i = 0; i < strips; i++) {
      const fade = Math.pow(1 - i / strips, 1.6);
      ctx.globalAlpha = 0.38 * fade * (0.3 + 0.7 * this.lightLevel);
      for (const layer of [0, 1]) {
        const dx = ((t * (layer ? -9 : 6) + px * 40 * (layer + 1)) % tw + tw) % tw;
        const dy = (t * (layer ? 3 : -2) + layer * 40) % th;
        const sy = ((i * sh + dy) % th + th) % th;
        const hh = Math.min(sh, th - sy);
        for (let x = -tw + dx; x < W; x += tw) ctx.drawImage(caustic, 0, (sy / scale), caustic.width, hh / scale, x, i * sh, tw, hh);
      }
    }
    ctx.restore();
  }

  private drawRocks(pts: [number, number][], fill: string, rim: string, dx: number, alpha: number) {
    const { ctx } = this;
    ctx.save(); ctx.translate(dx, 0); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(pts[0][0] - 30, pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i]; const [nx, ny] = pts[i + 1]; ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); }
    ctx.lineTo(pts[pts.length - 1][0] + 30, pts[pts.length - 1][1]); ctx.closePath();
    const g = ctx.createLinearGradient(0, this.H * 0.55, 0, this.H); g.addColorStop(0, fill); g.addColorStop(1, '#021227');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  private drawSchool(sc: School, px: number, py: number) {
    const { ctx, t } = this;
    ctx.save();
    ctx.translate(px * -sc.depth * 0.04 * this.W, py * -sc.depth * 0.025 * this.H);
    ctx.fillStyle = sc.color;
    for (const f of sc.fish) {
      const x = this.fishX(sc, f), y = this.fishY(sc, f);
      const om = f.w * (sc.vx >= 0 ? 1 : -1);
      const vx = -Math.sin(f.a) * sc.rx * f.r * om + sc.vx + f.px * 0.5;
      const vy = Math.cos(f.a) * sc.ry * f.r * 0.72 * om;
      const ang = Math.atan2(vy, vx);
      const L = f.size * sc.scale, wag = Math.sin(t * 9 + f.phase) * 0.5;
      // shimmer: brightness varies as the fish turn toward / away from the light
      ctx.globalAlpha = sc.alpha * (0.55 + 0.45 * Math.abs(Math.sin(f.a * 1.7 + f.phase)));
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(L, 0);
      ctx.quadraticCurveTo(L * 0.2, -L * 0.34, -L * 0.55, -L * 0.04);
      ctx.lineTo(-L * 0.95, -L * 0.3 + wag * L * 0.25);
      ctx.lineTo(-L * 0.85, wag * L * 0.2);
      ctx.lineTo(-L * 0.95, L * 0.3 + wag * L * 0.25);
      ctx.lineTo(-L * 0.55, L * 0.04);
      ctx.quadraticCurveTo(L * 0.2, L * 0.34, L, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawJelly(j: Jelly, px: number) {
    const { ctx, t, s } = this;
    const pulse = Math.sin(t * 1.5 + j.phase);
    const r = j.r * (1 + 0.1 * pulse), h = j.r * (0.82 - 0.14 * pulse);
    const x = j.x + px * -0.02 * this.W;
    ctx.save(); ctx.translate(x, j.y);
    // tentacles
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const ox = (i / 5 - 0.5) * r * 1.5;
      ctx.beginPath(); ctx.moveTo(ox, 0);
      const len = j.r * (2.2 + (i % 3) * 0.7);
      for (let k = 1; k <= 8; k++) { const f = k / 8; ctx.lineTo(ox + Math.sin(t * 1.3 + i * 0.9 + f * 4) * f * 6 * s, f * len); }
      ctx.strokeStyle = `rgba(215,238,255,${0.35 - i * 0.02})`; ctx.lineWidth = Math.max(0.8, 1.5 * s); ctx.stroke();
    }
    // bell
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.bezierCurveTo(-r, -h * 1.3, r, -h * 1.3, r, 0); ctx.quadraticCurveTo(0, h * 0.28, -r, 0); ctx.closePath();
    const g = ctx.createRadialGradient(0, -h * 0.4, 1, 0, -h * 0.2, r * 1.2);
    g.addColorStop(0, 'rgba(240,250,255,0.78)'); g.addColorStop(0.7, 'rgba(168,214,247,0.38)'); g.addColorStop(1, j.hue ? 'rgba(190,196,245,0.2)' : 'rgba(130,200,240,0.18)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(0.8, s); ctx.stroke();
    ctx.restore();
  }

  private drawShark() {
    const sk = this.shark; if (!sk.active) return;
    const { ctx } = this;
    const L = sk.size, sway = Math.sin(sk.phase) * 0.035;
    ctx.save(); ctx.translate(sk.x, sk.y + Math.sin(sk.phase * 0.5) * 6); ctx.scale(sk.dir, 1); ctx.scale(L, L);
    ctx.rotate(sway * 0.4);
    ctx.beginPath();
    ctx.moveTo(0.5, 0.004);
    ctx.bezierCurveTo(0.38, -0.05, 0.2, -0.075, 0.02, -0.07); // snout → back
    ctx.lineTo(-0.02, -0.075); ctx.lineTo(-0.06, -0.175); ctx.bezierCurveTo(-0.12, -0.12, -0.15, -0.085, -0.19, -0.062); // dorsal fin
    ctx.bezierCurveTo(-0.3, -0.045, -0.4, -0.03 + sway, -0.455, -0.012 + sway * 2);
    ctx.lineTo(-0.52, -0.1 + sway * 3); ctx.bezierCurveTo(-0.5, -0.04 + sway * 2, -0.49, -0.005 + sway * 2, -0.485, 0.01 + sway * 2); // tail upper lobe
    ctx.bezierCurveTo(-0.49, 0.03 + sway * 2, -0.5, 0.06 + sway * 2, -0.5, 0.07 + sway * 3); ctx.bezierCurveTo(-0.44, 0.045 + sway * 2, -0.4, 0.034 + sway, -0.34, 0.032);
    ctx.bezierCurveTo(-0.2, 0.048, -0.05, 0.062, 0.08, 0.06); // belly
    ctx.lineTo(0.0, 0.14); ctx.bezierCurveTo(0.03, 0.09, 0.06, 0.07, 0.1, 0.062); // pectoral fin
    ctx.bezierCurveTo(0.25, 0.06, 0.4, 0.04, 0.5, 0.004);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,28,60,0.62)'; ctx.fill();
    ctx.restore();
  }

  private drawManta() {
    const r = this.ray; if (!r.active) return;
    const { ctx } = this;
    const flap = Math.sin(r.phase * 2.2) * 0.35, L = r.size;
    ctx.save(); ctx.translate(r.x, r.y + Math.sin(r.phase) * 5); ctx.scale(r.dir * L, L);
    ctx.beginPath();
    ctx.moveTo(0.3, 0);
    ctx.bezierCurveTo(0.12, -0.08 - flap * 0.1, -0.05, -0.28 - flap * 0.2, -0.28, -0.32 - flap * 0.24); // upper wing
    ctx.bezierCurveTo(-0.2, -0.12, -0.18, -0.04, -0.2, 0);
    ctx.lineTo(-0.58, 0.01); ctx.lineTo(-0.2, 0.025);
    ctx.bezierCurveTo(-0.18, 0.05, -0.2, 0.13, -0.28, 0.32 + flap * 0.24);
    ctx.bezierCurveTo(-0.05, 0.28 + flap * 0.2, 0.12, 0.08 + flap * 0.1, 0.3, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,36,74,0.5)'; ctx.fill();
    ctx.restore();
  }

  private drawMotes(px: number) {
    const { ctx, t } = this;
    ctx.save(); ctx.fillStyle = '#d9f1ff';
    for (const m of this.motes) {
      ctx.globalAlpha = 0.14 + 0.32 * Math.abs(Math.sin(t * 0.8 + m.phase));
      ctx.beginPath(); ctx.arc(m.x + px * -m.r * 14, m.y, m.r * this.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private drawBubbles() {
    const { ctx } = this;
    ctx.save(); ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      ctx.globalAlpha = 0.55; ctx.strokeStyle = 'rgba(235,248,255,0.9)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private vignette() {
    const { ctx, W, H } = this;
    const g = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(2,14,36,0)'); g.addColorStop(1, 'rgba(2,14,36,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
