/* ================================================
   EDUTRACK PRO v2.0 — LOGIN SCRIPT
   Auth · Canvas Particles · Session Management
   ================================================ */
"use strict";

const USERS = [
  { email: 'admin@edutrack.com',   password: 'admin123', name: 'Admin User',    role: 'Super Admin',   initials: 'AU' },
  { email: 'teacher@edutrack.com', password: 'teach123', name: 'Prof. Sharma',  role: 'Faculty Staff', initials: 'PS' },
];

// ── SESSION GUARD ─────────────────────────────
(function(){
  const s = sessionStorage.getItem('et_session') || localStorage.getItem('et_session');
  if (s) { try { if (JSON.parse(s).email) { window.location.replace('index.html'); return; } } catch{} }
})();

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  animateCounters();
  loadRemembered();
  document.getElementById('email').focus();
});

// ── PARTICLES ─────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], lines = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.r  = Math.random() * 1.5 + 0.4;
      this.a  = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > W) this.vx *= -1;
      if (this.y < 0 || this.y > H) this.vy *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${this.a})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${0.06 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
}

// ── COUNTER ANIMATION ─────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    let current = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current).toLocaleString('en-IN');
      if (current >= target) clearInterval(timer);
    }, 20);
  });
}

// ── REMEMBER ME ───────────────────────────────
function loadRemembered() {
  const r = localStorage.getItem('et_remember');
  if (!r) return;
  try {
    const { email } = JSON.parse(r);
    document.getElementById('email').value = email;
    document.getElementById('rememberMe').checked = true;
  } catch{}
}

// ── AUTOFILL ──────────────────────────────────
function autofill() {
  document.getElementById('email').value = 'admin@edutrack.com';
  document.getElementById('password').value = 'admin123';
  clearFE('fg-email'); clearFE('fg-password');
  showToast('Credentials autofilled!', 'info');
}

// ── LOGIN ─────────────────────────────────────
function doLogin() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const remember = document.getElementById('rememberMe').checked;
  const btn      = document.getElementById('signinBtn');

  clearFE('fg-email'); clearFE('fg-password');

  let err = false;
  if (!email) { setFE('fg-email','fe-email','Email is required'); err = true; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFE('fg-email','fe-email','Enter a valid email address'); err = true; }
  if (!password) { setFE('fg-password','fe-password','Password is required'); err = true; }
  if (err) return;

  btn.classList.add('loading'); btn.disabled = true;

  setTimeout(() => {
    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (user) {
      const session = JSON.stringify({ email: user.email, name: user.name, role: user.role, initials: user.initials, ts: Date.now() });
      if (remember) {
        localStorage.setItem('et_session', session);
        localStorage.setItem('et_remember', JSON.stringify({ email: user.email }));
      } else {
        sessionStorage.setItem('et_session', session);
        localStorage.removeItem('et_remember');
      }
      btn.classList.remove('loading');
      btn.classList.add('success');
      document.getElementById('signinLabel').style.display = '';
      document.getElementById('signinLabel').textContent = '✓ Authenticated';
      document.getElementById('btnArrow').style.display = 'none';
      showToast(`Welcome, ${user.name}!`, 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 700);
    } else {
      btn.classList.remove('loading'); btn.disabled = false;
      setFE('fg-email','fe-email',' ');
      setFE('fg-password','fe-password','Incorrect email or password. Please try again.');
      document.querySelector('.fp-inner').classList.add('shake');
      setTimeout(() => document.querySelector('.fp-inner').classList.remove('shake'), 500);
      showToast('Invalid credentials', 'error');
    }
  }, 900);
}

function showForgot() { showToast('Password reset link sent! (demo mode)', 'info'); }

// ── PASSWORD TOGGLE ───────────────────────────
let pwShow = false;
function togglePW() {
  pwShow = !pwShow;
  document.getElementById('password').type = pwShow ? 'text' : 'password';
  document.getElementById('eyeSvg').innerHTML = pwShow
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}

// ── FIELD HELPERS ─────────────────────────────
function setFE(gid, eid, msg) {
  document.getElementById(gid)?.classList.add('has-error');
  const e = document.getElementById(eid);
  if (e) e.textContent = msg;
}
function clearFE(gid) {
  document.getElementById(gid)?.classList.remove('has-error');
  const g = document.getElementById(gid);
  if (g) { const e = g.querySelector('.fe-msg'); if (e) e.textContent = ''; }
}

// ── TOAST ─────────────────────────────────────
let _tt = null;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = `toast ${type} show`;
  if (_tt) clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 3200);
}
