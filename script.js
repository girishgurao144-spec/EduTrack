/* ================================================
   EDUTRACK PRO v2.0 — DASHBOARD SCRIPT
   Full CRUD · Charts · Activity · Chatbot · Export
   ================================================ */
"use strict";

// ── CONFIG ────────────────────────────────────
const COURSE_FEES = { BCA: 45000, BBA: 40000, BCOM: 35000 };
const ITEMS_PER_PAGE = 8;

// ── STATE ─────────────────────────────────────
let students   = [];
let editId     = null;
let sortCol    = 'name';
let sortAsc    = true;
let curPage    = 1;
let activity   = [];
let barChart, doughnutChart, courseCompareChart, yearChart, statusChart;
let chartInited = false;

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSession();
  loadData();
  initBgCanvas();
  updateDateChip();
  updateDashboard();
  renderTable();
  setTimeout(() => {
    initCharts();
    chartInited = true;
  }, 300);
});

// ── SESSION ───────────────────────────────────
function loadSession() {
  try {
    const raw = sessionStorage.getItem('et_session') || localStorage.getItem('et_session');
    if (!raw) return;
    const s = JSON.parse(raw);
    const initials = s.initials || (s.name?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'AD');
    ['sbAvatar','tbpAvatar'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = initials; });
    ['sbName','tbpName'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = s.name || 'Admin'; });
    ['sbRole','tbpRole'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = s.role || 'Super Admin'; });
  } catch {}
}

// ── DATA ──────────────────────────────────────
function loadData() {
  try {
    const r = localStorage.getItem('et_students');
    students = r ? JSON.parse(r) : [];
    const a = localStorage.getItem('et_activity');
    activity = a ? JSON.parse(a) : [];
  } catch { students = []; activity = []; }
}
function saveData() {
  localStorage.setItem('et_students', JSON.stringify(students));
  localStorage.setItem('et_activity', JSON.stringify(activity.slice(0, 50)));
}

// ── BG CANVAS ─────────────────────────────────
function initBgCanvas() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];
  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  resize(); window.addEventListener('resize', resize);
  for (let i = 0; i < 50; i++) pts.push({ x: Math.random()*1920, y: Math.random()*1080, vx: (Math.random()-.5)*.25, vy: (Math.random()-.5)*.25, r: Math.random()*1.2+.3 });
  (function loop() {
    ctx.clearRect(0,0,W,H);
    pts.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>W) p.vx*=-1;
      if(p.y<0||p.y>H) p.vy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = 'rgba(0,212,255,0.35)'; ctx.fill();
    });
    requestAnimationFrame(loop);
  })();
}

// ── DATE ──────────────────────────────────────
function updateDateChip() {
  const el = document.getElementById('datechip');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-IN', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

// ── NAVIGATION ────────────────────────────────
function goPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sn-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  const titles = { dashboard:'Dashboard', students:'Students', analytics:'Analytics' };
  const el = document.getElementById('tbPage'); if (el) el.textContent = titles[page] || page;
  if (page === 'analytics') { renderAnalytics(); if (!chartInited) { initCharts(); chartInited = true; } else { updateAnalyticsCharts(); } }
  if (window.innerWidth <= 900) document.getElementById('sidebar')?.classList.remove('open');
  return false;
}

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

