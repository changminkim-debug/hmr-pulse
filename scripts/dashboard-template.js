import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __tmplDir = path.dirname(fileURLToPath(import.meta.url));

function loadLogoB64() {
  const candidates = [
    'C:\\Users\\김창민\\Desktop\\한끼통살 로고2.png',
    path.join(__tmplDir, 'logo-b64.txt'),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p);
      // PNG 파일이면 base64로 변환, txt 파일이면 그대로 반환
      if (p.endsWith('.png') || p.endsWith('.jpg')) return raw.toString('base64');
      return raw.toString('utf8').trim();
    } catch { /* 다음 후보 시도 */ }
  }
  return '';
}

function loadClientParse() {
  const p = path.join(__tmplDir, 'client-parse.js');
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

export function buildDashboardHTML({ today, genTime, periodData, yearMonths, allPersons, allProducts, curYear, curMonth, personTeamMap, productTeamMap, apiKey = '' }) {
  const periodsJson = JSON.stringify(periodData);
  const yearMonthsJson = JSON.stringify(yearMonths);
  const personsJson = JSON.stringify(allPersons);
  const logoB64 = loadLogoB64();
  const clientParseCode = loadClientParse();
  const productsJson = JSON.stringify(allProducts);
  const personTeamJson = JSON.stringify(personTeamMap || {});
  const productTeamJson = JSON.stringify(productTeamMap || {});

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>한끼통살 · 메타 성과 대시보드</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f5f7fb;color:#222836;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;zoom:1.1}

/* ── Layout ── */
.sb{width:300px;background:#fff;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:30;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:#d0d6e4 transparent;border-right:1px solid #e8ecf4}
.sb::-webkit-scrollbar{width:4px}
.sb::-webkit-scrollbar-thumb{background:#d0d6e4;border-radius:2px}
.main-wrap{margin-left:300px;min-height:100vh;display:flex;flex-direction:column}

/* ── Sidebar internals ── */
.sb-top{padding:18px 16px 12px;border-bottom:1px solid #eef0f6}
.sb-logo{display:block;width:148px;margin:0 auto 6px;border-radius:4px}
.sb-title{font-size:20px;font-weight:900;color:#1a2030;letter-spacing:2px;text-transform:uppercase;text-align:center;line-height:1.2;margin-top:4px}
.sb-section{padding:10px 14px 8px}
.sb-section+.sb-section{border-top:1px solid #eef0f6}
.sb-label{font-size:10px;font-weight:700;color:#9aa0b4;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px}
.sb-pills{display:flex;flex-direction:column;gap:3px}
.sb-pill{width:100%;text-align:left;padding:7px 10px;background:transparent;border:none;border-radius:6px;color:#4a5578;font-size:13px;font-family:inherit;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-pill:hover{background:#f0f4ff;color:#4466cc}
.sb-pill.active{background:#4466cc;color:#fff;font-weight:600}
.sb-month-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}
.sb-pill-sm{padding:5px 4px;text-align:center;font-size:12px;border-radius:5px}
.sb-sel{width:100%;padding:7px 10px;background:#fff;border:1px solid #dde0ea;border-radius:6px;color:#333;font-size:13px;font-family:inherit;cursor:pointer;outline:none}
.sb-sel:focus{border-color:#4466cc}
.sb-sel option{background:#fff;color:#333}
.filter-list{display:flex;flex-direction:column;gap:0;margin:0 -4px}
/* ── 품목·담당자 2열 병렬 배치 ── */
.sb-dual{display:flex;border-top:1px solid #eef0f6;flex:1;min-height:0}
.sb-dual-col{flex:1;padding:10px 10px 8px;min-width:0;display:flex;flex-direction:column}
.sb-dual-col:first-child{flex:3}
.sb-dual-col:last-child{flex:2}
.sb-dual-col+.sb-dual-col{border-left:1px solid #eef0f6}
.sb-dual-col .sb-label{font-size:9px;letter-spacing:.6px;color:#9aa0b4;font-weight:700;text-transform:uppercase;margin-bottom:5px}
.sb-dual-col .filter-item{padding:4px 6px;font-size:12px;border-radius:4px;white-space:normal;word-break:keep-all;line-height:1.4}
.sb-dual-col .filter-item .fi-circle,.sb-dual-col .filter-item .fi-box{width:10px;height:10px;flex-shrink:0;margin-top:2px;align-self:flex-start}
/* 품목 선택 시 관련 없는 담당자 흐리게 */
.filter-item.dim{opacity:0.25}
.filter-item.dim-soft{opacity:0.45;color:#b0b8cc}
.filter-item{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;color:#5a6070;transition:all .1s;user-select:none;white-space:nowrap}
.filter-item:hover{background:#f4f6ff;color:#4466cc}
.filter-item.active{color:#4466cc;background:#eef2ff}
.filter-item .fi-box{width:12px;height:12px;border-radius:2px;border:1.5px solid #d0d5e4;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:8px;line-height:1;transition:all .1s}
.filter-item.active .fi-box{background:#4466cc;border-color:#4466cc;color:#fff}
.filter-item .fi-circle{width:12px;height:12px;border-radius:50%;border:1.5px solid #d0d5e4;flex-shrink:0;transition:all .1s}
.filter-item.active .fi-circle{border-color:#4466cc;background:radial-gradient(circle,#4466cc 40%,transparent 40%)}
.sb-team-row{display:flex;gap:4px}
.sb-team-btn{flex:1;padding:6px 4px;background:transparent;border:1px solid #dde0ea;border-radius:5px;color:#5a6070;font-size:12px;font-family:inherit;cursor:pointer;text-align:center;transition:all .12s}
.sb-team-btn:hover{border-color:#4466cc;color:#4466cc}
.sb-team-btn.active{border-color:#4466cc;background:#4466cc;color:#fff;font-weight:600}
.sb-bottom{padding:12px 14px;border-top:1px solid #eef0f6;font-size:11px;color:#9aa0b4;line-height:1.6;margin-top:auto}

/* ── Target ROAS input ── */
.roas-goal-row{display:flex;align-items:center;gap:6px;padding:9px 14px;border-bottom:1px solid #e8ecf4;background:#f4f7ff}
.roas-goal-lbl{font-size:10px;font-weight:700;color:#6070a0;letter-spacing:.8px;text-transform:uppercase;flex:1}
.roas-goal-input{width:54px;background:#fff;border:1.5px solid #dde0ea;border-radius:5px;color:#1a2030;font-size:14px;font-weight:700;font-family:inherit;padding:3px 6px;text-align:center;outline:none;transition:border-color .15s;-moz-appearance:textfield}
.roas-goal-input::-webkit-inner-spin-button,.roas-goal-input::-webkit-outer-spin-button{-webkit-appearance:none}
.roas-goal-input:focus{border-color:#4466cc}
.roas-goal-pct{font-size:13px;color:#6070a0;font-weight:700}

/* ── Header ── */
.hd{background:#fff;padding:13px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e4e8f0;position:sticky;top:0;z-index:20;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.hd-title{font-size:17px;font-weight:800;color:#1a2030;letter-spacing:-.2px}
.hd-right{display:flex;align-items:center;gap:16px}
.hd-date{font-size:13px;color:#5a6a8a}
.hd-gen{font-size:12px;color:#b4bece}

/* ── Period bar (floating card) ── */
.period-bar-wrap{position:sticky;top:57px;z-index:19;padding:12px 28px 4px;background:transparent}
.period-bar-card{background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06);overflow:hidden}
.period-bar{padding:12px 20px 12px 16px;display:flex;align-items:center;gap:0}
.pbar-left{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-shrink:0;padding-right:14px;margin-right:4px;border-right:1px solid #e0e4f0}
.pbar-left .fstatus-label{font-size:11px;font-weight:700;color:#8c9ab8;letter-spacing:.3px;white-space:nowrap}
.pbar-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;justify-content:center;padding-left:8px}
.pbar-sub{padding:10px 28px 14px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;border-top:1px solid #eef0f8;background:#f8f9fd}
/* Shortcut pills */
.pbar-btn{padding:9px 20px;border:1.5px solid #dde0ea;border-radius:22px;background:#fff;color:#5a6070;font-size:14px;font-family:inherit;cursor:pointer;font-weight:600;transition:all .15s;white-space:nowrap}
.pbar-btn-today{border-color:#16a34a;color:#16a34a}
.pbar-btn-today:hover{background:#f0fdf4;border-color:#16a34a}
.pbar-btn-today.active{background:#16a34a;border-color:#16a34a;color:#fff;box-shadow:0 2px 8px rgba(22,163,74,.3)}
.pbar-btn:hover{border-color:#4466cc;color:#4466cc;background:#f0f4ff}
.pbar-btn.active{background:#4466cc;border-color:#4466cc;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(68,102,204,.3)}
/* Divider */
.pbar-sep{width:1px;height:24px;background:#e0e4ee;margin:0 8px;flex-shrink:0}
/* Date nav box */
.pbar-datebox{display:flex;align-items:center;gap:5px;background:#f4f6fc;border:1.5px solid #e0e4f0;border-radius:10px;padding:6px 12px}
.pbar-datebox-label{font-size:12px;font-weight:700;color:#8c9ab8;letter-spacing:.5px;margin-right:4px;white-space:nowrap}
.pbar-ypill{padding:7px 16px;border:1.5px solid #dde0ea;border-radius:8px;background:#fff;color:#4a5578;font-size:14px;font-family:inherit;cursor:pointer;font-weight:600;transition:all .14s;white-space:nowrap}
.pbar-ypill:hover{border-color:#4466cc;color:#4466cc;background:#eef2ff}
.pbar-ypill.active{background:#4466cc;border-color:#4466cc;color:#fff;font-weight:700}
/* Month/Date pills in sub-row */
.pbar-sub .sb-pill{padding:7px 16px;border:1.5px solid #dde0ea;border-radius:8px;background:#fff;color:#4a5578;font-size:13px;font-family:inherit;cursor:pointer;font-weight:500;transition:all .13s;white-space:nowrap}
.pbar-sub .sb-pill:hover{border-color:#4466cc;color:#4466cc;background:#eef2ff}
.pbar-sub .sb-pill.active{background:#4466cc;border-color:#4466cc;color:#fff;font-weight:700}
/* Custom date range */
.pbar-date-row{display:flex;align-items:center;gap:6px}
.pbar-input{padding:8px 12px;border:1.5px solid #dde0ea;border-radius:9px;font-size:13px;font-family:inherit;color:#1a2030;outline:none;transition:border-color .15s;background:#fff}
.pbar-input:focus{border-color:#4466cc;box-shadow:0 0 0 3px rgba(68,102,204,.1)}
.pbar-apply{padding:8px 18px;background:#4466cc;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:background .15s;white-space:nowrap}
.pbar-apply:hover{background:#3355bb}
.pbar-active-badge{font-size:12px;color:#4466cc;font-weight:600;padding:5px 12px;background:#eef2ff;border-radius:12px;display:none}

/* ── Filter tags (inside pbar-left) ── */
.ftag{font-size:11px;padding:3px 9px;border-radius:12px;font-weight:600;white-space:nowrap}
.ftag-period{background:#dce8fc;color:#2a58b0}
.ftag-person{background:#e8f5e9;color:#2e7d32}
.ftag-product{background:#fff3e0;color:#e65100}
.ftag-team{background:#f3e5f5;color:#6a1b9a}

/* ── Page body ── */
.page-body{padding:20px 26px;display:flex;flex-direction:column;gap:16px;max-width:1500px;width:100%;margin:0 auto;flex:1}

/* ── KPI Cards ── */
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.cards-sub{grid-template-columns:repeat(5,1fr);margin-top:10px}
.card{background:#fff;border-radius:12px;padding:20px 20px;box-shadow:0 2px 8px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04);transition:box-shadow .18s,transform .18s;cursor:default;text-align:center;display:flex;flex-direction:column;justify-content:center;min-height:90px}
/* 메인 KPI 카드 */
#kpi-cards .card{background:#fff;justify-content:flex-start;min-height:90px;padding:16px 18px}
.cards-sub .card{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04);padding:14px 14px;min-height:66px}
.card:hover{box-shadow:0 6px 20px rgba(0,0,0,.1),0 0 0 1px rgba(68,102,204,.12);transform:translateY(-2px)}
.cl{font-size:12px;color:#8c96ae;letter-spacing:.3px;margin-bottom:8px;text-transform:uppercase;font-weight:600}
.cv{font-size:34px;font-weight:500;line-height:1.1;letter-spacing:-.5px;color:#1a2030}
.cv-roas{font-size:34px;font-weight:500;line-height:1.1;letter-spacing:-.5px}
.cv-unit{font-size:.42em;font-weight:400;color:#b0b8cc;margin-left:2px;letter-spacing:0;vertical-align:middle}
.cv-scale{font-size:.65em;font-weight:500;color:#1a2030;margin-left:1px;letter-spacing:0;vertical-align:middle}
.cv-roas.roas400,.cv-roas.roas300,.cv-roas.roas250,.cv-roas.roas200,.cv-roas.roas150,.cv-roas.roas100,.cv-roas.roas0{padding:0;border-radius:0;background:transparent;display:block}

/* ── Panels ── */
.panel{background:#fff;border-radius:12px;padding:20px 22px;box-shadow:0 2px 8px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)}
.sec-title{font-size:14px;font-weight:700;color:#1a2030;margin-bottom:14px;display:flex;align-items:center;gap:8px;padding-left:10px;border-left:3px solid #4466cc}
.hint{font-size:11px;color:#b0b8cc;font-weight:400}

/* ── Tables ── */
.tbl-wrap{overflow-x:auto}
.tbl-scroll{overflow:auto;max-height:650px;cursor:grab;user-select:none;border-radius:0 0 8px 8px}
.tbl-scroll.dragging{cursor:grabbing}
.tbl-scroll thead th{position:sticky;top:0;z-index:2;background:#f4f6fb}
.tbl-search{border:1.5px solid #dde0ea;border-radius:6px;padding:5px 12px;font-size:13px;color:#2c3347;outline:none;width:220px;font-family:inherit;margin-left:auto}
.tbl-search:focus{border-color:#4466cc;box-shadow:0 0 0 3px rgba(68,102,204,.1)}
table{width:100%;border-collapse:collapse}
thead tr{background:#f4f6fb}
th{padding:10px 12px;color:#4a5578;font-size:12px;font-weight:700;text-align:right;white-space:nowrap;border-bottom:2px solid #e0e4f0;letter-spacing:.2px}
th.left{text-align:left}
th.sortable{cursor:pointer;user-select:none}
th.sortable:hover{background:#e8eaf4;color:#2c3347}
th.sort-asc::after{content:" ▲";font-size:10px;opacity:.7}
th.sort-desc::after{content:" ▼";font-size:10px;opacity:.7}
td{padding:10px 12px;font-size:13px;text-align:right;border-bottom:1px solid #eef0f8;white-space:nowrap;color:#2c3347}
td.left{text-align:left}
td.name{font-weight:600;color:#1a2030;max-width:260px;overflow:hidden;text-overflow:ellipsis}
td.name.long{max-width:400px}
td.rank{color:#b4bece;font-size:12px;font-weight:600;width:32px}
tbody tr:nth-child(even) td{background:#f8f9fd}
tbody tr:hover td{background:#edf2ff!important;transition:background .1s}
#t-ad th,#t-ad td{padding-left:7px;padding-right:7px}
#t-ad td:nth-child(2){font-size:12px;white-space:nowrap}
#t-ad th:nth-child(3),#t-ad td:nth-child(3){width:58px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#t-ad th:nth-child(n+4),#t-ad td:nth-child(n+4){width:70px}
#t-campaign th,#t-campaign td{padding-left:8px;padding-right:8px}

/* ── ROAS colors ── */
.roas400{color:#146028;font-weight:700;background:#d6f0df;padding:3px 9px;border-radius:6px;display:inline-block}
.roas300{color:#1a6e32;font-weight:700;background:#dff5e6;padding:3px 9px;border-radius:6px;display:inline-block}
.roas250{color:#2a7e44;font-weight:700;background:#e8f7ee;padding:3px 9px;border-radius:6px;display:inline-block}
.roas200{color:#b02020;font-weight:700;background:#fde8e8;padding:3px 9px;border-radius:6px;display:inline-block}
.roas150{color:#8c1818;font-weight:700;background:#fddede;padding:3px 9px;border-radius:6px;display:inline-block}
.roas100{color:#6e1212;font-weight:700;background:#fcd4d4;padding:3px 9px;border-radius:6px;display:inline-block}
.roas0{color:#550e0e;font-weight:700;background:#fac8c8;padding:3px 9px;border-radius:6px;display:inline-block}
.cv-roas.roas400,.cv-roas.roas300,.cv-roas.roas250,.cv-roas.roas200,.cv-roas.roas150,.cv-roas.roas100,.cv-roas.roas0{padding:10px 22px;border-radius:10px}

/* ── Delta badges ── */
.rd{font-size:12px;font-weight:600}
.rd.up{color:#2a58b0}.rd.dn{color:#c03030}.rd.flat{color:#b4bece}
/* ── KPI delta ── */
.kpi-delta-row{margin-top:8px;text-align:center}
.kpi-delta{font-size:12px;font-weight:700;padding:2px 9px;border-radius:10px;display:inline-block}
.kpi-delta.up{color:#146028;background:#d6f0df}
.kpi-delta.dn{color:#b02020;background:#fde8e8}
.kpi-delta.flat{color:#8c96ae;background:#f0f2f7}

/* ── Team chip ── */
.chip{font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;display:inline-block}
.chip-1{background:#dce8fc;color:#2a58b0}.chip-2{background:#fce4e8;color:#c0304a}.chip-m{background:#eef0f6;color:#5a6a8a}

/* ── Share bar ── */
.bar-wrap{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.bar-bg{width:56px;height:6px;background:#eceef5;border-radius:3px;overflow:hidden}
.bar-fill{height:100%;background:#4466cc;border-radius:3px;transition:width .3s}

/* ── Chart ── */
.chart-wrap{position:relative;height:240px}

/* ── Footer ── */
.ft{text-align:center;padding:10px 24px 20px;font-size:11px;color:#b0b8cc}

/* ── Responsive ── */
@media(max-width:1024px){
  .sb{width:260px}.main-wrap{margin-left:260px}
  .cards{grid-template-columns:repeat(2,1fr)}
  .cards-sub{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:700px){
  .sb{display:none}.main-wrap{margin-left:0}
  .page-body{padding:12px 12px}
  .period-bar-wrap{top:54px;padding:10px 16px 4px}
}

/* ── Campaign → Creative expand ── */
.camp-toggle{background:none;border:none;cursor:pointer;color:#b0b8cc;font-size:12px;padding:3px 6px;border-radius:4px;transition:all .15s;line-height:1;font-weight:700}
.camp-toggle:hover{color:#4466cc;background:#eef1ff}
.camp-toggle.open{color:#fff;background:#4466cc}
tr.camp-expanded td{background:#dce5ff !important;font-weight:600}
tr.camp-expanded:hover td{background:#cfd9ff !important}
.camp-sub-row td{background:#f0f4ff;font-size:12px;border-top:none !important}
.camp-sub-row td:first-child{border-left:3px solid #4466cc}
.camp-sub-row:last-of-type td{border-bottom:2px solid #4466cc}
.camp-sub-row:hover td{background:#e4eaff}
.camp-sub-row .sub-name{color:#3a4560;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle}
.camp-sub-row .sub-person{font-size:11px;color:#8c96ae;margin-left:6px}
.tgt-hint{font-size:11px;color:#8090b0;margin-top:2px;white-space:nowrap}
.tgt-hint b{color:#3a4560;font-weight:700}
tfoot{position:sticky;bottom:0;z-index:3;clip-path:inset(0 0 0 0 round 0 0 8px 8px)}
tfoot tr td{background:#e8eeff!important;color:#1a2030;font-weight:700;font-size:13px;border-top:2px solid #4466cc!important}
tfoot tr td:first-child{color:#5a6a8a;font-size:12px}

/* ── AI Chat ── */
#ai-btn{position:fixed;bottom:24px;right:24px;width:50px;height:50px;border-radius:50%;background:#4466cc;color:#fff;font-size:20px;border:none;cursor:pointer;box-shadow:0 4px 18px rgba(68,102,204,.5);z-index:400;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s;line-height:1}
#ai-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(68,102,204,.6)}
#ai-panel{position:fixed;bottom:86px;right:24px;width:340px;height:520px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.2);z-index:400;display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(0,0,0,.06)}
#ai-panel.open{display:flex}
#ai-ph{background:#4466cc;color:#fff;padding:13px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.ai-ph-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:7px;letter-spacing:.2px}
.ai-ph-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;cursor:pointer;line-height:1;padding:0 2px}
.ai-ph-close:hover{color:#fff}
#ai-ctx{font-size:11px;color:#8c96ae;padding:7px 14px;background:#f7f8fc;border-bottom:1px solid #eee;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ai-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.ai-msg{max-width:90%;padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:keep-all}
.ai-msg.user{background:#4466cc;color:#fff;align-self:flex-end;border-radius:10px 10px 2px 10px}
.ai-msg.ai{background:#f0f2f7;color:#1a2030;align-self:flex-start;border-radius:10px 10px 10px 2px}
.ai-msg.ai.loading::after{content:'';display:inline-block;width:12px;animation:ai-dot 1s infinite}
@keyframes ai-dot{0%{content:''}33%{content:' ·'}66%{content:' ··'}100%{content:' ···'}}
#ai-input-row{padding:10px;border-top:1px solid #eee;display:flex;gap:8px;flex-shrink:0}
#ai-input{flex:1;border:1.5px solid #dce0ea;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s}
#ai-input:focus{border-color:#4466cc}
#ai-send{background:#4466cc;color:#fff;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font-size:13px;font-weight:600;transition:background .15s;white-space:nowrap}
#ai-send:hover{background:#3355bb}
#ai-send:disabled{background:#c0c6d4;cursor:not-allowed}
/* ── Password overlay ── */
#pw-overlay{position:fixed;inset:0;background:rgba(245,247,251,.97);display:flex;align-items:center;justify-content:center;z-index:99999}
#pw-box{background:#fff;border:1px solid #e0e4f0;border-radius:16px;padding:48px 40px;display:flex;flex-direction:column;align-items:center;gap:20px;min-width:320px;box-shadow:0 8px 40px rgba(0,0,0,.12)}
#pw-logo{font-size:28px;font-weight:800;color:#1a2030;letter-spacing:1px}
#pw-sub{font-size:13px;color:#8c96ae;margin-top:-10px}
#pw-input{width:100%;padding:12px 16px;border-radius:8px;border:1.5px solid #dde0ea;background:#fff;color:#1a2030;font-size:15px;outline:none;text-align:center;letter-spacing:3px;box-sizing:border-box}
#pw-input:focus{border-color:#4466cc}
#pw-btn{width:100%;padding:12px;border-radius:8px;background:#4466cc;color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer}
#pw-btn:hover{background:#3355bb}
#pw-err{font-size:12px;color:#e05555;height:16px}
/* ── Monthly Target Modal ── */
.tgt-wrap{display:none;position:fixed;inset:0;z-index:300}
.tgt-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45)}
.tgt-modal{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(760px,94vw);max-height:85vh;overflow-y:auto;background:#fff;border-radius:16px;padding:28px 32px;box-shadow:0 24px 64px rgba(0,0,0,.22)}
.tgt-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
.tgt-table th{background:#f4f6fb;padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:#8c96ae;letter-spacing:.4px;border-bottom:2px solid #e0e4f0}
.tgt-table th:first-child{text-align:left}
.tgt-table td{padding:7px 8px;border-bottom:1px solid #f0f2f7;vertical-align:middle}
.tgt-table td:first-child{font-weight:600;color:#1a2030;font-size:13px;white-space:nowrap}
.tgt-input{width:100%;padding:6px 8px;border:1.5px solid #dde0ea;border-radius:7px;font-size:13px;font-family:inherit;color:#1a2030;outline:none;text-align:right;box-sizing:border-box}
.tgt-input:focus{border-color:#4466cc;box-shadow:0 0 0 3px rgba(68,102,204,.1)}
/* Target mode KPI cards */
.ctt-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:7px}
.ctt-goal{font-size:10px;color:#9aa0b4;font-weight:500}
.ctt-pct{font-size:11px;font-weight:800;letter-spacing:-.1px}
.ctt-pct.ok{color:#2e7d32}
.ctt-pct.warn{color:#f5a623}
.ctt-pct.over{color:#c62828}
.ctt-bar{display:block;width:100%;height:4px;background:#e2e4ea;border-radius:3px;margin-top:5px;overflow:hidden}
.ctt-bar-fill{height:100%;max-width:100%;border-radius:3px;transition:width .35s}
.ctt-bar-fill.ok{background:#4caf50}
.ctt-bar-fill.warn{background:#f5a623}
.ctt-bar-fill.over{background:#ef5350}
/* ── Product Bar Chart ── */
.pb-row{display:flex;align-items:center;gap:14px;padding:8px 0;border-bottom:1px solid #f0f2f8}
.pb-row:last-child{border-bottom:none}
.pb-name{min-width:140px;font-size:13px;font-weight:600;color:#1a2030;text-align:right;flex-shrink:0;line-height:1.3}
.pb-code{font-size:10px;color:#4466cc;font-weight:700;margin-left:4px;letter-spacing:.5px;opacity:.8}
.pb-bar-wrap{flex:1;min-width:0}
.pb-bar-inner{display:flex;border-radius:6px;overflow:hidden;height:34px}
.pb-spend-seg{display:flex;align-items:center;justify-content:center;background:#d5d9e8;color:#4a5578;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;padding:0 8px;flex-shrink:0}
.pb-val-seg{display:flex;align-items:center;justify-content:center;background:#3a5ca8;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;padding:0 8px;flex:1}
.pb-roas-badge{min-width:58px;text-align:center;font-size:13px;font-weight:800;padding:6px 10px;border-radius:8px;color:#fff;flex-shrink:0;letter-spacing:.2px}
.pb-roas-badge.roas400{background:#1565c0}
.pb-roas-badge.roas300{background:#1976d2}
.pb-roas-badge.roas250{background:#2196f3}
.pb-roas-badge.roas200{background:#388e3c}
.pb-roas-badge.roas150{background:#f57c00}
.pb-roas-badge.roas100{background:#e64a19}
.pb-roas-badge.roas0{background:#c62828}
.pb-toggle{background:none;border:1px solid #dde0ea;border-radius:6px;padding:3px 8px;font-size:11px;color:#8c96ae;cursor:pointer;flex-shrink:0;transition:all .13s}
.pb-toggle:hover{border-color:#4466cc;color:#4466cc}
.pb-date-rows{padding:4px 0 4px 154px}
.pb-total{display:flex;align-items:center;gap:14px;padding:10px 0 2px;border-top:2px solid #e8eaf0;margin-top:6px}
.pb-total-name{min-width:140px;text-align:right;font-size:12px;font-weight:700;color:#8c96ae;flex-shrink:0}
.tgt-sum-row td{background:#f8f9fd}
.tgt-sum-cell{text-align:right;font-size:12px;font-weight:700;color:#4a5578;padding:6px 10px}
.kpi-tgt-badge{font-size:11px;font-weight:700;color:#4466cc;background:#eef2ff;padding:2px 9px;border-radius:10px;cursor:pointer;margin-left:4px}
.kpi-tgt-badge:hover{background:#dce8fc}
/* ── Pivot Panel ── */
#pivot-overlay{position:fixed;inset:0;z-index:200;background:#f5f7fb;display:none;flex-direction:column;overflow:hidden}
.pvt-header{display:flex;align-items:center;gap:10px;padding:13px 22px 11px;background:#fff;border-bottom:1px solid #e8ecf4;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.06)}
.pvt-header-title{font-size:16px;font-weight:800;color:#1a2030;flex:1;letter-spacing:-.2px}
.pvt-back{background:none;border:1px solid #dde0ea;border-radius:8px;padding:6px 13px;cursor:pointer;font-size:13px;font-family:inherit;color:#4a5578;font-weight:600}
.pvt-back:hover{background:#f0f4ff;border-color:#4466cc;color:#4466cc}
.pvt-builder{display:flex;gap:0;border-bottom:2px solid #e8ecf4;background:#fff;flex-shrink:0;overflow-x:auto;scrollbar-width:thin}
.pvt-sec{padding:12px 16px;border-right:1px solid #eef0f6;flex-shrink:0}
.pvt-sec-lbl{font-size:10px;font-weight:700;color:#9aa0b4;text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px}
.pvt-chips{display:flex;flex-wrap:wrap;gap:4px}
.pvt-chip{padding:5px 10px;border:1.5px solid #dde0ea;border-radius:16px;font-size:12px;font-family:inherit;cursor:pointer;background:#fff;color:#4a5578;font-weight:600;transition:all .12s;white-space:nowrap}
.pvt-chip:hover{border-color:#4466cc;color:#4466cc;background:#f0f4ff}
.pvt-chip.sel{background:#4466cc;border-color:#4466cc;color:#fff}
.pvt-radio-col{display:flex;flex-direction:column;gap:5px}
.pvt-radio{display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:#4a5578}
.pvt-radio input{accent-color:#4466cc;cursor:pointer}
.pvt-fsel{padding:5px 9px;border:1px solid #dde0ea;border-radius:6px;font-size:12px;font-family:inherit;cursor:pointer;color:#333;background:#fff;outline:none;width:100%}
.pvt-fsel:focus{border-color:#4466cc}
.pvt-body{flex:1;overflow:auto;padding:18px 24px;background:#f5f7fb}
.pvt-tbl-wrap{overflow:auto;border-radius:10px;border:1px solid #e8ecf4;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.pvt-tbl{border-collapse:collapse;font-size:13px;min-width:100%}
.pvt-tbl thead tr:first-child th{background:#eef2ff;padding:7px 12px;text-align:center;font-weight:700;color:#4466cc;font-size:11px;border-bottom:1px solid #dde8ff;white-space:nowrap;letter-spacing:.3px;position:sticky;top:0;z-index:3}
.pvt-tbl thead tr:last-child th{background:#f8f9fe;padding:7px 12px;text-align:right;font-weight:700;color:#4a5578;font-size:12px;border-bottom:2px solid #e8ecf4;cursor:pointer;white-space:nowrap;position:sticky;top:33px;z-index:2}
.pvt-tbl thead tr:first-child th.row-h,.pvt-tbl thead tr:last-child th.row-h{text-align:left;position:sticky;left:0;z-index:4;background:#eef2ff}
.pvt-tbl thead tr:last-child th.row-h{background:#f8f9fe;top:33px;z-index:4}
.pvt-tbl thead th:hover:not(.row-h){background:#e4eaff;color:#4466cc}
.pvt-tbl thead th.srt-d::after{content:' ↓'}
.pvt-tbl thead th.srt-a::after{content:' ↑'}
.pvt-tbl td{padding:7px 12px;text-align:right;border-bottom:1px solid #f0f2f8;vertical-align:middle;white-space:nowrap}
.pvt-tbl td.row-cell{text-align:left;font-size:12px;color:#333;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;position:sticky;left:0;background:#fff;z-index:1;cursor:pointer}
.pvt-tbl td.row-cell:hover{color:#4466cc;text-decoration:underline}
.pvt-tbl tr:hover td{background:#fafbff}
.pvt-tbl tr:hover td.row-cell{background:#fafbff}
.pvt-tbl tfoot td{font-weight:700;color:#222836;background:#f0f4ff;border-top:2px solid #c8d4f8}
.pvt-tbl tfoot td.row-cell{background:#f0f4ff;font-weight:700;color:#4466cc}
.pvt-empty{text-align:center;padding:60px 20px;color:#9aa0b4;font-size:14px}
.pvt-act-btn{border-radius:8px;padding:7px 16px;font-size:13px;font-family:inherit;cursor:pointer;font-weight:700;transition:all .15s;border:none}
.pvt-run{background:#4466cc;color:#fff}
.pvt-run:hover{background:#3355bb}
.pvt-csv{background:#fff;color:#4a5578;border:1px solid #dde0ea}
.pvt-csv:hover{background:#f0f4ff;border-color:#4466cc;color:#4466cc}
.pbar-pivot-btn{background:linear-gradient(135deg,#6366f1,#4466cc);color:#fff;border-color:transparent;font-size:13px;padding:7px 14px}
.pbar-pivot-btn:hover{opacity:.88}
.pvt-period-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pvt-ab{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;font-size:11px;font-weight:800;flex-shrink:0}
.pvt-a{background:#4466cc;color:#fff}
.pvt-b{background:#e67e22;color:#fff}
.pvt-m-item{display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:#f8f9fe;border-radius:6px;font-size:12px;margin-bottom:3px;color:#4a5578;border:1px solid #eef0f6}
.pvt-m-nm{flex:1;font-weight:600}
.pvt-m-ctrl{display:flex;gap:2px}
.pvt-m-btn{background:none;border:1px solid #dde0ea;cursor:pointer;color:#9aa0b4;font-size:12px;padding:1px 5px;border-radius:3px;line-height:1.4;font-family:inherit}
.pvt-m-btn:hover:not(:disabled){background:#e8ecf8;color:#4466cc;border-color:#b0bfe8}
.pvt-m-btn:disabled{opacity:.35;cursor:not-allowed}
.pvt-m-del:hover:not(:disabled){background:#ffe4e6;color:#ef4444;border-color:#fca5a5}
.pvt-dim-lbl{font-size:11px;font-weight:700;color:#b0b9d4;width:16px;text-align:center;flex-shrink:0}
.pvt-cdt{width:105px!important;font-size:11px}
</style>
</head>
<body>

<!-- ── Password Gate ── -->
<div id="pw-overlay">
  <div id="pw-box">
    <div id="pw-logo">HMR 매체 대시보드</div>
    <div id="pw-sub">접근 비밀번호를 입력하세요</div>
    <input id="pw-input" type="password" placeholder="비밀번호" onkeydown="if(event.key==='Enter')checkPw()">
    <div id="pw-err"></div>
    <button id="pw-btn" onclick="checkPw()">확인</button>
  </div>
</div>
<script>
(function(){
  const PW = 'hmr1234';
  if (sessionStorage.getItem('hmr_auth') === '1') { document.getElementById('pw-overlay').style.display='none'; return; }
  function checkPw() {
    const v = document.getElementById('pw-input').value;
    if (v === PW) {
      sessionStorage.setItem('hmr_auth','1');
      document.getElementById('pw-overlay').style.display='none';
    } else {
      const err = document.getElementById('pw-err');
      err.textContent = '비밀번호가 틀렸습니다';
      document.getElementById('pw-input').value='';
      document.getElementById('pw-input').focus();
      setTimeout(()=>{ err.textContent=''; },2000);
    }
  }
  window.checkPw = checkPw;
  document.getElementById('pw-input').focus();
})();
</script>

<!-- ── Main Dashboard ── -->
<div id="main">

<!-- ── Sidebar ── -->
<div class="sb">
  <div class="sb-top">
    ${logoB64 ? '<img class="sb-logo" src="data:image/png;base64,' + logoB64 + '" alt="한끼통살">' : '<span style="font-size:13px;font-weight:700;color:#1a2030;letter-spacing:.5px">한끼통살</span>'}
  </div>

  <!-- 목표 ROAS -->
  <div class="roas-goal-row">
    <span class="roas-goal-lbl">목표 ROAS</span>
    <input class="roas-goal-input" id="roas-goal-input" type="number" min="0" max="9999" value="250"
      oninput="setTargetRoas(this.value)" onchange="setTargetRoas(this.value)">
    <span class="roas-goal-pct">%</span>
  </div>

  <!-- 팀 -->
  <div class="sb-section">
    <div class="sb-label">팀</div>
    <div class="sb-team-row">
      <button class="sb-team-btn active" onclick="setTeam('')">전체</button>
      <button class="sb-team-btn" onclick="setTeam('1팀')">1팀</button>
      <button class="sb-team-btn" onclick="setTeam('2팀')">2팀</button>
    </div>
  </div>

  <!-- 품목 · 담당자 (2열 병렬) -->
  <div class="sb-dual">
    <div class="sb-dual-col">
      <div class="sb-label">품목</div>
      <div class="filter-list" id="prod-list"></div>
    </div>
    <div class="sb-dual-col">
      <div class="sb-label">담당자</div>
      <div class="filter-list" id="person-list"></div>
    </div>
  </div>

  <div class="sb-bottom">
    기준: ${today}<br>갱신: ${genTime}<br>C7 클릭 귀속 기준
  </div>
</div>

<!-- ── Main Content ── -->
<div class="main-wrap">

  <!-- Header -->
  <div class="hd">
    <div class="hd-title">한끼통살 메타 광고 운영 대시보드</div>
    <div class="hd-right">
      <span class="hd-date">${today}</span>
      <span class="hd-gen">갱신: ${genTime}</span>
    </div>
  </div>

  <!-- ── 기간 바 ── -->
  <div class="period-bar-wrap">
  <div class="period-bar-card">
    <!-- Row 1: 필터상태(좌) + 바로가기 + 연도박스 + 직접입력(중앙) -->
    <div class="period-bar">
      <div class="pbar-left">
        <span class="fstatus-label">기간</span>
        <span class="ftag ftag-period" id="ft-period">이번달</span>
        <span id="ft-person" style="display:none"></span>
        <span id="ft-product" style="display:none"></span>
        <span id="ft-team" style="display:none"></span>
      </div>
      <div class="pbar-controls">
        <button class="pbar-btn pbar-btn-today" id="pb-today" onclick="setToday()">오늘 <span style="font-size:10px;opacity:.7">1팀</span></button>
        <button class="pbar-btn" id="pb-yesterday" onclick="setShortcut('yesterday')">어제</button>
        <button class="pbar-btn active" id="pb-thisMonth" onclick="setShortcut('thisMonth')">이번달</button>
        <button class="pbar-btn" id="pb-lastMonth" onclick="setShortcut('lastMonth')">지난달</button>
        <button class="pbar-btn" id="pb-last30d" onclick="setShortcut('last30d')">최근 30일</button>
        <button class="pbar-btn" id="pb-last7d" onclick="setShortcut('last7d')">최근 7일</button>
        <button class="pbar-btn" id="pb-all" onclick="setShortcut('all')">전체</button>
        <button class="pbar-btn pbar-pivot-btn" onclick="openPivot()" title="피벗 분석 — 기간×소재 자유 비교">📊 피벗 분석</button>
        <div class="pbar-sep"></div>
        <div class="pbar-datebox" id="year-box">
          <span class="pbar-datebox-label">연도</span>
          <div id="year-pills" style="display:flex;gap:4px"></div>
        </div>
        <div id="month-pills-inline" style="display:none;align-items:center;gap:4px;flex-wrap:nowrap;margin-left:4px"></div>
        <div class="pbar-sep"></div>
        <div class="pbar-date-row">
          <input type="date" id="cr-start" class="pbar-input">
          <span style="color:#9aa0b4;font-size:13px">~</span>
          <input type="date" id="cr-end" class="pbar-input">
          <button class="pbar-apply" onclick="applyCustomRange()">적용</button>
        </div>
        <div class="pbar-active-badge" id="cr-badge"></div>
      </div>
    </div>
  </div>
  </div>

  <div class="page-body">

    <!-- ① KPI -->
    <div id="s-kpi" style="scroll-margin-top:120px">
      <div class="sec-title" style="margin-bottom:12px">KPI <span class="hint pdate"></span><span class="kpi-tgt-badge" onclick="openTgtModal()" title="품목별 월간 목표 설정">목표 설정</span></div>
      <div class="cards" id="kpi-cards"></div>
      <div class="cards cards-sub" id="kpi-cards-sub"></div>
    </div>

    <!-- ② 품목별 -->
    <!-- 오늘 시간대별 패널 (todayMode 시에만 표시) -->
    <div id="s-today-hourly" class="panel" style="display:none;scroll-margin-top:120px">
      <div class="sec-title">시간대별 성과 <span class="hint" id="today-updated"></span></div>
      <div class="tbl-wrap"><table id="t-today-hourly">
        <thead><tr>
          <th class="left" style="width:60px">시간대</th>
          <th>비용</th><th>전환수</th><th>전환가치</th><th>ROAS</th>
        </tr></thead>
        <tbody id="b-today-hourly"></tbody>
        <tfoot id="f-today-hourly"></tfoot>
      </table></div>
    </div>

    <div id="s-product" class="panel" style="scroll-margin-top:120px">
      <div class="sec-title">품목별 성과 <span class="hint pdate"></span></div>
      <div class="tbl-wrap"><table id="t-product">
        <thead><tr>
          <th class="left" style="width:32px">#</th>
          <th class="left sortable" data-col="name">품목</th>
          <th class="sortable sort-desc" data-col="spend">비용</th>
          <th class="sortable" data-col="purchases">전환수</th>
          <th class="sortable" data-col="val">전환가치</th>
          <th class="sortable" data-col="roas">ROAS</th>
          <th class="sortable" data-col="share">비중</th>
          <th style="width:36px">일자</th>
        </tr></thead>
        <tbody id="b-product"></tbody>
        <tfoot id="f-product"></tfoot>
      </table></div>
    </div>

    <!-- ④ 캠페인별 -->
    <div id="s-campaign" class="panel" style="scroll-margin-top:120px">
      <div class="sec-title" style="justify-content:space-between">
        <span>캠페인별 성과 <span class="hint" id="camp-hint"></span><span class="hint pdate"></span><span class="hint" style="margin-left:6px">· 행 클릭 시 일자별 성과</span></span>
        <input class="tbl-search" id="camp-search" type="text" placeholder="🔍 캠페인 검색">
      </div>
      <div class="tbl-scroll" id="scroll-campaign"><table id="t-campaign">
        <thead><tr>
          <th class="left" style="width:28px">#</th>
          <th class="left sortable" data-col="name">캠페인명</th>
          <th class="sortable sort-desc" data-col="spend">비용</th>
          <th class="sortable" data-col="purchases">전환수</th>
          <th class="sortable" data-col="val">전환가치</th>
          <th class="sortable" data-col="roas">ROAS</th>
          <th class="sortable" data-col="ctr">CTR</th>
          <th class="sortable" data-col="cvr">CVR</th>
          <th class="sortable" data-col="cpa">CPA</th>
          <th style="width:36px">소재</th>
        </tr></thead>
        <tbody id="b-campaign"></tbody>
        <tfoot id="f-campaign"></tfoot>
      </table></div>
    </div>

    <!-- ⑤ 소재별 -->
    <div id="s-ad" class="panel" style="scroll-margin-top:120px">
      <div class="sec-title" style="justify-content:space-between">
        <span>소재별 성과 <span class="hint" id="ad-hint"></span><span class="hint pdate"></span><span class="hint" style="margin-left:6px">· 행 클릭 시 일자별 성과</span></span>
        <input class="tbl-search" id="ad-search" type="text" placeholder="🔍 소재 검색">
      </div>
      <div class="tbl-scroll" id="scroll-ad"><table id="t-ad">
        <thead><tr>
          <th class="left" style="width:28px">#</th>
          <th class="left sortable" data-col="name">소재명</th>
          <th class="left sortable" data-col="person">담당자</th>
          <th class="sortable sort-desc" data-col="spend">비용</th>
          <th class="sortable" data-col="purchases">전환수</th>
          <th class="sortable" data-col="val">전환가치</th>
          <th class="sortable" data-col="roas">ROAS</th>
          <th class="sortable" data-col="ctr">CTR</th>
          <th class="sortable" data-col="cvr">CVR</th>
          <th class="sortable" data-col="cpa">CPA</th>
        </tr></thead>
        <tbody id="b-ad"></tbody>
        <tfoot id="f-ad"></tfoot>
      </table></div>
    </div>

    <!-- ⑥ 담당자별 -->
    <div id="s-person" class="panel" style="scroll-margin-top:120px">
      <div class="sec-title">담당자별 성과 <span class="hint pdate"></span></div>
      <div class="tbl-wrap"><table id="t-person">
        <thead><tr>
          <th class="left" style="width:32px">#</th>
          <th class="left sortable" data-col="name">담당자</th>
          <th class="left sortable" data-col="team">팀</th>
          <th class="sortable sort-desc" data-col="spend">비용</th>
          <th class="sortable" data-col="purchases">전환수</th>
          <th class="sortable" data-col="val">전환가치</th>
          <th class="sortable" data-col="roas">ROAS</th>
          <th class="sortable" data-col="share">비중</th>
        </tr></thead>
        <tbody id="b-person"></tbody>
        <tfoot id="f-person"></tfoot>
      </table></div>
    </div>

  </div><!-- .page-body -->
  <div class="ft">⚠ 전환수 C7 (7일 클릭 귀속) · 전환가치·ROAS는 C1 (1일 클릭 귀속) · 최근 3일은 잠정치 · Egnis Ads</div>
</div><!-- .main-wrap -->
</div><!-- #main -->

<!-- ── 드릴다운 모달 ── -->
<div id="dd-overlay" onclick="closeDrilldown()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200"></div>
<div id="dd-modal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(860px,92vw);max-height:82vh;overflow-y:auto;background:#fff;border-radius:16px;padding:28px 30px;z-index:201;box-shadow:0 24px 64px rgba(0,0,0,.22)">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div>
      <div id="dd-type" style="font-size:11px;font-weight:700;color:#4466cc;letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px"></div>
      <div id="dd-title" style="font-size:15px;font-weight:700;color:#1a2030;line-height:1.4;max-width:680px"></div>
      <div id="dd-sub" style="font-size:12px;color:#8c96ae;margin-top:4px"></div>
    </div>
    <button onclick="closeDrilldown()" style="background:#f4f6fb;border:none;border-radius:8px;font-size:16px;cursor:pointer;color:#5a6a8a;padding:6px 12px;margin-left:12px;flex-shrink:0">✕ 닫기</button>
  </div>
  <div style="margin-bottom:20px"><canvas id="dd-chart" height="110"></canvas></div>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr id="dd-thead" style="background:#f4f6fb"></tr></thead>
    <tbody id="dd-tbody"></tbody>
  </table>
</div>

<!-- ── 월간 목표 설정 모달 ── -->
<div class="tgt-wrap" id="tgt-wrap">
  <div class="tgt-overlay" onclick="closeTgtModal()"></div>
  <div class="tgt-modal">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div>
        <div style="font-size:11px;font-weight:700;color:#4466cc;letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px">MONTHLY TARGETS</div>
        <div id="tgt-title" style="font-size:17px;font-weight:700;color:#1a2030"></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button onclick="tgtPrevMonth()" style="background:#f4f6fb;border:none;border-radius:8px;font-size:15px;cursor:pointer;color:#5a6a8a;padding:6px 12px">◀</button>
        <span id="tgt-month-label" style="font-size:13px;font-weight:700;color:#4a5578;min-width:80px;text-align:center"></span>
        <button onclick="tgtNextMonth()" style="background:#f4f6fb;border:none;border-radius:8px;font-size:15px;cursor:pointer;color:#5a6a8a;padding:6px 12px">▶</button>
        <button onclick="closeTgtModal()" style="background:#f4f6fb;border:none;border-radius:8px;font-size:14px;cursor:pointer;color:#5a6a8a;padding:6px 12px;margin-left:4px">✕</button>
      </div>
    </div>
    <div style="font-size:12px;color:#9aa0b4;margin-bottom:12px">단위: 원 (예산·전환가치) · % (ROAS). 빈칸은 해당 항목 비교 안 함.</div>
    <table class="tgt-table">
      <thead><tr>
        <th style="width:130px">품목</th>
        <th>목표 예산<br><small style="font-weight:400">(원)</small></th>

        <th>목표 전환가치<br><small style="font-weight:400">(원)</small></th>
        <th>목표 ROAS<br><small style="font-weight:400">(%)</small></th>
      </tr></thead>
      <tbody id="tgt-tbody"></tbody>
    </table>
    <div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end">
      <button onclick="closeTgtModal()" style="padding:10px 20px;border:1.5px solid #dde0ea;border-radius:9px;background:#fff;color:#5a6a8a;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer">취소</button>
      <button onclick="saveTgtModal()" style="padding:10px 24px;background:#4466cc;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer">저장</button>
    </div>
  </div>
</div>

<script>
const PERIODS = ${periodsJson};
const YEAR_MONTHS = ${yearMonthsJson};
const ALL_PERSONS = ${personsJson};
const ALL_PRODUCTS = ${productsJson};
const PERSON_TEAM = ${personTeamJson};
const PRODUCT_TEAM = ${productTeamJson};
const CUR_YEAR = ${curYear};
const CUR_MONTH = ${curMonth};
const TODAY = '${today}';

function boot() { init(); }

// ── Format ────────────────────────────────────────────────
function fmtW(n) {
  n = Math.round(n);
  if (n >= 100000000) {
    const uk = n / 100000000;
    return (uk === Math.round(uk) ? Math.round(uk) : uk.toFixed(1)) + '억';
  }
  if (n >= 10000) return Math.round(n / 10000).toLocaleString() + '만';
  return '\\u20a9' + n.toLocaleString();
}
function fmtCPA(n) {
  if (n <= 0) return '-';
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
  if (n >= 10000) return (n / 10000).toFixed(1) + '만';
  return '\\u20a9' + Math.round(n).toLocaleString();
}
function fmtK(n) { return Math.round(n).toLocaleString(); }
function u(unit) { return '<span class="cv-unit">' + unit + '</span>'; }
function sc(s) { return '<span class="cv-scale">' + s + '</span>'; }
function fmtKpiW(n) {
  n = Math.round(n);
  if (n >= 100000000) { const v = n/100000000; return (v === Math.round(v) ? Math.round(v) : v.toFixed(1)) + sc('억') + u('원'); }
  if (n >= 10000) return Math.round(n/10000).toLocaleString() + sc('만') + u('원');
  return '₩' + n.toLocaleString();
}
function fmtKpiMan(n) {
  n = Math.round(n);
  if (n >= 100000000) { const v = n/100000000; return (v === Math.round(v) ? Math.round(v) : v.toFixed(1)) + sc('억') + u('건'); }
  if (n >= 10000) { const m = n/10000; return (m >= 100 ? Math.round(m).toLocaleString() : m.toFixed(1).replace(/\.0$/,'')) + sc('만') + u('건'); }
  return n.toLocaleString() + u('건');
}
function fmtKpiCpa(n) {
  if (!n || n <= 0) return '-';
  n = Math.round(n);
  if (n >= 10000) { const m = n/10000; return (m >= 100 ? Math.round(m).toLocaleString() : m.toFixed(1).replace(/\.0$/,'')) + sc('만') + u('원'); }
  return n.toLocaleString() + u('원');
}
function fmtDate(d) { if (!d) return '-'; const p = d.split('-'); return p[0].slice(2) + '.' + p[1] + '.' + p[2]; }
function fmtStatus(d) {
  if (!d) return '-';
  const diffDays = (new Date(TODAY) - new Date(d)) / 86400000;
  if (diffDays <= 1) return '<span style="color:#2e7d32;font-size:12px;font-weight:700">운영 중</span>';
  return '<span style="color:#8c96ae;font-size:12px">' + fmtDate(d) + '</span>';
}
function fmtR(r) { return Math.round(r) + '%'; }
function fmtPct(n) { return n.toFixed(1) + '%'; }
function roasCls(r) {
  const t = targetRoas || 250;
  return r >= t*1.6 ? 'roas400' : r >= t*1.2 ? 'roas300' : r >= t ? 'roas250'
       : r >= t*0.8 ? 'roas200' : r >= t*0.6 ? 'roas150' : r >= t*0.4 ? 'roas100' : 'roas0';
}
function setTargetRoas(val) {
  const v = parseInt(val);
  if (isNaN(v) || v < 0) return;
  targetRoas = v;
  localStorage.setItem('hmr_target_roas', v);
  renderAll();
}
function creativeTypeBadge(t) {
  if (t === '릴스')  return '<span style="background:#f3e8ff;color:#7b2ff7;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">릴스</span>';
  if (t === '이미지') return '<span style="background:#e8f4fd;color:#1565c0;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">이미지</span>';
  if (t === '영상')  return '<span style="background:#fff3e0;color:#e65100;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">영상</span>';
  return '';
}
function typeBadge(t) {
  if (t === 'TCPA') return '<span style="background:#dce8ff;color:#2a58b0;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">TCPA</span>';
  if (t === 'TROAS') return '<span style="background:#d4edda;color:#1e7e34;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">TROAS</span>';
  return '<span style="background:#f0f0f4;color:#6c757d;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">ASC</span>';
}
function teamChip(t) {
  const cls = t === '1팀' ? 'chip-1' : t === '2팀' ? 'chip-2' : 'chip-m';
  return t ? '<span class="chip ' + cls + '">' + t + '</span>' : '-';
}
function delta(curr, prev) {
  if (!prev || prev === 0) return '';
  const pct = (curr - prev) / prev * 100;
  const cls = pct >= 1 ? 'up' : pct <= -1 ? 'dn' : 'flat';
  const sign = pct >= 0 ? '+' : '';
  return '<span class="rd ' + cls + '">' + sign + pct.toFixed(1) + '%</span>';
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function pad(n) { return String(n).padStart(2, '0'); }

// ── Today data ────────────────────────────────────────────
let todayData = null;
let todayMode = false;
const TODAY_JSON_URL = 'https://changminkim-debug.github.io/hmr-pulse/today-dashboard.json';

async function setToday() {
  document.querySelectorAll('.pbar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pb-today').classList.add('active');
  todayMode = true;
  activeShortcut = null;
  curPeriod = null;
  activeDate = null;
  activeDateRange = null;
  document.getElementById('ft-period').textContent = '오늘 (1팀)';
  try {
    const res = await fetch(TODAY_JSON_URL + '?t=' + Date.now());
    todayData = await res.json();
  } catch(e) {
    alert('오늘 데이터를 불러올 수 없습니다. 인터넷 연결 또는 데이터 파일을 확인해주세요.');
    return;
  }
  renderTodayView();
}

function renderTodayView() {
  if (!todayData) return;
  const d = todayData;
  const label = d.date + ' ' + d.updatedAt + ' 기준 (1팀)';

  // KPI
  renderKPI({ kpi: d.kpi, byDate: [], byAd: d.byAd, byPerson: d.byPerson, label, start: d.date, end: d.date });

  // 시간대별 패널
  document.getElementById('s-today-hourly').style.display = '';
  document.getElementById('today-updated').textContent = d.updatedAt + ' 기준';
  const hours = d.byHour || [];
  const thStyle = 'text-align:right;padding:8px 12px;font-size:13px;border-bottom:1px solid #eef0f8';
  setBody('b-today-hourly', hours.map((h, i) => {
    const prev = i > 0 ? hours[i-1] : null;
    return '<tr>'
      + '<td class="left" style="padding:8px 12px;font-size:13px;font-weight:600;color:#4a5578">' + h.hour + '</td>'
      + '<td style="' + thStyle + '">' + fmtW(h.spend)     + deltaStr(h.spend,     prev && prev.spend,     fmtW) + '</td>'
      + '<td style="' + thStyle + '">' + fmtK(h.purchases) + '건' + deltaStr(h.purchases, prev && prev.purchases, n => fmtK(n)+'건') + '</td>'
      + '<td style="' + thStyle + '">' + fmtW(h.val)       + deltaStr(h.val,       prev && prev.val,       fmtW) + '</td>'
      + '<td style="' + thStyle + '"><span class="' + roasCls(h.roas) + '">' + fmtR(h.roas) + '</span>' + deltaRoasStr(h.roas, prev && prev.roas) + '</td>'
      + '</tr>';
  }).join(''));
  const totS = hours.reduce((s,h)=>s+h.spend,0), totP = hours.reduce((s,h)=>s+h.purchases,0), totV = hours.reduce((s,h)=>s+h.val,0);
  const totR = totS > 0 ? totV/totS*100 : 0;
  setFoot('f-today-hourly', '<tr>'
    + '<td style="padding:8px 12px;font-weight:700;font-size:13px">TOTAL</td>'
    + '<td style="' + thStyle + ';font-weight:700">' + fmtW(totS) + '</td>'
    + '<td style="' + thStyle + ';font-weight:700">' + fmtK(totP) + '건</td>'
    + '<td style="' + thStyle + ';font-weight:700">' + fmtW(totV) + '</td>'
    + '<td style="' + thStyle + ';font-weight:700"><span class="' + roasCls(totR) + '">' + fmtR(totR) + '</span></td>'
    + '</tr>');

  // 섹션 테이블들
  renderProduct(d.byProduct.map(r => ({ ...r, share: d.kpi.val > 0 ? r.val / d.kpi.val * 100 : 0 })));
  renderCampaign(d.byCampaign.map(r => ({ ...r, impr: 0, clicks: 0 })));
  renderAd(d.byAd.map(r => ({ ...r, impr: 0, clicks: 0, firstDate: null, lastDate: null })));
  document.getElementById('s-person').style.display = 'none';

  // 날짜 힌트
  document.querySelectorAll('.hint.pdate').forEach(el => el.textContent = label);
}
function hideTodayHourly() {
  const el = document.getElementById('s-today-hourly');
  if (el) el.style.display = 'none';
  const ep = document.getElementById('s-person');
  if (ep) ep.style.display = '';
}

// ── State ─────────────────────────────────────────────────
let targetRoas = parseInt(localStorage.getItem('hmr_target_roas') || '250');
let curPeriod = 'thisMonth';
let activeYear = null;
let activeMonth = null;
let activeDate = null;
let activeDateRange = null; // { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
let activeShortcut = 'thisMonth';
let curPerson = '';
let curProducts = new Set();
let curTeam = '';
// ── Compare state ─────────────────────────────────────────
let cmpA = { shortcut: 'yesterday', start: null, end: null };
let cmpB = { shortcut: 'lastMonth', start: null, end: null };
const CMP_LABELS = { yesterday:'어제', thisMonth:'이번달', lastMonth:'지난달', last7d:'최근 7일', last30d:'최근 30일' };
const sortState = {};

// ── Drilldown ─────────────────────────────────────────────
let ddChart = null;

function openDrilldown(type, name) {
  let data = PERIODS[curPeriod];
  if (!data) return;
  let dayMap = type === 'camp' ? data.campDay : data.adDay;

  // adDay 없는 기간(연도 뷰 등)은 최근 FULL_DAILY 기간으로 자동 fallback
  if (!dayMap || !dayMap[name]) {
    for (const key of ['thisMonth', 'last30d', 'last7d', 'yesterday', 'lastMonth']) {
      const p = PERIODS[key];
      if (!p) continue;
      const dm = type === 'camp' ? p.campDay : p.adDay;
      if (dm && dm[name]) { data = p; dayMap = dm; break; }
    }
  }
  if (!dayMap || !dayMap[name]) {
    alert('이 기간은 일자별 데이터가 없습니다. 최근 기간(이번달 / 저번달 / 최근 30일 등)을 선택해주세요.');
    return;
  }

  let days = Object.entries(dayMap[name])
    .map(([date, d]) => ({ date, spend: d.s, purchases: d.p, val: d.v, roas: d.s > 0 ? d.v / d.s * 100 : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 커스텀 기간 설정 시 해당 범위로 필터링
  if (activeDateRange) {
    days = days.filter(d => d.date >= activeDateRange.start && d.date <= activeDateRange.end);
  }

  document.getElementById('dd-type').textContent = type === 'camp' ? '캠페인 드릴다운' : '소재 드릴다운';
  document.getElementById('dd-title').textContent = name;
  let rangeLabel = activeDateRange
    ? (activeDateRange.start.slice(5) + ' ~ ' + activeDateRange.end.slice(5))
    : (data.label || '');
  let subHtml = rangeLabel + '  ·  ' + days.length + '일';
  if (type === 'ad') {
    const adInfo = (data.byAd || []).find(a => a.name === name);
    if (adInfo && adInfo.firstDate) {
      subHtml += '&nbsp;&nbsp;<span style="font-size:12px;font-weight:700;color:#7a5800;background:#fff176;padding:2px 8px;border-radius:4px">라이브 ' + fmtDate(adInfo.firstDate) + ' – ' + fmtStatus(adInfo.lastDate) + '</span>';
    }
  }
  document.getElementById('dd-sub').innerHTML = subHtml;

  // 모달을 먼저 표시해야 Chart.js가 컨테이너 크기를 정확히 측정함
  document.getElementById('dd-overlay').style.display = '';
  document.getElementById('dd-modal').style.display = '';

  if (ddChart) { ddChart.destroy(); ddChart = null; }
  const ctx = document.getElementById('dd-chart').getContext('2d');
  ddChart = new Chart(ctx, {
    data: {
      labels: days.map(d => d.date.slice(5)),
      datasets: [
        { type: 'bar',  label: '비용',   data: days.map(d => d.spend), backgroundColor: 'rgba(68,102,204,.55)', yAxisID: 'y'  },
        { type: 'line', label: 'ROAS%',  data: days.map(d => d.roas),  borderColor: '#f59e42', borderWidth: 2, pointRadius: 2, tension: .35, yAxisID: 'y2' },
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { font: { size: 12 } } } },
      scales: {
        y:  { position: 'left',  grid: { color: '#f0f2f8' }, ticks: { callback: v => (v >= 10000 ? Math.round(v/10000) + '만' : v) } },
        y2: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => Math.round(v) + '%' } },
      }
    }
  });
  // 모달 레이아웃이 확정된 후 차트 크기 재계산 (픽셀↔데이터 매핑 정확도 보정)
  requestAnimationFrame(() => { if (ddChart) ddChart.resize(); });

  const thStyle = 'padding:9px 12px;text-align:right;font-size:12px;font-weight:700;color:#4a5578;border-bottom:2px solid #e0e4f0';
  const thL = thStyle + ';text-align:left';
  document.getElementById('dd-thead').innerHTML =
    '<th style="' + thL + '">날짜</th><th style="' + thStyle + '">비용</th><th style="' + thStyle + '">전환수</th><th style="' + thStyle + '">전환가치</th><th style="' + thStyle + '">ROAS</th>';
  const tdS = 'padding:8px 12px;text-align:right;border-bottom:1px solid #eef0f8;font-size:13px';
  const tdL = tdS + ';text-align:left';
  document.getElementById('dd-tbody').innerHTML = [...days].reverse().map((d, i, arr) => {
    const prev = arr[i + 1] || null;
    return '<tr>'
    + '<td style="' + tdL + '">' + d.date + '</td>'
    + '<td style="' + tdS + '">' + fmtW(d.spend) + deltaStr(d.spend, prev && prev.spend, fmtW) + '</td>'
    + '<td style="' + tdS + '">' + fmtK(d.purchases) + '건' + deltaStr(d.purchases, prev && prev.purchases, n => fmtK(n) + '건') + '</td>'
    + '<td style="' + tdS + '">' + fmtW(d.val) + deltaStr(d.val, prev && prev.val, fmtW) + '</td>'
    + '<td style="' + tdS + '"><span class="' + roasCls(d.roas) + '">' + fmtR(d.roas) + '</span>' + deltaRoasStr(d.roas, prev && prev.roas) + '</td>'
    + '</tr>';
  }).join('');
}

function closeDrilldown() {
  document.getElementById('dd-overlay').style.display = 'none';
  document.getElementById('dd-modal').style.display  = 'none';
  if (ddChart) { ddChart.destroy(); ddChart = null; }
}

// ── Init ──────────────────────────────────────────────────
function init() {
  const goalInp = document.getElementById('roas-goal-input');
  if (goalInp) goalInp.value = targetRoas;
  buildYearPills();
  buildPersonList('');
  buildProductChips('');
  document.querySelectorAll('th.sortable').forEach(th => {
    const tbl = th.closest('table').id.replace('t-', 'b-');
    th.addEventListener('click', () => toggleSort(tbl, th.dataset.col, th.closest('table')));
  });
  ['scroll-campaign','scroll-ad'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var down=false, sx, sy, sl, st;
    el.addEventListener('mousedown', function(e) {
      if (e.target.closest('th')) return;
      down=true; el.classList.add('dragging');
      sx=e.pageX; sy=e.pageY; sl=el.scrollLeft; st=el.scrollTop;
    });
    document.addEventListener('mouseup', function() { down=false; el.classList.remove('dragging'); });
    el.addEventListener('mousemove', function(e) {
      if (!down) return;
      e.preventDefault();
      el.scrollLeft = sl - (e.pageX - sx);
      el.scrollTop  = st - (e.pageY - sy);
    });
  });
  document.getElementById('camp-search').addEventListener('input', function() { renderAll(); });
  document.getElementById('ad-search').addEventListener('input', function() { renderAll(); });

  document.getElementById('b-campaign').addEventListener('click', function(e) {
    const tr = e.target.closest('tr');
    if (tr && tr.dataset.name) openDrilldown('camp', tr.dataset.name);
  });
  document.getElementById('b-ad').addEventListener('click', function(e) {
    const tr = e.target.closest('tr');
    if (tr && tr.dataset.name) openDrilldown('ad', tr.dataset.name);
  });

  setShortcut('thisMonth');
}

function buildYearPills() {
  const wrap = document.getElementById('year-pills');
  const years = Object.keys(YEAR_MONTHS).map(Number).sort((a, b) => b - a);
  wrap.innerHTML = years.map(yr => {
    const label = yr === CUR_YEAR ? yr + '' : yr + '';
    return '<button class="pbar-ypill" onclick="setYear(' + yr + ')">' + label + '</button>';
  }).join('');
}

function getPersonsForProducts() {
  if (!curProducts.size) return null;
  const data = PERIODS[curPeriod];
  if (!data) return null;
  const persons = new Set();
  (data.byAd || []).forEach(a => { if (curProducts.has(a.product) && a.person) persons.add(a.person); });
  return persons;
}

function buildPersonList(teamFilter) {
  const container = document.getElementById('person-list');
  // 담당자 미확인은 팀 필터 없을 때만 표시
  const validPersons = ALL_PERSONS.filter(p =>
    p === '담당자 미확인' ? !teamFilter : (!teamFilter || PERSON_TEAM[p] === teamFilter)
  );
  if (!validPersons.includes(curPerson)) curPerson = '';
  const relevantPersons = getPersonsForProducts();
  let html = '<div class="filter-item' + (!curPerson ? ' active' : '') + '" data-val="" onclick="setPersonFilter(this.dataset.val)"><span class="fi-circle"></span>전체</div>';
  validPersons.forEach(p => {
    const on = curPerson === p;
    const isRelevant = !relevantPersons || relevantPersons.has(p);
    const dimCls = (!on && relevantPersons && !isRelevant) ? ' dim' : '';
    const label = p === '담당자 미확인' ? '<span style="color:#b4bece;font-size:11px">미확인</span>' : esc(p);
    html += '<div class="filter-item' + (on ? ' active' : '') + dimCls + '" data-val="' + esc(p) + '" onclick="setPersonFilter(this.dataset.val)"><span class="fi-circle"></span>' + label + '</div>';
  });
  container.innerHTML = html;
}

function buildProductChips(teamFilter) {
  const container = document.getElementById('prod-list');
  const validProducts = ALL_PRODUCTS.filter(p => !teamFilter || PRODUCT_TEAM[p] === teamFilter);
  for (const p of [...curProducts]) {
    if (!validProducts.includes(p)) curProducts.delete(p);
  }
  const allActive = curProducts.size === 0;
  let html = '<div class="filter-item' + (allActive ? ' active' : '') + '" data-val="" onclick="toggleProductChip(this.dataset.val)"><span class="fi-box">' + (allActive ? '✓' : '') + '</span>전체</div>';
  validProducts.forEach(p => {
    const on = curProducts.has(p);
    html += '<div class="filter-item' + (on ? ' active' : '') + '" data-val="' + esc(p) + '" onclick="toggleProductChip(this.dataset.val)"><span class="fi-box">' + (on ? '✓' : '') + '</span>' + esc(p) + '</div>';
  });
  container.innerHTML = html;
}

// ── Sidebar nav ───────────────────────────────────────────
function setShortcut(id) {
  todayMode = false;
  hideTodayHourly();
  document.getElementById('pb-today').classList.remove('active');
  activeShortcut = id;
  activeYear = null;
  activeMonth = null;
  activeDate = null;
  activeDateRange = null;
  curPeriod = id;
  document.getElementById('month-pills-inline').style.display = 'none';
  syncSidebarActive();
  renderAll();
}

function setYear(yr) {
  todayMode = false; hideTodayHourly();
  activeYear = yr;
  activeMonth = null;
  activeDate = null;
  activeDateRange = null;
  activeShortcut = null;
  curPeriod = yr === CUR_YEAR ? 'ytd' : 'y' + yr;
  buildMonthPills(yr);
  const mWrap = document.getElementById('month-pills-inline');
  mWrap.style.display = 'flex';
  syncSidebarActive();
  renderAll();
}

function setMonth(m) {
  todayMode = false; hideTodayHourly();
  activeDate = null;
  activeDateRange = null;
  if (m === null) {
    activeMonth = null;
    curPeriod = activeYear === CUR_YEAR ? 'ytd' : 'y' + activeYear;
  } else {
    activeMonth = m;
    curPeriod = 'm' + activeYear + pad(m);
  }
  syncSidebarActive();
  renderAll();
}

function buildMonthPills(yr) {
  const months = YEAR_MONTHS[yr] || [];
  const wrap = document.getElementById('month-pills-inline');
  const allBtn = '<button class="pbar-ypill" id="mpill-all" onclick="setMonth(null)">전체</button>';
  const mBtns = months.map(m =>
    '<button class="pbar-ypill" id="mpill-' + m + '" onclick="setMonth(' + m + ')">' + m + '월</button>'
  ).join('');
  wrap.innerHTML = allBtn + mBtns;
}

function setPersonFilter(p) {
  curPerson = p;
  buildPersonList(curTeam);
  renderAll();
}

function toggleProductChip(p) {
  if (!p) {
    curProducts.clear();
  } else {
    if (curProducts.has(p)) curProducts.delete(p);
    else curProducts.add(p);
  }
  buildProductChips(curTeam);
  buildPersonList(curTeam);
  renderAll();
}

function setTeam(t) {
  curTeam = t;
  document.querySelectorAll('.sb-team-btn').forEach(b => b.classList.toggle('active', b.textContent === (t || '전체')));
  buildPersonList(t);
  buildProductChips(t);
  renderAll();
}

function findContainingPeriod(start, end) {
  const candidates = Object.keys(PERIODS).filter(key => {
    const p = PERIODS[key];
    return p.adDay && p.start <= start && p.end >= end;
  });
  candidates.sort((a, b) => {
    const pa = PERIODS[a], pb = PERIODS[b];
    const dA = new Date(pa.end) - new Date(pa.start);
    const dB = new Date(pb.end) - new Date(pb.start);
    return dA - dB; // 가장 좁은 기간 우선
  });
  return candidates[0] || null;
}

function applyCustomRange() {
  const start = document.getElementById('cr-start').value;
  const end   = document.getElementById('cr-end').value;
  if (!start || !end) { alert('시작일과 종료일을 모두 입력해주세요.'); return; }
  if (start > end)    { alert('종료일이 시작일보다 앞에 있습니다.'); return; }
  let key = findContainingPeriod(start, end);
  if (!key) {
    // 단일 기간에 속하지 않는 경우 — 겹치는 기간들의 adDay를 합산해 가상 기간 생성
    const overPeriods = Object.values(PERIODS).filter(p => p.adDay && p.start <= end && p.end >= start);
    if (!overPeriods.length) {
      alert('선택한 날짜 범위에 해당하는 데이터가 없습니다.');
      return;
    }
    const mergedAdDay = {}, mergedCampDay = {}, seenAd = {}, seenCamp = {};
    for (const p of overPeriods) {
      for (const [n, dates] of Object.entries(p.adDay)) {
        if (!mergedAdDay[n]) { mergedAdDay[n] = {}; seenAd[n] = new Set(); }
        for (const [date, d] of Object.entries(dates)) {
          if (date >= start && date <= end && !seenAd[n].has(date)) {
            seenAd[n].add(date);
            mergedAdDay[n][date] = d;
          }
        }
      }
      if (p.campDay) {
        for (const [n, dates] of Object.entries(p.campDay)) {
          if (!mergedCampDay[n]) { mergedCampDay[n] = {}; seenCamp[n] = new Set(); }
          for (const [date, d] of Object.entries(dates)) {
            if (date >= start && date <= end && !seenCamp[n].has(date)) {
              seenCamp[n].add(date);
              mergedCampDay[n][date] = d;
            }
          }
        }
      }
    }
    // byAd: 최신 기간 우선으로 union (소재 메타데이터 보존)
    const byAdMap = new Map();
    overPeriods.sort((a, b) => b.end.localeCompare(a.end));
    for (const p of overPeriods) {
      for (const ad of (p.byAd || [])) {
        if (!byAdMap.has(ad.name)) byAdMap.set(ad.name, ad);
      }
    }
    PERIODS['__custom__'] = {
      ...overPeriods[0],
      start, end,
      adDay: mergedAdDay,
      campDay: mergedCampDay,
      byAd: Array.from(byAdMap.values()),
    };
    key = '__custom__';
  }
  activeDateRange = { start, end };
  activeDate = null;
  activeShortcut = null;
  activeYear = null;
  activeMonth = null;
  curPeriod = key;
  const fmt = s => { const p = s.split('-'); return +p[1] + '/' + +p[2]; };
  const badge = document.getElementById('cr-badge');
  badge.textContent = fmt(start) + ' ~ ' + fmt(end);
  badge.style.display = '';
  syncSidebarActive();
  renderAll();
}

function syncSidebarActive() {
  // 기간 바 shortcut 버튼
  document.querySelectorAll('.pbar-btn[id^="pb-"]').forEach(b => {
    const key = b.id.replace('pb-', '');
    b.classList.toggle('active', !!activeShortcut && activeShortcut === key);
  });
  // 연도
  document.querySelectorAll('#year-pills .pbar-ypill').forEach(b => {
    const yr = parseInt(b.getAttribute('onclick').replace(/\D/g, ''));
    b.classList.toggle('active', yr === activeYear);
  });
  // 월 (인라인)
  if (activeYear) {
    document.querySelectorAll('#month-pills-inline .pbar-ypill').forEach(b => {
      const id = b.id;
      if (id === 'mpill-all') { b.classList.toggle('active', activeMonth === null); }
      else { b.classList.toggle('active', parseInt(id.replace('mpill-', '')) === activeMonth); }
    });
  }
  // 직접입력 배지: activeDateRange 없으면 숨김
  const badge = document.getElementById('cr-badge');
  if (badge && !activeDateRange) badge.style.display = 'none';
  syncStatusBar();
}

function periodDateStr(data) {
  if (!data || !data.start) return '';
  const fmt = s => { const p = s.split('-'); return +p[1] + '/' + +p[2]; };
  if (data.start === data.end) return fmt(data.end);
  return fmt(data.start) + '~' + fmt(data.end);
}

function syncStatusBar() {
  const data = PERIODS[curPeriod];
  const fmt = s => { const p = s.split('-'); return +p[1] + '/' + +p[2]; };
  const dateStr = activeDateRange
    ? fmt(activeDateRange.start) + '~' + fmt(activeDateRange.end)
    : (activeDate ? '' : periodDateStr(data));
  const periodLabel = activeDateRange ? '직접입력' : (data ? (data.label || curPeriod) : curPeriod);
  const label = periodLabel + (activeDate ? ' · ' + activeDate : '') + (dateStr ? '  ' + dateStr : '');
  document.getElementById('ft-period').textContent = label;

  const ftPerson = document.getElementById('ft-person');
  if (curPerson) {
    ftPerson.innerHTML = '<span class="ftag ftag-person">👤 ' + esc(curPerson) + '</span>';
    ftPerson.style.display = '';
  } else { ftPerson.style.display = 'none'; }

  const ftProduct = document.getElementById('ft-product');
  if (curProducts.size) {
    const label = curProducts.size === 1 ? esc([...curProducts][0]) : curProducts.size + '개 품목';
    ftProduct.innerHTML = '<span class="ftag ftag-product">📦 ' + label + '</span>';
    ftProduct.style.display = '';
  } else { ftProduct.style.display = 'none'; }

  const ftTeam = document.getElementById('ft-team');
  if (curTeam) {
    ftTeam.innerHTML = '<span class="ftag ftag-team">' + esc(curTeam) + '</span>';
    ftTeam.style.display = '';
  } else { ftTeam.style.display = 'none'; }
}

// ── Render All ────────────────────────────────────────────
function renderAll() {
  const data = PERIODS[curPeriod];
  if (!data) return;
  renderKPI(data);
  renderProduct(getFilteredByProduct(data));
  const camps = getFilteredByCamp(data);
  renderCampaign(camps);
  const adRows = filteredAds(data);
  renderAd(adRows);
  renderPerson(getFilteredByPerson(data));
  // 개수 hint 업데이트
  const campHint = document.getElementById('camp-hint');
  const adHint = document.getElementById('ad-hint');
  if (campHint) { campHint.textContent = camps.length > 0 ? '총 ' + camps.length + '개 · 비용순' : ''; }
  if (adHint) { adHint.textContent = adRows.length > 0 ? '총 ' + adRows.length + '개 · 비용순' + (curPeriod.startsWith('y') || curPeriod === 'all' ? ' (상위 500)' : '') : ''; }
  const _fmt = s => { const p = s.split('-'); return +p[1] + '/' + +p[2]; };
  const ds = activeDateRange
    ? _fmt(activeDateRange.start) + '~' + _fmt(activeDateRange.end)
    : periodDateStr(data);
  document.querySelectorAll('.pdate').forEach(el => { el.textContent = ds; });
  syncStatusBar();
  applyRowFilters();
  reNumber();
}

// ── 필터 적용 집계 ────────────────────────────────────────

// 월별 기간(m202606 등)은 adDay가 없으므로, 같은 날짜범위의 FULL_DAILY 기간 데이터를 재사용
function getEffectiveData(data) {
  if ((!activeDate && !activeDateRange) || data.adDay) return data;
  for (const key of Object.keys(PERIODS)) {
    const p = PERIODS[key];
    if (p.adDay && p.start === data.start && p.end === data.end) return p;
  }
  return data;
}

function filteredAds(data) {
  const eTeam = effectiveTeam(data);
  if (activeDate || activeDateRange) {
    const eff = getEffectiveData(data);
    const adDay = eff.adDay || {};
    return (eff.byAd || data.byAd || []).filter(a =>
      (!curPerson        || a.person  === curPerson) &&
      (!curProducts.size || curProducts.has(a.product)) &&
      (!eTeam            || a.team    === eTeam)
    ).map(a => {
      if (activeDate) {
        const day = adDay[a.name]?.[activeDate];
        if (!day || !day.s) return null;
        return { ...a, spend: day.s, purchases: day.p, val: day.v };
      } else {
        // activeDateRange: 범위 내 날짜 합산
        const dayData = adDay[a.name] || {};
        let spend = 0, purchases = 0, val = 0;
        for (const [date, d] of Object.entries(dayData)) {
          if (date >= activeDateRange.start && date <= activeDateRange.end && d?.s) {
            spend += d.s; purchases += d.p; val += d.v;
          }
        }
        if (!spend) return null;
        return { ...a, spend, purchases, val, roas: spend > 0 ? val / spend * 100 : 0 };
      }
    }).filter(Boolean);
  }
  return (data.byAd || []).filter(a =>
    (!curPerson        || a.person  === curPerson) &&
    (!curProducts.size || curProducts.has(a.product)) &&
    (!eTeam            || a.team    === eTeam)
  );
}

${clientParseCode}

function effectiveTeam(data) {
  if (curTeam) return curTeam;
  if (curPerson) {
    const p = (data.byPerson || []).find(r => r.name === curPerson);
    return p ? p.team : '';
  }
  return '';
}

function getFilteredKpi(data) {
  // 일자 필터: byDate에서 해당 날짜 KPI
  if (activeDate) {
    const day = (data.byDate || []).find(d => d.date === activeDate);
    if (day) return { spend: day.spend, purchases: day.purchases, val: day.val, roas: day.roas, clicks: day.clicks || 0, impr: day.impr || 0 };
    return { spend: 0, purchases: 0, val: 0, roas: 0, clicks: 0, impr: 0 };
  }
  const eTeam = effectiveTeam(data);
  // 필터 없음 + 커스텀 범위 없음: 사전계산 KPI
  if (!curPerson && !curProducts.size && !eTeam && !activeDateRange) return data.kpi;
  // 복합/단일 필터: byAd에서 합산 (impr/clicks 포함)
  const ads = filteredAds(data);
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const purchases = ads.reduce((s, a) => s + a.purchases, 0);
  const val = ads.reduce((s, a) => s + a.val, 0);
  const clicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const impr = ads.reduce((s, a) => s + (a.impr || 0), 0);
  return { spend, purchases, val, roas: spend > 0 ? val / spend * 100 : 0, clicks, impr };
}

function getFilteredByProduct(data) {
  const eTeam = effectiveTeam(data);
  if (!activeDate && !activeDateRange && !eTeam && !curPerson && !curProducts.size) return data.byProduct || [];
  const ads = filteredAds(data);
  const totalVal = ads.reduce((s, a) => s + a.val, 0);
  const map = {};
  ads.forEach(a => {
    const k = a.product || '미분류';
    if (!map[k]) map[k] = { name: k, spend: 0, purchases: 0, val: 0 };
    map[k].spend += a.spend; map[k].purchases += a.purchases; map[k].val += a.val;
  });
  return Object.values(map).map(p => ({
    ...p, roas: p.spend > 0 ? p.val/p.spend*100 : 0,
    share: totalVal > 0 ? p.val/totalVal*100 : 0
  })).sort((a, b) => b.spend - a.spend);
}

function getFilteredByPerson(data) {
  const eTeam = effectiveTeam(data);
  if (!activeDate && !activeDateRange && !eTeam && !curProducts.size) return data.byPerson || [];
  const ads = filteredAds(data);
  const totalVal = ads.reduce((s, a) => s + a.val, 0);
  const map = {};
  ads.forEach(a => {
    const k = a.person || '담당자 미확인';
    if (!map[k]) map[k] = { name: k, team: a.team, spend: 0, purchases: 0, val: 0 };
    map[k].spend += a.spend; map[k].purchases += a.purchases; map[k].val += a.val;
  });
  return Object.values(map).map(p => ({
    ...p, roas: p.spend > 0 ? p.val/p.spend*100 : 0,
    share: totalVal > 0 ? p.val/totalVal*100 : 0
  })).sort((a, b) => b.spend - a.spend);
}

function getFilteredByCamp(data) {
  const eTeam = effectiveTeam(data);
  // 필터 없고 날짜 필터도 없으면 사전계산값
  if (!activeDate && !activeDateRange && !curPerson && !curProducts.size && !eTeam) return data.byCamp || [];
  // 필터 있는 모든 케이스: filteredAds 기반 재집계 (소재별/담당자별과 동일 소스 → 합계 일치)
  const ads = filteredAds(data);
  const map = {};
  for (const a of ads) {
    const key = a.campName || a.campId || '미분류';
    if (!map[key]) map[key] = { name: key, team: a.team, spend: 0, purchases: 0, val: 0, impr: 0, clicks: 0 };
    map[key].spend += a.spend; map[key].purchases += a.purchases; map[key].val += a.val;
    map[key].impr += (a.impr || 0); map[key].clicks += (a.clicks || 0);
  }
  return Object.values(map).map(c => ({
    ...c, roas: c.spend > 0 ? c.val / c.spend * 100 : 0
  })).sort((a, b) => b.spend - a.spend);
}

// ── Monthly Targets ────────────────────────────────────────
function tgtStorageKey(ym) { return 'hmr_targets_' + ym; }
function loadTgt(ym) {
  try { return JSON.parse(localStorage.getItem(tgtStorageKey(ym)) || '{}'); } catch { return {}; }
}
function saveTgt(ym, obj) { localStorage.setItem(tgtStorageKey(ym), JSON.stringify(obj)); }

function tgtYM() {
  // 현재 기간에 대응하는 YYYY_MM 반환 (없으면 null)
  if (activeShortcut === 'yesterday' || activeShortcut === 'thisMonth' || activeShortcut === 'last7d') {
    return CUR_YEAR + '_' + String(CUR_MONTH).padStart(2, '0');
  }
  if (activeShortcut === 'lastMonth') {
    const d = new Date(TODAY);
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return prev.getFullYear() + '_' + String(prev.getMonth() + 1).padStart(2, '0');
  }
  return null;
}

function sumTgtProducts(allTgts, products) {
  let budget = 0, revenue = 0, hasSome = false;
  for (const p of products) {
    const t = allTgts[p];
    if (!t) continue;
    if (t.budget)  { budget  += t.budget;  hasSome = true; }
    if (t.revenue) { revenue += t.revenue; hasSome = true; }
  }
  if (!hasSome) return null;
  const roas = budget > 0 && revenue > 0 ? revenue / budget * 100 : 0;
  return { budget, revenue, roas };
}

function getEffectiveTarget() {
  if (curPerson) return null;
  const ym = tgtYM();
  if (!ym) return null;
  const allTgts = loadTgt(ym);

  if (curProducts.size === 1) {
    const t = allTgts[[...curProducts][0]];
    return (t && (t.budget || t.purchases || t.revenue || t.roas)) ? t : null;
  }
  if (curProducts.size === 0 && curTeam) {
    return sumTgtProducts(allTgts, ALL_PRODUCTS.filter(p => PRODUCT_TEAM[p] === curTeam));
  }
  if (curProducts.size === 0 && !curTeam) {
    return sumTgtProducts(allTgts, ALL_PRODUCTS);
  }
  return null;
}

let _tgtModalYM = '';
function openTgtModal() {
  // 현재 기간에 맞는 월을 기본값으로, 없으면 이번달
  _tgtModalYM = tgtYM() || (CUR_YEAR + '_' + String(CUR_MONTH).padStart(2, '0'));
  renderTgtModal();
  document.getElementById('tgt-wrap').style.display = 'block';
}
function closeTgtModal() {
  document.getElementById('tgt-wrap').style.display = 'none';
}
function tgtPrevMonth() {
  const [y, m] = _tgtModalYM.split('_').map(Number);
  const prev = new Date(y, m - 2, 1);
  _tgtModalYM = prev.getFullYear() + '_' + String(prev.getMonth() + 1).padStart(2, '0');
  renderTgtModal();
}
function tgtNextMonth() {
  const [y, m] = _tgtModalYM.split('_').map(Number);
  const next = new Date(y, m, 1);
  _tgtModalYM = next.getFullYear() + '_' + String(next.getMonth() + 1).padStart(2, '0');
  renderTgtModal();
}
function renderTgtModal() {
  const [y, m] = _tgtModalYM.split('_').map(Number);
  document.getElementById('tgt-title').textContent = y + '년 ' + m + '월 목표 설정';
  document.getElementById('tgt-month-label').textContent = y + '.' + String(m).padStart(2, '0');
  const saved = loadTgt(_tgtModalYM);
  const teams = ['1팀', '2팀'];
  const otherProds = ALL_PRODUCTS.filter(p => !PRODUCT_TEAM[p] || !teams.includes(PRODUCT_TEAM[p]));
  let rows = '';
  const teamColors = { '1팀': '#eef2ff', '2팀': '#fff3e0' };
  for (const team of teams) {
    const prods = ALL_PRODUCTS.filter(p => PRODUCT_TEAM[p] === team);
    if (!prods.length) continue;
    rows += '<tr><td colspan="5" style="background:' + (teamColors[team]||'#f4f6fb') + ';padding:6px 8px;font-size:11px;font-weight:700;color:#4a5578;letter-spacing:.4px">' + team + '</td></tr>';
    rows += prods.map(p => tgtProductRow(p, saved[p] || {})).join('');
    rows += '<tr class="tgt-sum-row" id="tgt-sum-' + team.replace('팀','t') + '">' +
      '<td style="font-size:12px;font-weight:700;color:#4466cc;padding-left:16px">' + team + ' 합계</td>' +
      '<td id="ts-' + team.replace('팀','t') + '-b" class="tgt-sum-cell">—</td>' +
        '<td id="ts-' + team.replace('팀','t') + '-r" class="tgt-sum-cell">—</td>' +
      '<td id="ts-' + team.replace('팀','t') + '-ro" class="tgt-sum-cell">—</td></tr>';
  }
  if (otherProds.length) {
    rows += '<tr><td colspan="5" style="background:#f4f6fb;padding:6px 8px;font-size:11px;font-weight:700;color:#4a5578">기타</td></tr>';
    rows += otherProds.map(p => tgtProductRow(p, saved[p] || {})).join('');
  }
  rows += '<tr style="border-top:2px solid #4466cc"><td style="font-size:12px;font-weight:700;color:#4466cc">전체 합계</td>' +
    '<td id="ts-all-b" class="tgt-sum-cell">—</td>' +
    '<td id="ts-all-r" class="tgt-sum-cell">—</td>' +
    '<td id="ts-all-ro" class="tgt-sum-cell">—</td></tr>';
  document.getElementById('tgt-tbody').innerHTML = rows;
  updateTgtSummary();
}
function tgtProductRow(p, t) {
  const bv = t.budget ? Math.round(t.budget) : '';
  const rv = t.revenue ? Math.round(t.revenue) : '';
  const rov = t.roas || '';
  return '<tr><td style="padding-left:12px">' + p + '</td>' +
    '<td><input class="tgt-input" data-p="' + p + '" data-f="budget" type="number" min="0" value="' + bv + '" placeholder="0" oninput="updateTgtSummary()"></td>' +
    '<td><input class="tgt-input" data-p="' + p + '" data-f="revenue" type="number" min="0" value="' + rv + '" placeholder="0" oninput="updateTgtSummary()"></td>' +
    '<td><input class="tgt-input" data-p="' + p + '" data-f="roas" type="number" min="0" value="' + rov + '" placeholder="250" oninput="updateTgtSummary()"></td></tr>';
}
function updateTgtSummary() {
  const getVal = (p, f) => {
    const el = document.querySelector('.tgt-input[data-p="' + p + '"][data-f="' + f + '"]');
    return el ? (parseFloat(el.value) || 0) : 0;
  };
  const fmtSum = (v) => v > 0 ? fmtW(v) : '—';
  const teams = ['1팀', '2팀'];
  let allB = 0, allR = 0;
  for (const team of teams) {
    const prods = ALL_PRODUCTS.filter(p => PRODUCT_TEAM[p] === team);
    if (!prods.length) continue;
    const B = prods.reduce((s, p) => s + getVal(p, 'budget'), 0);
    const R = prods.reduce((s, p) => s + getVal(p, 'revenue'), 0);
    const roas = B > 0 && R > 0 ? (R / B * 100).toFixed(0) + '%' : '—';
    const tid = team.replace('팀', 't');
    const sb = document.getElementById('ts-' + tid + '-b');
    if (sb) { sb.textContent = fmtSum(B); allB += B; }
    const sr = document.getElementById('ts-' + tid + '-r');
    if (sr) { sr.textContent = fmtSum(R); allR += R; }
    const sro = document.getElementById('ts-' + tid + '-ro');
    if (sro) { sro.textContent = roas; }
  }
  const allRoas = allB > 0 && allR > 0 ? (allR / allB * 100).toFixed(0) + '%' : '—';
  const ab = document.getElementById('ts-all-b'); if (ab) ab.textContent = fmtSum(allB);
  const ar = document.getElementById('ts-all-r'); if (ar) ar.textContent = fmtSum(allR);
  const aro = document.getElementById('ts-all-ro'); if (aro) aro.textContent = allRoas;
}
function saveTgtModal() {
  const inputs = document.querySelectorAll('#tgt-tbody .tgt-input');
  const data = {};
  inputs.forEach(inp => {
    const p = inp.dataset.p, f = inp.dataset.f;
    const v = parseFloat(inp.value);
    if (!isNaN(v) && v > 0) {
      if (!data[p]) data[p] = {};
      data[p][f] = v;
    }
  });
  saveTgt(_tgtModalYM, data);
  closeTgtModal();
  renderAll();
}

function renderKPI(data) {
  const k = getFilteredKpi(data);

  const _tgt = getEffectiveTarget();

  function tgtBar(goalLabel, pct, cls) {
    const w = Math.min(pct, 100).toFixed(1);
    return '<div class="ctt-bottom">' +
      '<span class="ctt-goal">' + goalLabel + '</span>' +
      '<span class="ctt-pct ' + cls + '">' + Math.round(pct) + '%</span>' +
      '</div>' +
      '<div class="ctt-bar"><div class="ctt-bar-fill ' + cls + '" style="width:' + w + '%"></div></div>';
  }

  // 비용 카드
  let spendExtra = '', spendCardCls = 'card';
  if (_tgt && _tgt.budget) {
    const pct = k.spend / _tgt.budget * 100;
    const cls = pct > 100 ? 'over' : pct > 80 ? 'warn' : 'ok';
    spendExtra = tgtBar('목표 ' + fmtW(_tgt.budget) + '원', pct, cls);
    spendCardCls = 'card card-tgt';
  }
  // 전환가치 카드
  let valExtra = '', valCardCls = 'card';
  if (_tgt && _tgt.revenue) {
    const pct = k.val / _tgt.revenue * 100;
    const cls = pct >= 100 ? 'ok' : pct >= 70 ? 'warn' : 'over';
    valExtra = tgtBar('목표 ' + fmtW(_tgt.revenue) + '원', pct, cls);
    valCardCls = 'card card-tgt';
  }
  // ROAS 카드 — 오른쪽은 %p 델타, 바는 달성률로 유지
  let roasExtra = '', roasCardCls = 'card';
  if (_tgt && _tgt.roas) {
    const pct = k.roas / _tgt.roas * 100;
    const cls = pct >= 100 ? 'ok' : pct >= 80 ? 'warn' : 'over';
    const delta = Math.round(k.roas - _tgt.roas);
    const sign = delta >= 0 ? '+' : '';
    const w = Math.min(pct, 100).toFixed(1);
    roasExtra = '<div class="ctt-bottom">'
      + '<span class="ctt-goal">목표 ' + Math.round(_tgt.roas) + '%</span>'
      + '<span class="ctt-pct ' + cls + '">' + sign + delta + '%p</span>'
      + '</div>'
      + '<div class="ctt-bar"><div class="ctt-bar-fill ' + cls + '" style="width:' + w + '%"></div></div>';
    roasCardCls = 'card card-tgt';
  }

  const ctr = k.impr > 0 ? k.clicks / k.impr * 100 : 0;
  const cvr = k.clicks > 0 ? k.purchases / k.clicks * 100 : 0;
  const cpa = k.purchases > 0 ? k.spend / k.purchases : 0;
  const cpc = k.clicks > 0 ? k.spend / k.clicks : 0;

  document.getElementById('kpi-cards').innerHTML =
    '<div class="' + spendCardCls + '"><div class="cl">광고 비용</div><div class="cv">' + fmtKpiW(k.spend) + '</div>' + spendExtra + '</div>' +
    '<div class="card"><div class="cl">전환수</div><div class="cv">' + fmtK(k.purchases) + u('건') + '</div></div>' +
    '<div class="' + valCardCls + '"><div class="cl">전환가치</div><div class="cv">' + fmtKpiW(k.val) + '</div>' + valExtra + '</div>' +
    '<div class="' + roasCardCls + '"><div class="cl">ROAS</div><div class="cv-roas ' + roasCls(k.roas) + '">' + Math.round(k.roas) + u('%') + '</div>' + roasExtra + '</div>' +
    '<div class="card"><div class="cl">CPA</div><div class="cv">' + fmtKpiCpa(cpa) + '</div></div>';

  const subCards = [
    { label: '노출수', html: fmtKpiMan(k.impr) },
    { label: '클릭수', html: fmtKpiMan(k.clicks) },
    { label: 'CTR',    html: ctr.toFixed(2) + u('%') },
    { label: 'CVR',    html: cvr.toFixed(2) + u('%') },
    { label: 'CPC',    html: fmtKpiCpa(cpc) },
  ];
  const subEl = document.getElementById('kpi-cards-sub');
  subEl.innerHTML = subCards.map(c =>
    '<div class="card"><div class="cl">' + c.label + '</div><div class="cv" style="font-size:32px">' + c.html + '</div></div>'
  ).join('');
  subEl.style.display = todayMode ? 'none' : '';
}

// ── Trend Chart / Compare (removed) ──────────────────────

const roasLabelPlugin = {
  id: 'roasLabels',
  afterDatasetsDraw(chart) {
    const dense = chart.data.labels.length > 60;
    if (dense) return;
    const ds = chart.data.datasets;
    const roasIdx = ds.findIndex(d => d.label === 'ROAS');
    if (roasIdx < 0) return;
    const meta = chart.getDatasetMeta(roasIdx);
    const { ctx } = chart;
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    meta.data.forEach((pt, i) => {
      const val = ds[roasIdx].data[i];
      if (val > 0) {
        const text = (val / 100).toFixed(2);
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(pt.x - tw / 2 - 3, pt.y - 19, tw + 6, 15);
        ctx.fillStyle = '#1565c0';
        ctx.fillText(text, pt.x, pt.y - 6);
      }
    });
    ctx.restore();
  }
};


function getFilteredDaily(data) {
  const hasFilter = !!(curPerson || curProducts.size || curTeam);
  // 필터 없고 날짜범위도 없으면 pre-computed byDate 그대로
  if (!hasFilter && !activeDateRange) return data.byDate || [];
  // adDay가 있는 기간 찾기 (현재 기간 또는 같은 날짜범위의 FULL_DAILY 기간)
  let adDay = data.adDay;
  let byAd = data.byAd || [];
  if (!adDay) {
    for (const key of Object.keys(PERIODS)) {
      const p = PERIODS[key];
      if (p.adDay && p.start === data.start && p.end === data.end) { adDay = p.adDay; byAd = p.byAd || byAd; break; }
    }
  }
  if (hasFilter && adDay) {
    // byAd를 필터링: curPerson(person 필드), curTeam 또는 person의 팀, curProducts
    const eTeam = curTeam || (curPerson ? ((data.byPerson || []).find(r => r.name === curPerson) || {}).team || '' : '');
    const ads = byAd.filter(a =>
      (!curPerson || a.person === curPerson) &&
      (!curProducts.size || curProducts.has(a.product)) &&
      (!eTeam || a.team === eTeam)
    );
    const dateMap = {};
    for (const a of ads) {
      const dayData = adDay[a.name] || {};
      for (const [date, d] of Object.entries(dayData)) {
        if (!d || !d.s) continue;
        if (activeDateRange && (date < activeDateRange.start || date > activeDateRange.end)) continue;
        if (!dateMap[date]) dateMap[date] = { date, spend: 0, purchases: 0, val: 0 };
        dateMap[date].spend += d.s; dateMap[date].purchases += d.p; dateMap[date].val += d.v;
      }
    }
    return Object.values(dateMap)
      .map(d => ({ ...d, roas: d.spend > 0 ? d.val / d.spend * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  // adDay 없거나 필터 없이 날짜범위만: byDate 기반
  let daily = data.byDate || [];
  if (activeDateRange) daily = daily.filter(d => d.date >= activeDateRange.start && d.date <= activeDateRange.end);
  return daily;
}

// ── Table Renderers ───────────────────────────────────────
function sortRows(rows, col, dir) {
  return [...rows].sort((a, b) => {
    const va = a[col] ?? 0, vb = b[col] ?? 0;
    if (typeof va === 'number') return dir * (va - vb);
    return dir * String(va).localeCompare(String(vb), 'ko');
  });
}

function toggleSort(bodyId, col, table) {
  const cur = sortState[bodyId] || { col: 'spend', dir: -1 };
  const dir = cur.col === col ? -cur.dir : -1;
  sortState[bodyId] = { col, dir };
  table.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === col) th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
  });
  renderAll();
}

function setBody(id, html) { document.getElementById(id).innerHTML = html; }
function setFoot(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

const PRODUCT_CODE = {
  '닭가슴살':       'HDG',
  '크리스피닭가슴살':'HCP',
  '크리스피닭다리':  'HCPL',
  '크리스피안심':   'HCPT',
  '김자반밥바':     'HKBB',
  '닭다리':         'HSL',
  '안심폭탄볶음밥': 'HTR',
  '그릴드닭가슴살': 'HGD',
  '마녀스프':       'HMS',
  '실온마녀스프':   'HMS',
  '닭양롤':         'HRL',
  '비엔나':         'HMX',
  '슬라이스닭가슴살':'HSSD',
  '슬림슬라이스':   'HSSD',
  '칼집오븐구이':   'HKOG',
  '칼집오븐닭가슴살':'HKOG',
  '닭가슴살볼':     'HDB',
  '통살그릴드혼합': 'HTG',
  '블랙페퍼닭가슴살':'HBP',
  '이벤트':         'HEVENT',
};

function deltaStr(curr, prev, fmt) {
  if (prev == null) return '';
  const d = curr - prev;
  if (d === 0) return '';
  const sign = d > 0 ? '+' : '';
  const color = d > 0 ? '#2e7d32' : '#c62828';
  return ' <span style="font-size:11px;color:' + color + '">(' + sign + fmt(d) + ')</span>';
}
function deltaRoasStr(curr, prev) {
  if (prev == null) return '';
  const d = Math.round(curr - prev);
  if (d === 0) return '';
  const sign = d > 0 ? '+' : '';
  const color = d > 0 ? '#2e7d32' : '#c62828';
  return ' <span style="font-size:11px;color:' + color + '">(' + sign + d + '%p)</span>';
}

function tgtHint(actual, target, fmt) {
  if (!target) return '';
  const pct = Math.round(target > 0 ? actual / target * 100 : 0);
  return '<div class="tgt-hint">(목표 ' + fmt(target) + ' 대비 <b>' + pct + '%</b>)</div>';
}
function tgtRoasHint(actual, target) {
  if (!target) return '';
  const diff = Math.round(actual - target);
  const arrow = diff >= 0 ? '▲' : '▼';
  const color = diff >= 0 ? '#1565c0' : '#c62828';
  return '<div class="tgt-hint">(목표 ' + Math.round(target) + '% 대비 <b style="color:' + color + '">' + arrow + ' ' + Math.abs(diff) + '%p</b>)</div>';
}

function renderProduct(rows) {
  const { col = 'spend', dir = -1 } = sortState['b-product'] || {};
  const sorted = sortRows(rows, col, dir);
  const total = rows.reduce((s, r) => s + r.val, 0);
  const showTgt = curPeriod === 'thisMonth' && !curPerson;
  const allTgts = showTgt ? loadTgt(CUR_YEAR + '_' + String(CUR_MONTH).padStart(2, '0')) : {};
  setBody('b-product', sorted.map((r, i) => {
    const barPct = total > 0 ? Math.round(r.val / total * 100) : 0;
    const t = showTgt ? (allTgts[r.name] || {}) : {};
    return '<tr data-product="' + esc(r.name) + '">'
      + '<td class="rank left">' + (i+1) + '</td>'
      + '<td class="name left">' + esc(r.name) + (PRODUCT_CODE[r.name] ? '&nbsp;&nbsp;<span style="font-size:11px;color:#4466cc;font-weight:600;letter-spacing:.6px;opacity:.85">' + PRODUCT_CODE[r.name] + '</span>' : '') + '</td>'
      + '<td>' + fmtW(r.spend) + tgtHint(r.spend, t.budget, fmtW) + '</td>'
      + '<td>' + fmtK(r.purchases) + '건</td>'
      + '<td>' + fmtW(r.val) + tgtHint(r.val, t.revenue, fmtW) + '</td>'
      + '<td><span class="' + roasCls(r.roas) + '">' + fmtR(r.roas) + '</span>' + tgtRoasHint(r.roas, t.roas) + '</td>'
      + '<td><div class="bar-wrap"><span style="font-size:12px">' + fmtPct(r.share) + '</span>'
      + '<div class="bar-bg"><div class="bar-fill" style="width:' + barPct + '%"></div></div></div></td>'
      + '<td><button class="camp-toggle" onclick="toggleProductDates(this,event)" data-product="' + esc(r.name) + '" title="일자별 펼치기">▶</button></td>'
      + '</tr>';
  }).join(''));
  const pTotSpend = rows.reduce((s,r)=>s+r.spend,0);
  const pTotPurchases = rows.reduce((s,r)=>s+r.purchases,0);
  const pTotVal = rows.reduce((s,r)=>s+r.val,0);
  const pTotRoas = pTotSpend>0 ? pTotVal/pTotSpend*100 : 0;
  setFoot('f-product', '<tr>'
    +'<td colspan="2" style="padding-left:16px">TOTAL <span style="font-size:11px;opacity:.6">('+rows.length+'건)</span></td>'
    +'<td>'+fmtW(pTotSpend)+'</td>'
    +'<td>'+fmtK(pTotPurchases)+'건</td>'
    +'<td>'+fmtW(pTotVal)+'</td>'
    +'<td><span class="'+roasCls(pTotRoas)+'">'+fmtR(pTotRoas)+'</span></td>'
    +'<td></td>'
    +'<td><button class="camp-toggle" onclick="toggleTotalDates(this,event)" title="전체 일자별 펼치기">▶</button></td>'
    +'</tr>');
}

function renderCampaign(rows) {
  const { col = 'spend', dir = -1 } = sortState['b-campaign'] || {};
  const enriched = rows.map(r => {
    const p = parseCampaignName(r.name || '');
    const ctr = (r.impr || 0) > 0 ? (r.clicks || 0) / r.impr * 100 : 0;
    const cvr = (r.clicks || 0) > 0 ? r.purchases / r.clicks * 100 : 0;
    const cpa = r.purchases > 0 ? r.spend / r.purchases : 0;
    return { ...r, ...p, ctr, cvr, cpa };
  });
  const sorted = sortRows(enriched, col, dir);
  const q = (document.getElementById('camp-search')?.value || '').toLowerCase().trim();
  const display = q ? sorted.filter(r => (r.name || '').toLowerCase().includes(q)) : sorted;
  setBody('b-campaign', display.map((r, i) => {
    const t = r.team || '미분류';
    return '<tr data-team="' + t + '" data-name="' + esc(r.name) + '" style="cursor:pointer" title="클릭하면 일자별 성과 확인">'
      + '<td class="rank left">' + (i+1) + '</td>'
      + '<td class="left">' + typeBadge(r.campType) + ' ' + esc(r.name) + '</td>'
      + '<td>' + fmtW(r.spend) + '</td>'
      + '<td>' + fmtK(r.purchases) + '건</td>'
      + '<td>' + fmtW(r.val) + '</td>'
      + '<td><span class="' + roasCls(r.roas) + '">' + fmtR(r.roas) + '</span></td>'
      + '<td>' + r.ctr.toFixed(2) + '%</td>'
      + '<td>' + r.cvr.toFixed(2) + '%</td>'
      + '<td>' + fmtCPA(r.cpa) + '</td>'
      + '<td><button class="camp-toggle" onclick="toggleCampAds(this,event)" data-camp="' + esc(r.name) + '" title="소재 펼치기">▶</button></td>'
      + '</tr>';
  }).join(''));
  const cTotSpend = display.reduce((s,r)=>s+r.spend,0);
  const cTotPurchases = display.reduce((s,r)=>s+r.purchases,0);
  const cTotVal = display.reduce((s,r)=>s+r.val,0);
  const cTotImpr = display.reduce((s,r)=>s+(r.impr||0),0);
  const cTotClicks = display.reduce((s,r)=>s+(r.clicks||0),0);
  const cTotRoas = cTotSpend>0 ? cTotVal/cTotSpend*100 : 0;
  const cTotCtr = cTotImpr>0 ? cTotClicks/cTotImpr*100 : 0;
  const cTotCvr = cTotClicks>0 ? cTotPurchases/cTotClicks*100 : 0;
  const cTotCpa = cTotPurchases>0 ? cTotSpend/cTotPurchases : 0;
  setFoot('f-campaign', '<tr>'
    +'<td colspan="2" style="padding-left:16px">TOTAL <span style="font-size:11px;opacity:.6">('+display.length+'건)</span></td>'
    +'<td>'+fmtW(cTotSpend)+'</td>'
    +'<td>'+fmtK(cTotPurchases)+'건</td>'
    +'<td>'+fmtW(cTotVal)+'</td>'
    +'<td><span class="'+roasCls(cTotRoas)+'">'+fmtR(cTotRoas)+'</span></td>'
    +'<td>'+cTotCtr.toFixed(2)+'%</td>'
    +'<td>'+cTotCvr.toFixed(2)+'%</td>'
    +'<td>'+fmtCPA(cTotCpa)+'</td>'
    +'<td></td>'
    +'</tr>');
}

function renderAd(rows) {
  const { col = 'spend', dir = -1 } = sortState['b-ad'] || {};
  const enriched = rows.map(a => {
    const name = a.name || '';
    const p = parseAdName(name);
    const roas = a.spend > 0 ? a.val / a.spend * 100 : 0;
    const ctr = a.impr > 0 ? a.clicks / a.impr * 100 : 0;
    const cvr = a.clicks > 0 ? a.purchases / a.clicks * 100 : 0;
    const cpa = a.purchases > 0 ? a.spend / a.purchases : 0;
    return { ...a, name, roas, creativeType: p.creativeType, ctr, cvr, cpa };
  });
  const sorted = sortRows(enriched, col, dir);
  const q = (document.getElementById('ad-search')?.value || '').toLowerCase().trim();
  const display = q ? sorted.filter(r => (r.name || '').toLowerCase().includes(q)) : sorted;
  setBody('b-ad', display.map((r, i) => {
    const t = r.team || '미분류';
    const badge = creativeTypeBadge(r.creativeType);
    return '<tr data-team="' + t + '" data-person="' + esc(r.person||'') + '" data-product="' + esc(r.product||'') + '" data-name="' + esc(r.name) + '" style="cursor:pointer" title="클릭하면 일자별 성과 확인">'
      + '<td class="rank left">' + (i+1) + '</td>'
      + '<td class="left">' + (badge ? badge + ' ' : '') + esc(r.name) + '</td>'
      + '<td class="left">' + esc(r.person || '-') + '</td>'
      + '<td>' + fmtW(r.spend) + '</td>'
      + '<td>' + fmtK(r.purchases) + '건</td>'
      + '<td>' + fmtW(r.val) + '</td>'
      + '<td><span class="' + roasCls(r.roas) + '">' + fmtR(r.roas) + '</span></td>'
      + '<td>' + r.ctr.toFixed(2) + '%</td>'
      + '<td>' + r.cvr.toFixed(2) + '%</td>'
      + '<td>' + fmtCPA(r.cpa) + '</td>'
      + '</tr>';
  }).join(''));
  const aTotSpend = display.reduce((s,r)=>s+r.spend,0);
  const aTotPurchases = display.reduce((s,r)=>s+r.purchases,0);
  const aTotVal = display.reduce((s,r)=>s+r.val,0);
  const aTotImpr = display.reduce((s,r)=>s+(r.impr||0),0);
  const aTotClicks = display.reduce((s,r)=>s+(r.clicks||0),0);
  const aTotRoas = aTotSpend>0 ? aTotVal/aTotSpend*100 : 0;
  const aTotCtr = aTotImpr>0 ? aTotClicks/aTotImpr*100 : 0;
  const aTotCvr = aTotClicks>0 ? aTotPurchases/aTotClicks*100 : 0;
  const aTotCpa = aTotPurchases>0 ? aTotSpend/aTotPurchases : 0;
  setFoot('f-ad', '<tr>'
    +'<td colspan="3" style="padding-left:16px">TOTAL <span style="font-size:11px;opacity:.6">('+display.length+'건)</span></td>'
    +'<td>'+fmtW(aTotSpend)+'</td>'
    +'<td>'+fmtK(aTotPurchases)+'건</td>'
    +'<td>'+fmtW(aTotVal)+'</td>'
    +'<td><span class="'+roasCls(aTotRoas)+'">'+fmtR(aTotRoas)+'</span></td>'
    +'<td>'+aTotCtr.toFixed(2)+'%</td>'
    +'<td>'+aTotCvr.toFixed(2)+'%</td>'
    +'<td>'+fmtCPA(aTotCpa)+'</td>'
    +'</tr>');
}

function renderPerson(rows) {
  const { col = 'spend', dir = -1 } = sortState['b-person'] || {};
  const sorted = sortRows(rows, col, dir);
  const total = rows.reduce((s, r) => s + r.val, 0);
  setBody('b-person', sorted.map((r, i) => {
    const t = r.team || '미분류';
    const barPct = total > 0 ? Math.round(r.val / total * 100) : 0;
    return '<tr data-team="' + t + '" data-person="' + esc(r.name) + '">'
      + '<td class="rank left">' + (i+1) + '</td>'
      + '<td class="name left">' + esc(r.name) + '</td>'
      + '<td class="left">' + teamChip(t) + '</td>'
      + '<td>' + fmtW(r.spend) + '</td>'
      + '<td>' + fmtK(r.purchases) + '건</td>'
      + '<td>' + fmtW(r.val) + '</td>'
      + '<td><span class="' + roasCls(r.roas) + '">' + fmtR(r.roas) + '</span></td>'
      + '<td><div class="bar-wrap"><span style="font-size:12px">' + fmtPct(r.share) + '</span>'
      + '<div class="bar-bg"><div class="bar-fill" style="width:' + barPct + '%"></div></div></div></td>'
      + '</tr>';
  }).join(''));
  const pTotSpend = sorted.reduce((s,r)=>s+r.spend,0);
  const pTotPurchases = sorted.reduce((s,r)=>s+r.purchases,0);
  const pTotVal = sorted.reduce((s,r)=>s+r.val,0);
  const pTotRoas = pTotSpend>0 ? pTotVal/pTotSpend*100 : 0;
  setFoot('f-person', '<tr>'
    +'<td colspan="3" style="padding-left:16px">TOTAL <span style="font-size:11px;opacity:.6">('+sorted.length+'명)</span></td>'
    +'<td>'+fmtW(pTotSpend)+'</td>'
    +'<td>'+fmtK(pTotPurchases)+'건</td>'
    +'<td>'+fmtW(pTotVal)+'</td>'
    +'<td><span class="'+roasCls(pTotRoas)+'">'+fmtR(pTotRoas)+'</span></td>'
    +'<td>100%</td>'
    +'</tr>');
}

// ── Row Filtering ─────────────────────────────────────────
function applyRowFilters() {
  const data = PERIODS[curPeriod];
  const eTeam = data ? effectiveTeam(data) : curTeam;

  // 소재별 테이블은 이미 filteredAds()로 필터링된 데이터만 렌더됨
  // 캠페인/담당자/품목 테이블도 각 getFiltered*() 함수로 처리됨
  // 여기서는 추가 DOM 숨기기 불필요 (reNumber만 목적)
}

function reNumber() {
  document.querySelectorAll('#main tbody').forEach(tbody => {
    let n = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.style.display !== 'none') {
        n++;
        const rankCell = tr.querySelector('.rank');
        if (rankCell) rankCell.textContent = n;
      }
    });
  });
}

// ── Campaign Creative Expand ──────────────────────────────
function toggleCampAds(btn, e) {
  e.stopPropagation();
  const campName = btn.dataset.camp;
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  const existing = tbody.querySelectorAll('[data-camp-sub="' + CSS.escape(campName) + '"]');
  if (existing.length) {
    existing.forEach(r => r.remove());
    btn.classList.remove('open');
    btn.textContent = '▶';
    tr.classList.remove('camp-expanded');
    return;
  }
  btn.classList.add('open');
  btn.textContent = '▼';
  tr.classList.add('camp-expanded');

  // today 모드: 시간대별 드릴다운
  if (todayMode) {
    if (!todayData || !todayData.byHourPerCampaign) { btn.classList.remove('open'); btn.textContent = '▶'; tr.classList.remove('camp-expanded'); return; }
    const hours = todayData.byHourPerCampaign[campName] || [];
    if (!hours.length) { btn.classList.remove('open'); btn.textContent = '▶'; tr.classList.remove('camp-expanded'); return; }
    const subHtml = hours.map((h, i) => {
      const prev = i > 0 ? hours[i-1] : null;
      return '<tr data-camp-sub="' + esc(campName) + '" class="camp-sub-row">'
        + '<td></td>'
        + '<td class="left" style="padding-left:24px;color:#6a7a9a;font-size:13px">' + h.hour + '</td>'
        + '<td>' + fmtW(h.spend) + deltaStr(h.spend, prev && prev.spend, fmtW) + '</td>'
        + '<td>' + fmtK(Math.round(h.purchases)) + '건' + deltaStr(h.purchases, prev && prev.purchases, n => fmtK(Math.round(n)) + '건') + '</td>'
        + '<td>' + fmtW(h.val) + deltaStr(h.val, prev && prev.val, fmtW) + '</td>'
        + '<td><span class="' + roasCls(h.roas) + '">' + fmtR(h.roas) + '</span>' + deltaRoasStr(h.roas, prev && prev.roas) + '</td>'
        + '<td></td><td></td><td></td><td></td>'
        + '</tr>';
    }).join('');
    tr.insertAdjacentHTML('afterend', subHtml);
    return;
  }

  const data = PERIODS[curPeriod];
  if (!data) return;
  // filteredAds 사용 → 현재 activeDate·품목·담당자·팀 필터와 동일한 소스 (캠페인 행 합계와 일치)
  const ads = filteredAds(data)
    .filter(a => a.campName === campName)
    .sort((a, b) => b.spend - a.spend);
  if (!ads.length) {
    btn.classList.remove('open');
    btn.textContent = '▶';
    tr.classList.remove('camp-expanded');
    alert('이 기간에 소재 데이터가 없습니다. 최근 기간을 선택해주세요.');
    return;
  }
  const subHtml = ads.map(a => {
    const p = parseAdName(a.name || '');
    const badge = creativeTypeBadge(p.creativeType);
    const ctr = (a.impr || 0) > 0 ? a.clicks / a.impr * 100 : 0;
    const cvr = (a.clicks || 0) > 0 ? a.purchases / a.clicks * 100 : 0;
    const cpa = a.purchases > 0 ? a.spend / a.purchases : 0;
    return '<tr data-camp-sub="' + esc(campName) + '" class="camp-sub-row">'
      + '<td></td>'
      + '<td class="left" style="padding-left:24px;white-space:nowrap">' + badge
      + ' <span class="sub-name" title="' + esc(a.name) + '">' + esc(a.name || '') + '</span>'
      + ' <span class="sub-person">' + esc(a.person || '') + '</span></td>'
      + '<td>' + fmtW(a.spend) + '</td>'
      + '<td>' + fmtK(a.purchases) + '건</td>'
      + '<td>' + fmtW(a.val) + '</td>'
      + '<td><span class="' + roasCls(a.roas) + '">' + fmtR(a.roas) + '</span></td>'
      + '<td>' + ctr.toFixed(2) + '%</td>'
      + '<td>' + cvr.toFixed(2) + '%</td>'
      + '<td>' + fmtCPA(cpa) + '</td>'
      + '<td></td>'
      + '</tr>';
  }).join('');
  tr.insertAdjacentHTML('afterend', subHtml);
}

function toggleProductDates(btn, e) {
  e.stopPropagation();
  const productName = btn.dataset.product;
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  const existing = tbody.querySelectorAll('[data-product-sub="' + CSS.escape(productName) + '"]');
  if (existing.length) {
    existing.forEach(r => r.remove());
    btn.classList.remove('open');
    btn.textContent = '▶';
    tr.classList.remove('camp-expanded');
    return;
  }
  btn.classList.add('open');
  btn.textContent = '▼';
  tr.classList.add('camp-expanded');

  // today 모드: 시간대별 드릴다운
  if (todayMode) {
    if (!todayData || !todayData.byHourPerProduct) { btn.classList.remove('open'); btn.textContent = '▶'; tr.classList.remove('camp-expanded'); return; }
    const hours = todayData.byHourPerProduct[productName] || [];
    if (!hours.length) { btn.classList.remove('open'); btn.textContent = '▶'; tr.classList.remove('camp-expanded'); return; }
    const subHtml = hours.map((h, i) => {
      const prev = i > 0 ? hours[i-1] : null;
      return '<tr data-product-sub="' + esc(productName) + '" class="camp-sub-row">'
        + '<td></td>'
        + '<td class="left" style="padding-left:24px;color:#6a7a9a;font-size:13px">' + h.hour + '</td>'
        + '<td>' + fmtW(h.spend) + deltaStr(h.spend, prev && prev.spend, fmtW) + '</td>'
        + '<td>' + fmtK(Math.round(h.purchases)) + '건' + deltaStr(h.purchases, prev && prev.purchases, n => fmtK(Math.round(n)) + '건') + '</td>'
        + '<td>' + fmtW(h.val) + deltaStr(h.val, prev && prev.val, fmtW) + '</td>'
        + '<td><span class="' + roasCls(h.roas) + '">' + fmtR(h.roas) + '</span>' + deltaRoasStr(h.roas, prev && prev.roas) + '</td>'
        + '<td></td><td></td>'
        + '</tr>';
    }).join('');
    tr.insertAdjacentHTML('afterend', subHtml);
    return;
  }

  const data = PERIODS[curPeriod];
  if (!data) return;
  const eff = getEffectiveData(data);
  const adDay = eff.adDay;
  if (!adDay) {
    btn.classList.remove('open');
    btn.textContent = '▶';
    tr.classList.remove('camp-expanded');
    alert('일자별 데이터는 어제/이번달/지난달/최근30일/최근7일 기간에서만 지원됩니다.');
    return;
  }

  const ads = filteredAds(data).filter(a => a.product === productName);
  if (!ads.length) { btn.classList.remove('open'); btn.textContent = '▶'; tr.classList.remove('camp-expanded'); return; }

  const dateMap = {};
  for (const a of ads) {
    const dayData = adDay[a.name] || {};
    for (const [date, d] of Object.entries(dayData)) {
      if (!d || !d.s) continue;
      if (!dateMap[date]) dateMap[date] = { spend: 0, purchases: 0, val: 0 };
      dateMap[date].spend += d.s;
      dateMap[date].purchases += d.p;
      dateMap[date].val += d.v;
    }
  }

  const dates = Object.keys(dateMap).sort();
  if (!dates.length) {
    btn.classList.remove('open');
    btn.textContent = '▶';
    tr.classList.remove('camp-expanded');
    alert('이 기간에 일자별 데이터가 없습니다. 최근 기간을 선택해주세요.');
    return;
  }

  const subHtml = dates.map((date, i) => {
    const d = dateMap[date];
    const prev = i > 0 ? dateMap[dates[i-1]] : null;
    const roas = d.spend > 0 ? d.val / d.spend * 100 : 0;
    const prevRoas = prev && prev.spend > 0 ? prev.val / prev.spend * 100 : null;
    const [, mm, dd] = date.split('-');
    const label = +mm + '/' + +dd;
    return '<tr data-product-sub="' + esc(productName) + '" class="camp-sub-row">'
      + '<td></td>'
      + '<td class="left" style="padding-left:24px;color:#6a7a9a;font-size:13px">' + label + '</td>'
      + '<td>' + fmtW(d.spend) + deltaStr(d.spend, prev && prev.spend, fmtW) + '</td>'
      + '<td>' + fmtK(d.purchases) + '건' + deltaStr(d.purchases, prev && prev.purchases, n => fmtK(n) + '건') + '</td>'
      + '<td>' + fmtW(d.val) + deltaStr(d.val, prev && prev.val, fmtW) + '</td>'
      + '<td><span class="' + roasCls(roas) + '">' + fmtR(roas) + '</span>' + deltaRoasStr(roas, prevRoas) + '</td>'
      + '<td></td><td></td>'
      + '</tr>';
  }).join('');
  tr.insertAdjacentHTML('afterend', subHtml);
}

function toggleTotalDates(btn, e) {
  e.stopPropagation();
  const tr = btn.closest('tr');
  const tfoot = tr.parentElement;
  const existing = tfoot.querySelectorAll('[data-product-sub="__total__"]');
  if (existing.length) {
    existing.forEach(r => r.remove());
    btn.classList.remove('open');
    btn.textContent = '▶';
    return;
  }
  btn.classList.add('open');
  btn.textContent = '▼';

  const data = PERIODS[curPeriod];
  if (!data) return;
  const days = getFilteredDaily(data);
  if (!days.length) {
    btn.classList.remove('open');
    btn.textContent = '▶';
    alert('이 기간에 일자별 데이터가 없습니다.');
    return;
  }

  const subHtml = days.map((d, i) => {
    const prev = i > 0 ? days[i-1] : null;
    const [, mm, dd] = d.date.split('-');
    const label = +mm + '/' + +dd;
    return '<tr data-product-sub="__total__" class="camp-sub-row">'
      + '<td></td>'
      + '<td class="left" style="padding-left:24px;color:#6a7a9a;font-size:13px">' + label + '</td>'
      + '<td>' + fmtW(d.spend) + deltaStr(d.spend, prev && prev.spend, fmtW) + '</td>'
      + '<td>' + fmtK(d.purchases) + '건' + deltaStr(d.purchases, prev && prev.purchases, n => fmtK(n) + '건') + '</td>'
      + '<td>' + fmtW(d.val) + deltaStr(d.val, prev && prev.val, fmtW) + '</td>'
      + '<td><span class="' + roasCls(d.roas) + '">' + fmtR(d.roas) + '</span>' + deltaRoasStr(d.roas, prev && prev.roas) + '</td>'
      + '<td></td><td></td>'
      + '</tr>';
  }).join('');
  tr.insertAdjacentHTML('afterend', subHtml);
}

// ── Start ─────────────────────────────────────────────────
boot();

// ── AI Chat ───────────────────────────────────────────────
const GROQ_KEY_LS = 'hmr_groq_key';
function getGeminiKey() { return localStorage.getItem(GROQ_KEY_LS) || ''; }
let aiHistory = [];

function toggleAI() {
  const panel = document.getElementById('ai-panel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) {
    if (!getGeminiKey()) { showKeySetup(); return; }
    const msgs = document.getElementById('ai-msgs');
    if (!msgs.children.length) {
      addAIMsg('ai', '안녕하세요 👋 현재 선택된 기간의 데이터를 기반으로 질문해 주세요.\\n\\n예시:\\n· "이번달 ROAS가 낮은 품목은 왜 그럴까?"\\n· "전환가치가 가장 높은 담당자는?"\\n· "지난달 대비 성과 비교해줘"');
    }
    updateAICtx();
    setTimeout(() => document.getElementById('ai-input').focus(), 80);
  }
}

function showKeySetup() {
  const msgs = document.getElementById('ai-msgs');
  msgs.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:10px';
  wrap.innerHTML = '<div style="font-size:13px;color:#1a2030;font-weight:600">Gemini API 키 입력</div>'
    + '<div style="font-size:12px;color:#8c96ae;line-height:1.6">aistudio.google.com에서 무료 발급 후 입력하세요. 이 기기에만 저장되며 서버로 전송되지 않습니다.</div>'
    + '<input id="ai-key-input" type="password" placeholder="gsk_..." style="border:1.5px solid #dce0ea;border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit;outline:none">'
    + '<button onclick="saveGeminiKey()" style="background:#4466cc;color:#fff;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer">저장 후 시작</button>';
  msgs.appendChild(wrap);
  setTimeout(() => document.getElementById('ai-key-input')?.focus(), 80);
}

function resetGeminiKey() {
  localStorage.removeItem(GROQ_KEY_LS);
  document.getElementById('ai-msgs').innerHTML = '';
  showKeySetup();
}

function saveGeminiKey() {
  const val = document.getElementById('ai-key-input')?.value.trim();
  if (!val) return;
  localStorage.setItem(GROQ_KEY_LS, val);
  document.getElementById('ai-msgs').innerHTML = '';
  addAIMsg('ai', '안녕하세요 👋 현재 선택된 기간의 데이터를 기반으로 질문해 주세요.\\n\\n예시:\\n· "이번달 ROAS가 낮은 품목은 왜 그럴까?"\\n· "전환가치가 가장 높은 담당자는?"\\n· "지난달 대비 성과 비교해줘"');
  updateAICtx();
  setTimeout(() => document.getElementById('ai-input').focus(), 80);
}

function updateAICtx() {
  const el = document.getElementById('ai-ctx');
  if (!el) return;
  const data = PERIODS[curPeriod];
  const label = data ? data.label : curPeriod;
  const prodLabel = curProducts.size ? (curProducts.size === 1 ? [...curProducts][0] : curProducts.size + '개 품목') : '';
  const filters = [curTeam, prodLabel, curPerson].filter(Boolean).join(' · ');
  el.textContent = '📅 ' + label + (filters ? '  |  🔍 ' + filters : '');
}

function addAIMsg(role, text) {
  const msgs = document.getElementById('ai-msgs');
  const el = document.createElement('div');
  el.className = 'ai-msg ' + role;
  el.textContent = text;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

function buildAIContext() {
  const data = PERIODS[curPeriod];
  if (!data) return '(데이터 없음)';
  const k = data.kpi;
  const fw = n => n >= 100000000 ? (n/100000000).toFixed(1)+'억원' : n >= 10000 ? Math.round(n/10000).toLocaleString()+'만원' : Math.round(n).toLocaleString()+'원';
  const fr = r => (r/100).toFixed(2);
  let ctx = '[선택 기간] ' + data.label + ' (' + data.start + ' ~ ' + data.end + ')\\n';
  ctx += '[전체 KPI] 광고비 ' + fw(k.spend) + ' | 전환수 ' + Math.round(k.purchases).toLocaleString() + '건 | 전환가치 ' + fw(k.val) + ' | ROAS ' + fr(k.roas) + '\\n';
  if (curTeam) ctx += '[팀 필터] ' + curTeam + '\\n';
  if (curProducts.size) ctx += '[품목 필터] ' + [...curProducts].join(', ') + '\\n';
  if (curPerson) ctx += '[담당자 필터] ' + curPerson + '\\n';
  const prods = data.byProduct || [];
  if (prods.length) {
    ctx += '\\n[품목별 성과]\\n';
    prods.slice(0, 12).forEach(p => {
      ctx += '  ' + p.name + ': 비용 ' + fw(p.spend) + ' / 전환가치 ' + fw(p.val) + ' / ROAS ' + fr(p.roas) + ' / 비중 ' + (p.share||0).toFixed(1) + '%\\n';
    });
  }
  const pers = data.byPerson || [];
  if (pers.length) {
    ctx += '\\n[담당자별 성과]\\n';
    pers.slice(0, 10).forEach(p => {
      ctx += '  ' + p.name + '(' + (p.team||'-') + '): 비용 ' + fw(p.spend) + ' / ROAS ' + fr(p.roas) + '\\n';
    });
  }
  const camps = data.byCamp || [];
  if (camps.length) {
    ctx += '\\n[캠페인별 성과 TOP5]\\n';
    camps.slice(0, 5).forEach(c => {
      ctx += '  ' + c.name + ': 비용 ' + fw(c.spend) + ' / ROAS ' + fr(c.roas) + '\\n';
    });
  }
  return ctx;
}

async function sendAI() {
  const key = getGeminiKey();
  if (!key) { showKeySetup(); return; }
  const input = document.getElementById('ai-input');
  const send  = document.getElementById('ai-send');
  const msg   = input.value.trim();
  if (!msg || send.disabled) return;
  input.value = '';
  addAIMsg('user', msg);
  const loading = addAIMsg('ai', '답변 생성 중');
  loading.classList.add('loading');
  send.disabled = true;
  aiHistory.push({ role: 'user', content: msg });
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: '당신은 한끼통살 메타 광고 성과 분석 어시스턴트입니다. 아래 데이터를 바탕으로 한국어로 간결하고 실용적으로 답변하세요. 수치는 원문 그대로 인용하세요.\\n\\n' + buildAIContext() },
          ...aiHistory.slice(-10)
        ]
      })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    const reply = json.choices?.[0]?.message?.content || '응답을 받지 못했습니다.';
    loading.textContent = reply;
    loading.classList.remove('loading');
    aiHistory.push({ role: 'assistant', content: reply });
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);
  } catch(e) {
    loading.textContent = '오류: ' + e.message;
    loading.classList.remove('loading');
    aiHistory.pop();
  }
  send.disabled = false;
  document.getElementById('ai-msgs').scrollTop = 99999;
}

// ── Pivot Analysis ─────────────────────────────────────────────
const METRIC_LABELS = { roas: 'ROAS', spend: '광고비', purchases: '전환수', val: '전환가치' };
let pvtMetricOrder = ['roas', 'spend'];
let pvtPeriodAKey  = 'lastMonth';
let pvtPeriodBKey  = 'thisMonth';
let pvtSortKey2    = '';
let pvtSortAsc2    = false;

function getPvtPeriodLabel(key) {
  const map = { yesterday: '어제', thisMonth: '이번달', lastMonth: '지난달', last30d: '최근30일', last7d: '최근7일' };
  if (map[key]) return map[key];
  const m = key.match(/^m(\\d{4})(\\d{2})$/);
  if (m) return m[1] + '년 ' + parseInt(m[2]) + '월';
  return key;
}

function pvtGetPeriodOptions() {
  const fixed = ['thisMonth', 'lastMonth', 'last30d', 'last7d', 'yesterday'];
  const monthly = Object.keys(PERIODS).filter(k => /^m\\d{6}$/.test(k) && PERIODS[k]?.adDay).sort().reverse();
  return [...new Set([...monthly, ...fixed])].filter(k => PERIODS[k]?.adDay);
}

function openPivot() {
  document.getElementById('pivot-overlay').style.display = 'flex';
  pvtInitPeriodSelects();
  renderPvtMetricList();
  const pSel = document.getElementById('pvt-f-person');
  pSel.innerHTML = '<option value="">담당자 전체</option>' + ALL_PERSONS.map(p => '<option>' + p + '</option>').join('');
  const prSel = document.getElementById('pvt-f-product');
  prSel.innerHTML = '<option value="">품목 전체</option>' + ALL_PRODUCTS.map(p => '<option>' + p + '</option>').join('');
  renderPivot();
}

function closePivot() {
  document.getElementById('pivot-overlay').style.display = 'none';
}

function pvtInitPeriodSelects() {
  const opts = pvtGetPeriodOptions();
  const base = opts.map(k => '<option value="' + k + '">' + getPvtPeriodLabel(k) + '</option>').join('');
  const full = base + '<option value="custom">직접 입력...</option>';
  ['pvt-pa', 'pvt-pb'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = full;
    const cur = idx === 0 ? pvtPeriodAKey : pvtPeriodBKey;
    sel.value = (opts.includes(cur) || cur === 'custom') ? cur : (opts[0] || '');
    pvtPeriodChange(idx === 0 ? 'a' : 'b');
  });
}

function pvtPeriodChange(ab) {
  const sel = document.getElementById('pvt-p' + ab);
  if (!sel) return;
  const isCustom = sel.value === 'custom';
  ['pvt-' + ab + 's', 'pvt-' + ab + 'e', 'pvt-' + ab + 'til'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isCustom ? '' : 'none';
  });
  if (ab === 'a') pvtPeriodAKey = sel.value;
  else pvtPeriodBKey = sel.value;
  if (!isCustom) renderPivot();
}

function pvtColChange() {
  const colDim = document.getElementById('pvt-col-sel')?.value;
  const bRow = document.getElementById('pvt-b-row');
  if (bRow) bRow.style.display = colDim === 'period' ? '' : 'none';
  renderPivot();
}

function pvtGetPeriodInfo(ab) {
  const key = ab === 'a' ? pvtPeriodAKey : pvtPeriodBKey;
  if (key === 'custom') {
    const s = document.getElementById('pvt-' + ab + 's')?.value;
    const e = document.getElementById('pvt-' + ab + 'e')?.value;
    if (!s || !e || s > e) return null;
    const ck = findContainingPeriod(s, e);
    if (ck && PERIODS[ck]?.adDay) return { p: PERIODS[ck], start: s, end: e, label: s.slice(5) + '~' + e.slice(5) };
    return null;
  }
  const p = PERIODS[key];
  if (!p?.adDay) return null;
  return { p, start: p.start, end: p.end, label: getPvtPeriodLabel(key) };
}

function renderPvtMetricList() {
  const list = document.getElementById('pvt-metric-list');
  if (!list) return;
  const labels = { roas: 'ROAS', spend: '광고비', purchases: '전환수', val: '전환가치' };
  list.innerHTML = pvtMetricOrder.map((m, i) => {
    const up = i > 0, dn = i < pvtMetricOrder.length - 1;
    return '<div class="pvt-m-item">' +
      '<span class="pvt-m-nm">' + (labels[m] || m) + '</span>' +
      '<div class="pvt-m-ctrl">' +
      '<button class="pvt-m-btn pvt-m-up" data-m="' + m + '" onclick="pvtMBtnClick(this)" ' + (up ? '' : 'disabled') + '>↑</button>' +
      '<button class="pvt-m-btn pvt-m-dn" data-m="' + m + '" onclick="pvtMBtnClick(this)" ' + (dn ? '' : 'disabled') + '>↓</button>' +
      '<button class="pvt-m-btn pvt-m-del" data-m="' + m + '" onclick="pvtMBtnClick(this)">×</button>' +
      '</div></div>';
  }).join('');
}

function pvtMBtnClick(btn) {
  const m = btn.dataset.m;
  if (btn.classList.contains('pvt-m-up'))  pvtMMove(m, -1);
  else if (btn.classList.contains('pvt-m-dn')) pvtMMove(m, 1);
  else pvtMRemove(m);
}

function pvtMMove(m, dir) {
  const i = pvtMetricOrder.indexOf(m);
  if (i < 0 || i + dir < 0 || i + dir >= pvtMetricOrder.length) return;
  pvtMetricOrder.splice(i, 1);
  pvtMetricOrder.splice(i + dir, 0, m);
  renderPvtMetricList();
  renderPivot();
}

function pvtMRemove(m) {
  if (pvtMetricOrder.length <= 1) return;
  pvtMetricOrder = pvtMetricOrder.filter(x => x !== m);
  renderPvtMetricList();
  renderPivot();
}

function pvtAddMetric(sel) {
  const m = sel.value;
  if (!m) return;
  if (!pvtMetricOrder.includes(m)) { pvtMetricOrder.push(m); renderPvtMetricList(); renderPivot(); }
  sel.value = '';
}

function renderPivot() {
  const rowDim   = document.getElementById('pvt-row-sel')?.value || 'name';
  const colDim   = document.getElementById('pvt-col-sel')?.value || 'period';
  const fPerson  = document.getElementById('pvt-f-person')?.value  || '';
  const fTeam    = document.getElementById('pvt-f-team')?.value    || '';
  const fProduct = document.getElementById('pvt-f-product')?.value || '';
  const sortM    = document.getElementById('pvt-sort-metric')?.value || 'roas';
  const sortDir  = parseInt(document.getElementById('pvt-sort-dir')?.value || '-1');
  const metrics  = pvtMetricOrder;
  const el       = document.getElementById('pvt-result');

  if (!metrics.length) { el.innerHTML = '<div class="pvt-empty">값 항목을 1개 이상 추가하세요.</div>'; return; }

  const fv = (m, v) => {
    if (!v) return '<span style="color:#ccc">-</span>';
    if (m === 'roas') return '<span class="' + roasCls(v) + '">' + fmtR(v) + '</span>';
    if (m === 'spend' || m === 'val') return fmtW(v);
    return fmtK(v) + '건';
  };
  const dimLabel = { name: '소재명', product: '품목', person: '담당자', campName: '캠페인', date: '날짜' };

  if (colDim === 'period') {
    // ── A vs B 기간 비교 모드 ──
    const piA = pvtGetPeriodInfo('a');
    const piB = pvtGetPeriodInfo('b');
    if (!piA) { el.innerHTML = '<div class="pvt-empty">기간 A 데이터가 없습니다.<br>직접 입력 시 포함 기간이 있는 날짜를 선택하세요.</div>'; return; }
    if (!piB) { el.innerHTML = '<div class="pvt-empty">기간 B 데이터가 없습니다.</div>'; return; }

    const agg = (pi) => {
      const map = new Map();
      for (const ad of (pi.p.byAd || [])) {
        if (fPerson  && ad.person  !== fPerson)  continue;
        if (fTeam    && ad.team    !== fTeam)    continue;
        if (fProduct && ad.product !== fProduct) continue;
        const rk = rowDim === 'date' ? null : (ad[rowDim] || '미분류');
        if (rowDim === 'date') {
          for (const [dt, d] of Object.entries(pi.p.adDay[ad.name] || {})) {
            if (pi.start && dt < pi.start) continue;
            if (pi.end   && dt > pi.end)   continue;
            if (!map.has(dt)) map.set(dt, { spend: 0, purchases: 0, val: 0 });
            const row = map.get(dt); row.spend += d.s; row.purchases += d.p; row.val += d.v;
          }
        } else {
          if (!map.has(rk)) map.set(rk, { spend: 0, purchases: 0, val: 0 });
          const row = map.get(rk);
          for (const [dt, d] of Object.entries(pi.p.adDay[ad.name] || {})) {
            if (pi.start && dt < pi.start) continue;
            if (pi.end   && dt > pi.end)   continue;
            row.spend += d.s; row.purchases += d.p; row.val += d.v;
          }
        }
      }
      map.forEach(r => { r.roas = r.spend > 0 ? r.val / r.spend * 100 : 0; });
      return map;
    };

    const mapA = agg(piA), mapB = agg(piB);
    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    let rows = [...allKeys].map(k => ({ key: k, a: mapA.get(k), b: mapB.get(k) }))
      .sort((x, y) => ((y.b?.[sortM] ?? y.a?.[sortM] ?? 0) - (x.b?.[sortM] ?? x.a?.[sortM] ?? 0)) * sortDir);
    if (rowDim === 'date') rows.sort((a, b) => a.key.localeCompare(b.key) * sortDir);

    if (!rows.length) { el.innerHTML = '<div class="pvt-empty">조건에 맞는 데이터가 없습니다.</div>'; return; }

    const totA = { spend: 0, purchases: 0, val: 0, roas: 0 }, totB = { spend: 0, purchases: 0, val: 0, roas: 0 };
    rows.forEach(r => {
      if (r.a) { totA.spend += r.a.spend; totA.purchases += r.a.purchases; totA.val += r.a.val; }
      if (r.b) { totB.spend += r.b.spend; totB.purchases += r.b.purchases; totB.val += r.b.val; }
    });
    totA.roas = totA.spend > 0 ? totA.val / totA.spend * 100 : 0;
    totB.roas = totB.spend > 0 ? totB.val / totB.spend * 100 : 0;

    const ML = metrics.length;
    let html = '<div class="pvt-tbl-wrap"><table class="pvt-tbl"><thead><tr>';
    html += '<th class="row-h" rowspan="2">' + dimLabel[rowDim] + '</th>';
    html += '<th colspan="' + ML + '" style="text-align:center;background:#dde8ff;color:#3355bb;font-size:11px;font-weight:700;padding:6px 10px;border-right:2px solid #b0c4ef;position:sticky;top:0;z-index:3">A. ' + piA.label + '</th>';
    html += '<th colspan="' + ML + '" style="text-align:center;background:#fff3e0;color:#b45309;font-size:11px;font-weight:700;padding:6px 10px;position:sticky;top:0;z-index:3">B. ' + piB.label + '</th>';
    html += '</tr><tr>';
    for (let ci = 0; ci < 2; ci++) {
      const bg = ci === 0 ? 'background:#eef2ff' : 'background:#fff9f0';
      for (let mi = 0; mi < ML; mi++) {
        const m = metrics[mi];
        const sk = (ci === 0 ? 'a' : 'b') + ':' + m;
        const cls = pvtSortKey2 === sk ? (pvtSortAsc2 ? 'srt-a' : 'srt-d') : '';
        const brd = mi === ML - 1 && ci === 0 ? ';border-right:2px solid #b0c4ef' : '';
        html += '<th class="' + cls + '" style="' + bg + brd + '" data-sk="' + sk + '" onclick="pvtClickSort(this)">' + METRIC_LABELS[m] + '</th>';
      }
    }
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      const dispKey = rowDim === 'name' ? row.key.replace(/^\\d{6}_/, '') : row.key;
      html += '<tr><td class="row-cell" title="' + esc(row.key) + '" data-dim="' + rowDim + '" data-key="' + esc(row.key) + '" onclick="pvtDrillRow(this)">' + esc(dispKey) + '</td>';
      for (let ci = 0; ci < 2; ci++) {
        const d = ci === 0 ? row.a : row.b;
        for (let mi = 0; mi < ML; mi++) {
          const m = metrics[mi];
          const brd = mi === ML - 1 && ci === 0 ? 'border-right:2px solid #dde8ff' : '';
          html += '<td style="' + brd + '">' + fv(m, d?.[m] ?? 0) + '</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody><tfoot><tr><td class="row-cell">합계</td>';
    for (let ci = 0; ci < 2; ci++) {
      const tot = ci === 0 ? totA : totB;
      for (let mi = 0; mi < ML; mi++) {
        const brd = mi === ML - 1 && ci === 0 ? 'border-right:2px solid #b0c4ef' : '';
        html += '<td style="' + brd + '">' + fv(metrics[mi], tot[metrics[mi]] ?? 0) + '</td>';
      }
    }
    html += '</tr></tfoot></table></div>';
    el.innerHTML = '<div style="font-size:12px;color:#9aa0b4;margin-bottom:8px">' + rows.length + '행 · A: ' + piA.label + ' vs B: ' + piB.label + (fPerson ? ' · 담당자: ' + fPerson : '') + (fTeam ? ' · 팀: ' + fTeam : '') + (fProduct ? ' · 품목: ' + fProduct : '') + '</div>' + html;

  } else {
    // ── 차원 교차 분석 모드 (기간 A × colDim) ──
    const piA = pvtGetPeriodInfo('a');
    if (!piA) { el.innerHTML = '<div class="pvt-empty">기간 A 데이터가 없습니다.</div>'; return; }
    if (rowDim === colDim) { el.innerHTML = '<div class="pvt-empty">행과 열 기준이 동일합니다. 다른 조합을 선택하세요.</div>'; return; }

    const colVals = [], colSet = new Set();
    for (const ad of (piA.p.byAd || [])) {
      if (fPerson  && ad.person  !== fPerson)  continue;
      if (fTeam    && ad.team    !== fTeam)    continue;
      if (fProduct && ad.product !== fProduct) continue;
      const cv = ad[colDim] || '미분류';
      if (!colSet.has(cv)) { colSet.add(cv); colVals.push(cv); }
    }
    if (!colVals.length) { el.innerHTML = '<div class="pvt-empty">데이터가 없습니다.</div>'; return; }

    const rowMap = new Map();
    for (const ad of (piA.p.byAd || [])) {
      if (fPerson  && ad.person  !== fPerson)  continue;
      if (fTeam    && ad.team    !== fTeam)    continue;
      if (fProduct && ad.product !== fProduct) continue;
      const ck = ad[colDim] || '미분류';
      const days = piA.p.adDay[ad.name] || {};
      if (rowDim === 'date') {
        for (const [dt, d] of Object.entries(days)) {
          if (piA.start && dt < piA.start) continue;
          if (piA.end   && dt > piA.end)   continue;
          if (!rowMap.has(dt)) rowMap.set(dt, { key: dt });
          const row = rowMap.get(dt);
          if (!row[ck]) row[ck] = { spend: 0, purchases: 0, val: 0 };
          row[ck].spend += d.s; row[ck].purchases += d.p; row[ck].val += d.v;
        }
      } else {
        const rk = ad[rowDim] || '미분류';
        if (!rowMap.has(rk)) rowMap.set(rk, { key: rk });
        const row = rowMap.get(rk);
        if (!row[ck]) row[ck] = { spend: 0, purchases: 0, val: 0 };
        for (const [dt, d] of Object.entries(days)) {
          if (piA.start && dt < piA.start) continue;
          if (piA.end   && dt > piA.end)   continue;
          row[ck].spend += d.s; row[ck].purchases += d.p; row[ck].val += d.v;
        }
      }
    }
    rowMap.forEach(row => colVals.forEach(cv => { if (row[cv]) row[cv].roas = row[cv].spend > 0 ? row[cv].val / row[cv].spend * 100 : 0; }));

    let rows = [...rowMap.values()].sort((a, b) => {
      const av = colVals.reduce((s, cv) => s + (a[cv]?.[sortM] ?? 0), 0);
      const bv = colVals.reduce((s, cv) => s + (b[cv]?.[sortM] ?? 0), 0);
      return (bv - av) * sortDir;
    });
    if (rowDim === 'date') rows.sort((a, b) => a.key.localeCompare(b.key) * sortDir);
    if (!rows.length) { el.innerHTML = '<div class="pvt-empty">조건에 맞는 데이터가 없습니다.</div>'; return; }

    const ML = metrics.length, CL = colVals.length;
    let html = '<div class="pvt-tbl-wrap"><table class="pvt-tbl"><thead><tr>';
    html += '<th class="row-h" rowspan="2">' + dimLabel[rowDim] + '</th>';
    colVals.forEach((cv, ci) => {
      const brd = ci < CL - 1 ? 'border-right:2px solid #dde8ff' : '';
      html += '<th colspan="' + ML + '" style="text-align:center;background:#eef2ff;color:#4466cc;font-size:11px;font-weight:700;padding:5px 8px;position:sticky;top:0;z-index:3;' + brd + '">' + esc(cv) + '</th>';
    });
    html += '</tr><tr>';
    colVals.forEach((cv, ci) => {
      for (let mi = 0; mi < ML; mi++) {
        const m = metrics[mi];
        const sk = cv + ':' + m;
        const cls = pvtSortKey2 === sk ? (pvtSortAsc2 ? 'srt-a' : 'srt-d') : '';
        const brd = mi === ML - 1 && ci < CL - 1 ? 'border-right:2px solid #dde8ff' : '';
        html += '<th class="' + cls + '" style="background:#f8f9fe;' + brd + '" data-sk="' + sk + '" onclick="pvtClickSort(this)">' + METRIC_LABELS[m] + '</th>';
      }
    });
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      const dispKey = rowDim === 'name' ? row.key.replace(/^\\d{6}_/, '') : row.key;
      html += '<tr><td class="row-cell" title="' + esc(row.key) + '" data-dim="' + rowDim + '" data-key="' + esc(row.key) + '" onclick="pvtDrillRow(this)">' + esc(dispKey) + '</td>';
      colVals.forEach((cv, ci) => {
        const d = row[cv];
        for (let mi = 0; mi < ML; mi++) {
          const brd = mi === ML - 1 && ci < CL - 1 ? 'border-right:1px solid #e8ecf4' : '';
          html += '<td style="' + brd + '">' + fv(metrics[mi], d?.[metrics[mi]] ?? 0) + '</td>';
        }
      });
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    el.innerHTML = '<div style="font-size:12px;color:#9aa0b4;margin-bottom:8px">' + rows.length + '행 · ' + dimLabel[rowDim] + ' × ' + dimLabel[colDim] + ' · ' + piA.label + (fPerson ? ' · 담당자: ' + fPerson : '') + (fTeam ? ' · 팀: ' + fTeam : '') + (fProduct ? ' · 품목: ' + fProduct : '') + '</div>' + html;
  }
}

function pvtClickSort(th) {
  const sk = th.dataset.sk;
  if (pvtSortKey2 === sk) pvtSortAsc2 = !pvtSortAsc2;
  else { pvtSortKey2 = sk; pvtSortAsc2 = false; }
  const m = sk.split(':').pop();
  const metricEl = document.getElementById('pvt-sort-metric');
  const dirEl    = document.getElementById('pvt-sort-dir');
  if (metricEl) metricEl.value = m;
  if (dirEl)    dirEl.value = pvtSortAsc2 ? '1' : '-1';
  renderPivot();
}

function pvtDrillRow(el) {
  const dim = el?.dataset?.dim;
  const key = el?.dataset?.key;
  if (!key || (dim !== 'name' && dim !== 'campName')) return;
  const pk = pvtPeriodBKey !== 'custom' ? pvtPeriodBKey : (pvtPeriodAKey !== 'custom' ? pvtPeriodAKey : null);
  if (pk && PERIODS[pk]) { curPeriod = pk; activeDateRange = null; activeDate = null; }
  closePivot();
  openDrilldown(dim === 'name' ? 'ad' : 'camp', key);
}

function exportPivotCsv() {
  const tbl = document.querySelector('.pvt-tbl');
  if (!tbl) return;
  const rows = [...tbl.querySelectorAll('tr')];
  const csv = rows.map(r => [...r.querySelectorAll('th,td')].map(c => '"' + c.textContent.trim().replace(/"/g, '""') + '"').join(',')).join('\\n');
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pivot_' + TODAY + '.csv'; a.click();
}
</script>

<!-- ── Pivot Analysis Panel ── -->
<div id="pivot-overlay">
  <div class="pvt-header">
    <button class="pvt-back" onclick="closePivot()">← 대시보드</button>
    <span class="pvt-header-title">📊 피벗 분석</span>
    <button class="pvt-act-btn pvt-csv" onclick="exportPivotCsv()">CSV 내보내기</button>
    <button class="pvt-act-btn pvt-run" onclick="renderPivot()">적용</button>
  </div>
  <div class="pvt-builder">
    <!-- 기간 A / B -->
    <div class="pvt-sec" style="min-width:310px">
      <div class="pvt-sec-lbl">기간</div>
      <div class="pvt-period-row">
        <span class="pvt-ab pvt-a">A</span>
        <select id="pvt-pa" class="pvt-fsel" style="flex:1" onchange="pvtPeriodChange('a')"></select>
        <input type="date" id="pvt-as" class="pvt-fsel pvt-cdt" style="display:none">
        <span id="pvt-atil" style="display:none;color:#aaa;flex-shrink:0">~</span>
        <input type="date" id="pvt-ae" class="pvt-fsel pvt-cdt" style="display:none" onchange="renderPivot()">
      </div>
      <div class="pvt-period-row" id="pvt-b-row" style="margin-top:6px">
        <span class="pvt-ab pvt-b">B</span>
        <select id="pvt-pb" class="pvt-fsel" style="flex:1" onchange="pvtPeriodChange('b')"></select>
        <input type="date" id="pvt-bs" class="pvt-fsel pvt-cdt" style="display:none">
        <span id="pvt-btil" style="display:none;color:#aaa;flex-shrink:0">~</span>
        <input type="date" id="pvt-be" class="pvt-fsel pvt-cdt" style="display:none" onchange="renderPivot()">
      </div>
    </div>
    <!-- 행 / 열 기준 -->
    <div class="pvt-sec" style="min-width:170px">
      <div class="pvt-sec-lbl">행 / 열 기준</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="pvt-dim-lbl">행</span>
          <select id="pvt-row-sel" class="pvt-fsel" style="flex:1" onchange="renderPivot()">
            <option value="name">소재명</option>
            <option value="product">품목</option>
            <option value="person">담당자</option>
            <option value="campName">캠페인</option>
            <option value="date">날짜</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="pvt-dim-lbl">열</span>
          <select id="pvt-col-sel" class="pvt-fsel" style="flex:1" onchange="pvtColChange()">
            <option value="period">기간 A vs B</option>
            <option value="product">품목</option>
            <option value="person">담당자</option>
            <option value="campName">캠페인</option>
          </select>
        </div>
      </div>
    </div>
    <!-- 값 항목 (순서 변경 가능) -->
    <div class="pvt-sec" style="min-width:165px">
      <div class="pvt-sec-lbl">값 항목 <span style="font-size:10px;color:#c8cedc;font-weight:500">↕ 순서 변경</span></div>
      <div id="pvt-metric-list"></div>
      <select id="pvt-add-metric" class="pvt-fsel" style="margin-top:6px" onchange="pvtAddMetric(this)">
        <option value="">+ 항목 추가</option>
        <option value="roas">ROAS</option>
        <option value="spend">광고비</option>
        <option value="purchases">전환수</option>
        <option value="val">전환가치</option>
      </select>
    </div>
    <!-- 필터 -->
    <div class="pvt-sec" style="min-width:140px">
      <div class="pvt-sec-lbl">필터</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        <select id="pvt-f-person" class="pvt-fsel" onchange="renderPivot()"></select>
        <select id="pvt-f-team" class="pvt-fsel" onchange="renderPivot()">
          <option value="">팀 전체</option>
          <option value="1팀">1팀</option>
          <option value="2팀">2팀</option>
        </select>
        <select id="pvt-f-product" class="pvt-fsel" onchange="renderPivot()"></select>
      </div>
    </div>
    <!-- 정렬 -->
    <div class="pvt-sec" style="min-width:120px">
      <div class="pvt-sec-lbl">정렬 기준</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        <select id="pvt-sort-metric" class="pvt-fsel" onchange="renderPivot()">
          <option value="roas">ROAS</option>
          <option value="spend">광고비</option>
          <option value="purchases">전환수</option>
          <option value="val">전환가치</option>
        </select>
        <select id="pvt-sort-dir" class="pvt-fsel" onchange="renderPivot()">
          <option value="-1">내림차순</option>
          <option value="1">오름차순</option>
        </select>
      </div>
    </div>
  </div>
  <div class="pvt-body">
    <div id="pvt-result"></div>
  </div>
</div>

<button id="ai-btn" onclick="toggleAI()" title="AI 분석 어시스턴트">✦</button>
<div id="ai-panel">
  <div id="ai-ph">
    <span class="ai-ph-title">✦ AI 분석 어시스턴트</span>
    <div style="display:flex;gap:4px;align-items:center">
      <button class="ai-ph-close" onclick="resetGeminiKey()" title="API 키 변경" style="font-size:13px">🔑</button>
      <button class="ai-ph-close" onclick="toggleAI()">×</button>
    </div>
  </div>
  <div id="ai-ctx"></div>
  <div id="ai-msgs"></div>
  <div id="ai-input-row">
    <input id="ai-input" placeholder="데이터에 대해 질문해보세요..." onkeydown="if(event.key==='Enter'){event.preventDefault();sendAI()}">
    <button id="ai-send" onclick="sendAI()">전송</button>
  </div>
</div>
</body>
</html>`;
}