// ── DASHBOARD UPDATE ──────────────────────────
function updateDashboard() {
  const total   = students.reduce((s,st) => s + (COURSE_FEES[st.course]||0), 0);
  const paid    = students.reduce((s,st) => s + (Number(st.feesPaid)||0), 0);
  const balance = total - paid;
  const pct     = total > 0 ? Math.round((paid/total)*100) : 0;
  const n       = students.length;

  setText('kv-students', n);
  setText('kv-total',    '₹'+fmt(total));
  setText('kv-paid',     '₹'+fmt(paid));
  setText('kv-balance',  '₹'+fmt(balance));
  setText('kc-trend-students', `${n} enrolled`);
  setText('kc-trend-total',    `₹${fmt(total)} total`);
  setText('kc-trend-paid',     `${pct}% collected`);
  setText('kc-trend-balance',  `${100-pct}% pending`);

  setBar('kb-students', Math.min(n/20*100, 100));
  setBar('kb-total', pct);
  setBar('kb-paid', pct);
  setBar('kb-balance', 100-pct);

  setText('pprNum', pct+'%');
  setBar('bigBar', pct);

  // Course breakdown
  const counts = { BCA:{n:0,paid:0,total:0}, BBA:{n:0,paid:0,total:0}, BCOM:{n:0,paid:0,total:0} };
  students.forEach(s => {
    if (counts[s.course]) {
      counts[s.course].n++;
      counts[s.course].paid  += Number(s.feesPaid)||0;
      counts[s.course].total += COURSE_FEES[s.course]||0;
    }
  });
  const cbd = document.getElementById('courseBreakdown');
  if (cbd) {
    const maxN = Math.max(...Object.values(counts).map(c=>c.n), 1);
    cbd.innerHTML = Object.entries(counts).map(([c,v]) => `
      <div class="cb-row">
        <span class="cb-name">${c}</span>
        <div class="cb-bar-w"><div class="cb-fill ${c.toLowerCase()}" style="width:${Math.round(v.n/maxN*100)}%"></div></div>
        <span class="cb-stat">${v.n} · ₹${v.paid>0?fmt(v.paid):'0'}</span>
      </div>`).join('');
  }

  // Activity feed
  renderActivity();

  // Update charts if visible
  if (chartInited && barChart) updateBarChart();
  if (chartInited && doughnutChart) updateDoughnutChart();
}

function setText(id, val) { const el = document.getElementById(id); if(el) el.textContent = val; }
function setBar(id, pct) { const el = document.getElementById(id); if(el) el.style.width = pct+'%'; }
function fmt(n) { return Number(n).toLocaleString('en-IN'); }

// ── ACTIVITY ──────────────────────────────────
function logActivity(type, text) {
  activity.unshift({ type, text, ts: Date.now() });
  activity = activity.slice(0, 30);
  saveData();
  renderActivity();
}

function renderActivity() {
  const el = document.getElementById('activityList');
  if (!el) return;
  if (!activity.length) { el.innerHTML = '<div class="act-empty">No recent activity</div>'; return; }
  el.innerHTML = activity.slice(0, 10).map(a => {
    const icons = { add:'➕', edit:'✏️', delete:'🗑' };
    const time = timeSince(a.ts);
    return `<div class="act-item">
      <div class="act-icon ${a.type}">${icons[a.type]||'•'}</div>
      <div class="act-text"><strong>${a.text}</strong><span>${time}</span></div>
    </div>`;
  }).join('');
}

function clearActivity() { activity = []; saveData(); renderActivity(); }

function timeSince(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if (s<60) return 'just now';
  const m = Math.floor(s/60); if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── CHARTS ────────────────────────────────────
function chartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    gridColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    textColor:  isDark ? '#404668' : '#9098c0',
    fontFamily: "'JetBrains Mono', monospace",
  };
}

function initCharts() {
  const d = chartDefaults();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // BAR CHART
  const bcEl = document.getElementById('barChart');
  if (bcEl) {
    if (barChart) barChart.destroy();
    barChart = new Chart(bcEl, {
      type: 'bar',
      data: { labels: months.slice(0,new Date().getMonth()+1), datasets: [
        { label:'Collected', data: generateMonthlyData('paid'), backgroundColor: 'rgba(0,229,160,0.7)', borderRadius: 4, borderSkipped: false },
        { label:'Balance',   data: generateMonthlyData('bal'),  backgroundColor: 'rgba(255,94,87,0.5)',  borderRadius: 4, borderSkipped: false },
      ]},
      options: barOpts(d),
    });
  }

  // DOUGHNUT
  const dcEl = document.getElementById('doughnutChart');
  if (dcEl) {
    if (doughnutChart) doughnutChart.destroy();
    const counts = getCounts();
    doughnutChart = new Chart(dcEl, {
      type: 'doughnut',
      data: {
        labels: ['BCA','BBA','BCOM'],
        datasets: [{ data: [counts.BCA, counts.BBA, counts.BCOM], backgroundColor: ['rgba(0,212,255,0.8)','rgba(167,139,250,0.8)','rgba(0,229,160,0.8)'], borderWidth: 0, hoverOffset: 6 }]
      },
      options: { cutout:'72%', plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} students` } } }, animation:{ animateRotate:true } }
    });
    renderDoughnutLegend(counts);
  }
}

function generateMonthlyData(type) {
  const m = new Date().getMonth()+1;
  return Array.from({length:m}, (_,i) => {
    const mStudents = students.filter(s => {
      const yr = Number(s.year)||2025;
      return yr <= 2025;
    });
    const base = mStudents.reduce((sum,s) => {
      const fee = COURSE_FEES[s.course]||0;
      const p   = Number(s.feesPaid)||0;
      if (type==='paid') return sum + Math.round(p * ((i+1)/12));
      else return sum + Math.round((fee-p) * ((i+1)/12));
    }, 0);
    return Math.max(0, base + Math.round(Math.random()*5000 - 2500));
  });
}

function barOpts(d) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{ label: ctx => ` ₹${fmt(ctx.raw)}` } } },
    scales: {
      x: { grid:{ color:d.gridColor }, ticks:{ color:d.textColor, font:{family:d.fontFamily,size:11} } },
      y: { grid:{ color:d.gridColor }, ticks:{ color:d.textColor, font:{family:d.fontFamily,size:11}, callback: v => '₹'+fmt(v) } }
    }
  };
}

function getCounts() {
  const c = { BCA:0, BBA:0, BCOM:0 };
  students.forEach(s => { if(c[s.course]!==undefined) c[s.course]++; });
  return c;
}

function renderDoughnutLegend(counts) {
  const el = document.getElementById('dLegend');
  if (!el) return;
  const colors = { BCA:'#00d4ff', BBA:'#a78bfa', BCOM:'#00e5a0' };
  el.innerHTML = Object.entries(counts).map(([c,n]) => `
    <div class="dl-item">
      <div class="dl-dot" style="background:${colors[c]}"></div>
      <span class="dl-course">${c}</span>
      <span class="dl-count">${n} students</span>
    </div>`).join('');
}

function updateBarChart() {
  if (!barChart) return;
  barChart.data.datasets[0].data = generateMonthlyData('paid');
  barChart.data.datasets[1].data = generateMonthlyData('bal');
  barChart.update();
}
function updateDoughnutChart() {
  if (!doughnutChart) return;
  const c = getCounts();
  doughnutChart.data.datasets[0].data = [c.BCA, c.BBA, c.BCOM];
  doughnutChart.update();
  renderDoughnutLegend(c);
}

function renderAnalytics() {
  const anlRows = document.getElementById('anlRows');
  if (!anlRows) return;
  const total   = students.reduce((s,st)=>s+(COURSE_FEES[st.course]||0),0);
  const paid    = students.reduce((s,st)=>s+(Number(st.feesPaid)||0),0);
  const pct     = total>0?Math.round(paid/total*100):0;
  const active  = students.filter(s=>s.status==='Active').length;
  const avg     = students.length>0?Math.round(paid/students.length):0;
  anlRows.innerHTML = [
    ['Total Students', students.length],
    ['Total Fee Pool', '₹'+fmt(total)],
    ['Total Collected','₹'+fmt(paid)],
    ['Total Balance',  '₹'+fmt(Math.max(0,total-paid))],
    ['Collection Rate', pct+'%'],
    ['Active Students', active],
    ['Avg Fees/Student','₹'+fmt(avg)],
  ].map(([l,v]) => `<div class="anl-row"><span class="ar-label">${l}</span><span class="ar-val">${v}</span></div>`).join('');
}

function updateAnalyticsCharts() {
  const d = chartDefaults();
  const counts = getCounts();
  const byYear = {};
  students.forEach(s => { const y=s.year||2025; byYear[y]=(byYear[y]||0)+1; });
  const years = Object.keys(byYear).sort();

  // Course compare
  const ccEl = document.getElementById('courseCompareChart');
  if (ccEl) {
    if (courseCompareChart) courseCompareChart.destroy();
    const courses = ['BCA','BBA','BCOM'];
    courseCompareChart = new Chart(ccEl, {
      type: 'bar',
      data: {
        labels: courses,
        datasets: [
          { label:'Paid', data: courses.map(c => students.filter(s=>s.course===c).reduce((sum,s)=>sum+(Number(s.feesPaid)||0),0)), backgroundColor:'rgba(0,229,160,0.7)', borderRadius:4, borderSkipped:false },
          { label:'Balance', data: courses.map(c => { const st=students.filter(s=>s.course===c); return st.reduce((sum,s)=>sum+(COURSE_FEES[c]-Number(s.feesPaid||0)),0); }), backgroundColor:'rgba(255,94,87,0.5)', borderRadius:4, borderSkipped:false }
        ]
      },
      options: { ...barOpts(d), scales: { ...barOpts(d).scales, x:{ ...barOpts(d).scales.x, stacked:false } } }
    });
  }

  // Year chart
  const ycEl = document.getElementById('yearChart');
  if (ycEl) {
    if (yearChart) yearChart.destroy();
    yearChart = new Chart(ycEl, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{ label:'Enrollments', data: years.map(y=>byYear[y]||0), borderColor:'#00d4ff', backgroundColor:'rgba(0,212,255,0.1)', borderWidth:2, pointBackgroundColor:'#00d4ff', fill:true, tension:0.4 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: { x:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{family:d.fontFamily,size:11}}}, y:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{family:d.fontFamily,size:11},stepSize:1}} } }
    });
  }

  // Status chart
  const scEl = document.getElementById('statusChart');
  if (scEl) {
    if (statusChart) statusChart.destroy();
    const active=students.filter(s=>s.status==='Active').length;
    const inactive=students.filter(s=>s.status==='Inactive').length;
    const grad=students.filter(s=>s.status==='Graduated').length;
    statusChart = new Chart(scEl, {
      type: 'doughnut',
      data: { labels:['Active','Inactive','Graduated'], datasets:[{ data:[active,inactive,grad], backgroundColor:['rgba(0,229,160,0.8)','rgba(255,94,87,0.5)','rgba(255,183,0,0.8)'], borderWidth:0, hoverOffset:6 }] },
      options: { cutout:'70%', plugins:{ legend:{ display:true, position:'bottom', labels:{ color:d.textColor, font:{family:d.fontFamily,size:11}, padding:12, boxWidth:10 } } } }
    });
  }

  renderAnalytics();
}

// ── FORM ──────────────────────────────────────
function onCourseChange() {
  const course = document.getElementById('f-course').value;
  const fees   = COURSE_FEES[course] || 0;
  document.getElementById('f-total').value = course ? '₹'+fmt(fees) : '';
  calcBalance();
}
function calcBalance() {
  const course = document.getElementById('f-course').value;
  const total  = COURSE_FEES[course] || 0;
  const paid   = Number(document.getElementById('f-paid').value) || 0;
  document.getElementById('f-balance').value = total ? '₹'+fmt(Math.max(0,total-paid)) : '';
}

function scrollToForm() { document.getElementById('studentForm')?.scrollIntoView({ behavior:'smooth', block:'start' }); }

function resetForm() {
  const ids = ['f-id','f-name','f-address','f-phone','f-email','f-course','f-paid','f-total','f-balance'];
  ids.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('f-year').value = '2025';
  document.getElementById('f-status').value = 'Active';
  cancelEdit();
}

function cancelEdit() {
  editId = null;
  document.getElementById('btn-add').style.display    = '';
  document.getElementById('btn-update').style.display = 'none';
  document.getElementById('btn-cancel').style.display = 'none';
  document.getElementById('formHeading').textContent  = 'New Student';
  document.getElementById('formModeTag').textContent  = 'ADD';
  document.getElementById('formModeTag').classList.remove('edit');
  document.getElementById('formStatusDot').classList.remove('edit');
  document.getElementById('f-id').readOnly = false;
  clearFormErrors();
}

function clearFormErrors() {
  document.querySelectorAll('.fg.has-error').forEach(el => el.classList.remove('has-error'));
  document.querySelectorAll('.fge-err').forEach(el => el.textContent = '');
}

// ── VALIDATION ────────────────────────────────
function validateForm() {
  clearFormErrors(); let ok = true;
  const rules = [
    { field:'f-id',    err:'err-id',    msg:'Student ID is required',     check: v => !!v },
    { field:'f-name',  err:'err-name',  msg:'Full name is required',      check: v => !!v },
    { field:'f-phone', err:'err-phone', msg:'Phone number is required',   check: v => !!v },
    { field:'f-email', err:'err-email', msg:'Enter a valid email',        check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    { field:'f-course',err:'err-course',msg:'Please select a course',     check: v => !!v },
    { field:'f-paid',  err:'err-paid',  msg:'Fees paid cannot be negative', check: v => Number(v) >= 0, transform: v => v||'0' },
  ];
  rules.forEach(({field,err,msg,check,transform}) => {
    const el = document.getElementById(field);
    const val = transform ? transform(el.value.trim()) : el.value.trim();
    if (!check(val)) {
      el.closest('.fg')?.classList.add('has-error');
      const e = document.getElementById(err); if(e) e.textContent = msg;
      ok = false;
    }
  });
  const paid = Number(document.getElementById('f-paid').value||0);
  const course = document.getElementById('f-course').value;
  if (course && paid > COURSE_FEES[course]) {
    document.getElementById('fg-fge-paid')?.classList.add('has-error');
    const e = document.getElementById('err-paid'); if(e) e.textContent = `Cannot exceed ₹${fmt(COURSE_FEES[course])}`;
    ok = false;
  }
  return ok;
}

// ── ADD STUDENT ───────────────────────────────
function addStudent() {
  if (!validateForm()) return;
  const id = document.getElementById('f-id').value.trim();
  if (students.some(s => s.id === id)) { showToast('Student ID already exists!','error'); return; }
  const s = buildStudentObj();
  students.push(s);
  saveData();
  logActivity('add', `Added ${s.name} (${s.course})`);
  updateDashboard(); renderTable();
  resetForm();
  showToast(`✓ ${s.name} added successfully`,'success');
  if (chartInited) { updateBarChart(); updateDoughnutChart(); }
}

// ── EDIT STUDENT ──────────────────────────────
function editStudent(id) {
  const s = students.find(st => st.id === id);
  if (!s) return;
  editId = id;
  goPage('students');
  const map = { 'f-id':s.id,'f-name':s.name,'f-address':s.address||'','f-phone':s.phone,'f-email':s.email,'f-course':s.course,'f-paid':s.feesPaid,'f-year':s.year||'2025','f-status':s.status||'Active' };
  Object.entries(map).forEach(([fid,val]) => { const el=document.getElementById(fid); if(el) el.value=val; });
  document.getElementById('f-id').readOnly = true;
  onCourseChange();
  document.getElementById('btn-add').style.display    = 'none';
  document.getElementById('btn-update').style.display = '';
  document.getElementById('btn-cancel').style.display = '';
  document.getElementById('formHeading').textContent  = `Editing: ${s.name}`;
  document.getElementById('formModeTag').textContent  = 'EDIT';
  document.getElementById('formModeTag').classList.add('edit');
  document.getElementById('formStatusDot').classList.add('edit');
  scrollToForm();
}

// ── UPDATE STUDENT ────────────────────────────
function updateStudent() {
  if (!validateForm()) return;
  const idx = students.findIndex(s => s.id === editId);
  if (idx < 0) { showToast('Student not found','error'); return; }
  const s = buildStudentObj(editId);
  students[idx] = s;
  saveData();
  logActivity('edit', `Updated ${s.name} (${s.course})`);
  updateDashboard(); renderTable();
  resetForm();
  showToast(`✓ ${s.name} updated successfully`,'success');
  if (chartInited) { updateBarChart(); updateDoughnutChart(); }
}

// ── DELETE STUDENT ────────────────────────────
function deleteStudent(id) {
  const s = students.find(st => st.id === id);
  if (!s) return;
  if (!confirm(`Delete "${s.name}"?\nThis cannot be undone.`)) return;
  students = students.filter(st => st.id !== id);
  saveData();
  logActivity('delete', `Removed ${s.name} (${s.course})`);
  updateDashboard(); renderTable();
  showToast(`${s.name} removed`,'warn');
  if (chartInited) { updateBarChart(); updateDoughnutChart(); }
}

function buildStudentObj(id) {
  const paid    = Number(document.getElementById('f-paid').value) || 0;
  const course  = document.getElementById('f-course').value;
  const balance = Math.max(0, (COURSE_FEES[course]||0) - paid);
  return {
    id:       id || document.getElementById('f-id').value.trim(),
    name:     document.getElementById('f-name').value.trim(),
    address:  document.getElementById('f-address').value.trim(),
    phone:    document.getElementById('f-phone').value.trim(),
    email:    document.getElementById('f-email').value.trim(),
    course,
    feesPaid: paid,
    balance,
    year:     document.getElementById('f-year').value,
    status:   document.getElementById('f-status').value,
    addedAt:  id ? students.find(s=>s.id===id)?.addedAt : Date.now(),
  };
}

// ── TABLE ─────────────────────────────────────
let filteredStudents = [];

function applyFilters() {
  const search = (document.getElementById('globalSearch')?.value||'').toLowerCase();
  const course = document.getElementById('flt-course')?.value || '';
  const status = document.getElementById('flt-status')?.value || '';
  const year   = document.getElementById('flt-year')?.value   || '';
  filteredStudents = students.filter(s => {
    const mc = !course || s.course  === course;
    const ms = !status || s.status  === status;
    const my = !year   || s.year    === year;
    const mq = !search || s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search) || s.email.toLowerCase().includes(search) || s.phone.includes(search) || s.course.toLowerCase().includes(search);
    return mc && ms && my && mq;
  });
  curPage = 1;
  renderTable(true);
}

function onGlobalSearch() {
  if (document.getElementById('page-students').classList.contains('active')) applyFilters();
}

function clearFilters() {
  ['flt-course','flt-status','flt-year','globalSearch'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  applyFilters();
}

function sortBy(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  document.querySelectorAll('.sort-ico').forEach(el => el.textContent = '↕');
  const ico = document.getElementById(`si-${col}`);
  if (ico) ico.textContent = sortAsc ? '↑' : '↓';
  renderTable(true);
}

function renderTable(useFiltered) {
  applyFilters();
  const data = filteredStudents.length || useFiltered ? filteredStudents : students.slice();
  data.sort((a,b) => {
    let va = a[sortCol]||'', vb = b[sortCol]||'';
    if (sortCol==='feesPaid'||sortCol==='balance') { va=Number(va); vb=Number(vb); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const total = data.length;
  const start = (curPage-1) * ITEMS_PER_PAGE;
  const paged = data.slice(start, start + ITEMS_PER_PAGE);
  const tbody = document.getElementById('studentTbody');
  const emptyTr = document.getElementById('emptyTr');
  const countTag = document.getElementById('countTag');
  const tpfInfo  = document.getElementById('tpfInfo');

  if (countTag) countTag.textContent = total;
  if (tpfInfo)  tpfInfo.textContent  = `Showing ${start+1}–${Math.min(start+ITEMS_PER_PAGE,total)} of ${total} students`;

  tbody.querySelectorAll('tr:not(#emptyTr)').forEach(r => r.remove());

  if (!total) {
    if (emptyTr) emptyTr.style.display = '';
    renderPagination(0,0);
    return;
  }
  if (emptyTr) emptyTr.style.display = 'none';

  paged.forEach(s => {
    const bal  = Number(s.balance)||0;
    const paid = Number(s.feesPaid)||0;
    const tr   = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-id">${xe(s.id)}</td>
      <td class="td-name">${xe(s.name)}</td>
      <td><span class="course-tag ct-${s.course}">${xe(s.course)}</span></td>
      <td class="td-mono">${xe(s.phone)}</td>
      <td class="td-email">${xe(s.email)}</td>
      <td class="td-mono">${xe(s.year||'—')}</td>
      <td><span class="status-tag st-${s.status||'Active'}"><span class="st-dot"></span>${xe(s.status||'Active')}</span></td>
      <td class="paid-cell">₹${fmt(paid)}</td>
      <td class="bal-cell ${bal===0?'zero':''}">₹${fmt(bal)}</td>
      <td>
        <div class="act-btns">
          <button class="ab ab-e" onclick="editStudent('${xe(s.id)}')" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="ab ab-d" onclick="deleteStudent('${xe(s.id)}')" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  renderPagination(total, Math.ceil(total/ITEMS_PER_PAGE));
}

function renderPagination(total, pages) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (pages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (curPage > 1) html += `<button class="pg-btn" onclick="changePage(${curPage-1})">‹</button>`;
  for (let i=1; i<=pages; i++) {
    html += `<button class="pg-btn ${i===curPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
  }
  if (curPage < pages) html += `<button class="pg-btn" onclick="changePage(${curPage+1})">›</button>`;
  el.innerHTML = html;
}

function changePage(p) { curPage = p; renderTable(true); }

function xe(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── EXPORT CSV ────────────────────────────────
function exportCSV() {
  const headers = ['ID','Name','Course','Phone','Email','Year','Status','Fees Paid','Balance'];
  const rows = students.map(s => [
    s.id, s.name, s.course, s.phone, s.email,
    s.year||'', s.status||'',
    s.feesPaid||0, s.balance||0
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:`EduTrack_Students_${new Date().toISOString().slice(0,10)}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('✓ CSV exported successfully','success');
}

// ── THEME ─────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  const ico = document.getElementById('themeIco');
  if (ico) ico.innerHTML = isLight
    ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
    : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  showToast(isLight ? '☀️ Light mode' : '🌙 Dark mode','info');
  if (chartInited) setTimeout(() => {
    [barChart, doughnutChart, courseCompareChart, yearChart, statusChart].forEach(c => { if(c) c.update(); });
  }, 350);
}

// ── LOGOUT ────────────────────────────────────
function doLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  sessionStorage.removeItem('et_session');
  localStorage.removeItem('et_session');
  showToast('Signing out…','info');
  setTimeout(() => window.location.href = 'login.html', 700);
}

// ── FUTURE MODAL ──────────────────────────────
function showFuture(name) {
  const descs = {
    'Attendance Tracker': 'Track daily attendance, view calendars, generate defaulter lists, and send automatic SMS alerts to parents. Coming in v2.1.',
    'PDF Reports': 'Generate professional fee receipts, progress reports, and bulk print with your institution letterhead. Coming in v2.1.',
    'AI Grade Predictor': 'A machine learning engine that identifies at-risk students early by analyzing attendance patterns, fee payment behavior, and historical data. Coming in v2.2.',
    'Notifications Center': 'Automated email and SMS reminders for fee due dates, exam schedules, and attendance alerts for students and parents. Coming in v2.2.',
    'Cloud Sync via Firebase': 'Real-time multi-device synchronization with role-based access for admins, faculty, and staff using Firebase. Coming in v3.0.',
  };
  document.getElementById('mbTitle').textContent = name;
  document.getElementById('mbDesc').textContent  = descs[name] || 'This feature is under active development and coming soon!';
  document.getElementById('futureModal').classList.add('open');
}
function closeFutureModal(e) {
  if (e.target === document.getElementById('futureModal')) document.getElementById('futureModal').classList.remove('open');
}

// ── CHATBOT ───────────────────────────────────
const BOT_KB = {
  'add student':     '<b>To add a student:</b><br>1. Go to Students page<br>2. Fill in all required fields<br>3. Select a course (fees auto-fill)<br>4. Enter fees paid (balance auto-calculates)<br>5. Click <b>Add Student</b> ✓',
  'update':          '<b>To update a student:</b><br>1. Find the student in the table<br>2. Click the ✏️ edit button<br>3. Modify any fields<br>4. Click <b>Update Student</b> ✓',
  'delete':          '<b>To delete a student:</b><br>1. Find the student in the table<br>2. Click the 🗑 delete button<br>3. Confirm in the dialog<br><br>⚠️ This cannot be undone!',
  'balance':         '<b>Balance Fees</b> = Total Course Fee − Fees Paid<br><br>It auto-calculates when you enter fees paid. Shown in the table in red (unless fully paid = green).',
  'export':          'Click the <b>⬇ download icon</b> in the top bar to export all student data as a CSV file. Works in Excel, Google Sheets, etc.',
  'course':          '<b>Available Courses:</b><br>• BCA — ₹45,000<br>• BBA — ₹40,000<br>• BCOM — ₹35,000<br><br>Fees auto-fill when you select a course in the form.',
  'dashboard':       'The Dashboard shows live KPIs: total students, total fees, collected amount, and balance due. Charts update in real-time as you add/edit students.',
  'analytics':       'The Analytics page has 3 charts: Course comparison, Enrollment by year, and Payment status breakdown. Plus a full summary panel.',
  'search':          'Use the <b>search bar</b> in the top center to search by name, ID, email, phone, or course. Filter by course/status/year using the dropdowns in the Students table.',
  'theme':           'Click the <b>☀️/🌙 icon</b> in the top bar to toggle between dark and light modes.',
  'logout':          'Click the <b>→ icon</b> next to your profile in the sidebar footer to sign out securely.',
  'coming soon':     'Upcoming features include:<br>• Attendance Tracker (v2.1)<br>• PDF Reports (v2.1)<br>• AI Grade Predictor (v2.2)<br>• Email/SMS Notifications (v2.2)<br>• PWA + Cloud Sync (v3.0)',
  'pagination':      'The student table shows 8 students per page. Use the pagination buttons at the bottom to navigate between pages.',
  'sort':            'Click any column header in the table to sort students by that column. Click again to reverse the sort order.',
  'hello':           '👋 Hello! I\'m EduBot, your EduTrack assistant. How can I help?',
  'help':            'I can help you with:<br>• Adding / editing / deleting students<br>• Understanding balance fees<br>• Using filters, search and sorting<br>• Exporting data<br>• Dashboard and analytics<br><br>Just ask me anything!',
};

function toggleChat() {
  const win = document.getElementById('chatWindow');
  const badge = document.getElementById('fabBadge');
  win.classList.toggle('open');
  if (win.classList.contains('open') && badge) badge.style.display = 'none';
}

function botQ(q) { addChatMsg(q, 'user'); setTimeout(() => { addChatMsg(findAnswer(q),'bot'); }, 350); }

function findAnswer(q) {
  const key = q.toLowerCase().replace(/[?!.,]/g,'').trim();
  for (const [k,v] of Object.entries(BOT_KB)) { if (key.includes(k) || k.split(' ').every(w => key.includes(w))) return v; }
  if (key.includes('add')||key.includes('new'))      return BOT_KB['add student'];
  if (key.includes('edit')||key.includes('update'))  return BOT_KB['update'];
  if (key.includes('delet')||key.includes('remov'))  return BOT_KB['delete'];
  if (key.includes('fee')||key.includes('bal'))      return BOT_KB['balance'];
  if (key.includes('csv')||key.includes('export'))   return BOT_KB['export'];
  if (key.includes('chart')||key.includes('analyt')) return BOT_KB['analytics'];
  if (key.includes('search')||key.includes('filter'))return BOT_KB['search'];
  if (key.includes('future')||key.includes('road'))  return BOT_KB['coming soon'];
  return "I'm not sure about that. Try asking about:<br>• How to add/update/delete students<br>• Balance fees calculation<br>• Exporting data<br>• Available courses<br>• Upcoming features";
}

function addChatMsg(msg, role) {
  const el = document.getElementById('cwMessages');
  if (!el) return;
  const chips = document.getElementById('cwChips');
  if (chips) chips.remove();
  const div = document.createElement('div');
  div.className = `cw-msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'cwm-bubble';
  bubble.innerHTML = msg;
  div.appendChild(bubble);
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function sendBot() {
  const inp = document.getElementById('cwInput');
  const msg = inp?.value.trim();
  if (!msg) return;
  inp.value = '';
  botQ(msg);
}

// ── TOAST ─────────────────────────────────────
let _tt = null;
function showToast(msg, type='success') {
  const t = document.getElementById('toast'); if(!t) return;
  t.textContent = msg; t.className = `toast ${type} show`;
  if(_tt) clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 3000);
}
