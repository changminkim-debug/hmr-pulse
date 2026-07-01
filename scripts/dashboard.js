import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDashboardHTML } from "./dashboard-template.js";
import { deployToPages } from "./deploy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSV_PATH = path.resolve(__dirname, "../../../60-HMR-mrk/meta/data/raw_ad_daily_2023_2026.csv");
const CI_MODE = process.env.CI_MODE === "true";
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "dashboard.html");

// CSV column indices (0-based) — based on actual data rows
const CI = {
  date: 4, adName: 5, campId: 6, campName: 7,
  adsetId: 8, adsetName: 9, adId: 10,
  spend: 12, impr: 13, clicks: 15,
  purchases: 18, c1val: 20, c7val: 21,
  person: 23, product: 24, team: 25,
};

// ── Helpers ──────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }
function nowKST() { return new Date(Date.now() + 9 * 3600000); }
function ds(t) {
  const d = t instanceof Date ? t : new Date(t);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}
function shiftDays(n) { return new Date(Date.now() + 9 * 3600000 + n * 86400000); }

function csvEscape(v) {
  const s = String(v ?? "");
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ── CSV Parser ────────────────────────────────────────────
function parseLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function loadCSV() {
  console.log("[dashboard] CSV 로드:", CSV_PATH);
  const lines = fs.readFileSync(CSV_PATH, "utf8").split("\n");
  const records = [];
  for (let i = 3; i < lines.length; i++) {      // skip 3 header rows
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseLine(line);
    if (cols.length < 25) continue;
    const date = cols[CI.date]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const adName = cols[CI.adName]?.trim() || "";
    const cleanAdName = adName.replace(/^\*+/, "");  // *** prefix 제거
    let product = cols[CI.product]?.trim() || "";
    // product 컬럼 비어있으면 adName 코드로 추출
    if (!product) {
      const pm = cleanAdName.match(/^\d{6}_([A-Z]+)_/);
      if (pm && PRODUCT_CODE_MAP[pm[1]]) product = PRODUCT_CODE_MAP[pm[1]].name;
    }
    product = PRODUCT_NORMALIZE[product] || product || "미분류";
    records.push({
      date,
      adName,
      campId:   cols[CI.campId]?.trim()   || "",
      campName: cols[CI.campName]?.trim() || "",
      adsetId:  cols[CI.adsetId]?.trim()  || "",
      adsetName:cols[CI.adsetName]?.trim()|| "",
      adId:     cols[CI.adId]?.trim()     || "",
      spend:    parseFloat(cols[CI.spend])    || 0,
      impr:     parseInt(cols[CI.impr])       || 0,
      clicks:   parseFloat(cols[CI.clicks])   || 0,
      purchases:parseFloat(cols[CI.purchases]) || parseFloat(cols[16]) || 0,
      c7val:    parseFloat(cols[CI.c7val])    || parseFloat(cols[19]) || 0,
      // 2023~2024: c1val 없으면 c7val로 fallback / 2025~: c1val 고정 (1일 클릭 통일)
      c1val:    parseInt(date.slice(0,4)) < 2025
                  ? (parseFloat(cols[CI.c1val]) || parseFloat(cols[CI.c7val]) || parseFloat(cols[19]) || 0)
                  : (parseFloat(cols[CI.c1val]) || 0),
      person:   cols[CI.person]?.trim()  || "담당자 미확인",
      product,
      team:     PRODUCT_NAME_TEAM[product] || cols[CI.team]?.trim() || "미분류",
    });
  }
  // adId + date 기준 중복 제거
  const seen = new Set();
  const deduped = records.filter(r => {
    const key = r.adId + '|' + r.date;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length !== records.length)
    console.log(`[dashboard] 중복 제거: ${records.length - deduped.length}행 제거 → ${deduped.length}행`);
  else
    console.log(`[dashboard] ${deduped.length}행 로드`);
  return deduped;
}

// ── 하드코딩된 분류 맵 ────────────────────────────────────
const PRODUCT_CODE_MAP = {
  // 1팀 상품
  HCP: { name: "크리스피닭가슴살", team: "1팀" },
  HKBB: { name: "김자반밥바", team: "1팀" },
  HSL: { name: "닭다리", team: "1팀" },
  HCPL: { name: "크리스피닭다리", team: "1팀" },
  HCPT: { name: "크리스피안심", team: "1팀" },
  HTR: { name: "안심폭탄볶음밥", team: "1팀" },
  HEVENT: { name: "이벤트", team: "1팀" },
  // 2팀 상품
  HDG: { name: "닭가슴살", team: "1팀" },
  HGD: { name: "그릴드닭가슴살", team: "2팀" },
  HG: { name: "그릴드닭가슴살", team: "2팀" },
  HFMS: { name: "마녀스프", team: "2팀" },
  HMS: { name: "마녀스프", team: "2팀" },
  HSM: { name: "마녀스프", team: "2팀" },
  HRL: { name: "닭양롤", team: "2팀" },
  HMX: { name: "비엔나", team: "2팀" },
  HSSD: { name: "슬라이스", team: "2팀" },
  HKOG: { name: "칼집오븐닭가슴살", team: "2팀" },
  HDB: { name: "닭가슴살볼", team: "2팀" },
  HTG: { name: "통살그릴드혼합", team: "1팀" },
};

// 기존 product 컬럼값 → team 보정용 맵
const PRODUCT_NAME_TEAM = Object.fromEntries(
  Object.values(PRODUCT_CODE_MAP).map(v => [v.name, v.team])
);
// 레거시 product 명칭도 포함
Object.assign(PRODUCT_NAME_TEAM, {
  "크리스피닭가슴살": "1팀", "크리스피닭다리": "1팀", "크리스피안심": "1팀",
  "크리스피": "1팀", "크리스피치킨": "1팀",
  "닭가슴살": "1팀", "블랙페퍼닭가슴살": "2팀",
  "실온마녀스프": "2팀", "칼집오븐구이": "2팀", "슬림슬라이스": "2팀",
  "슬라이스닭가슴살": "2팀", "주먹밥": "2팀",
  "이벤트": "1팀",
  "소스통살": "1팀",
  "닭다리": "1팀",
});

// 구 product명 → 현행 product명 정규화 (CSV 레거시 행 대응)
const PRODUCT_NORMALIZE = {
  "소스통살": "닭가슴살",
  "순살닭다리살": "닭다리",
  "닭다리살(순살)": "닭다리",
  "닭다리살": "닭다리",
  "크리스피치킨": "크리스피닭가슴살",
  "크리스피": "크리스피닭가슴살",
};

const PERSON_INITIAL_MAP = {
  ahi: "안혜인", chy: "천혜영", ljh: "이지현", gyl: "간유림",
  jhr: "정혜림", yhk: "유하경", lyg: "이윤관", sck: "신치경",
  ksr: "김승룡", ysy: "양서영", ose: "오서이", ksg: "김선길",
  bye: "배영언", psh: "박시현", jbm: "정보미", jjy: "장지영",
  kgl: "김건리", cjs: "최진성", kjy: "강주이", khr: "강혜린",
  egc: "어경찬", sys: "송예서",
};

function buildLookups(records) {
  // 하드코딩 맵 우선, CSV에서 미등록 코드/이니셜만 보완
  const productMap = Object.fromEntries(Object.entries(PRODUCT_CODE_MAP).map(([k, v]) => [k, v.name]));
  const personMap = { ...PERSON_INITIAL_MAP };
  for (const r of records) {
    if (r.product !== "미분류") {
      const pm = r.adName.match(/^\d{6}_([A-Z]+)_/);
      if (pm && !productMap[pm[1]]) productMap[pm[1]] = r.product;
    }
    if (r.person !== "담당자 미확인") {
      const im = r.adName.match(/_([a-z]{2,4})_(?:og|DRT|intern|v[0-9]|prod)/i)
               || r.adName.match(/_([a-z]{2,4})(?:\()/);
      if (im && !personMap[im[1].toLowerCase()]) personMap[im[1].toLowerCase()] = r.person;
    }
  }
  return { productMap, personMap };
}

function parseAdMeta(adName, productMap, personMap) {
  let product = "미분류", person = "담당자 미확인";
  const pm = adName.replace(/^\*+/, "").match(/^\d{6}_([A-Z]+)_/);
  if (pm && productMap[pm[1]]) product = productMap[pm[1]];
  const im = adName.match(/_([a-z]{2,4})_(?:og|DRT|intern|v[0-9]|prod)/i)
           || adName.match(/_([a-z]{2,4})(?:\()/);
  if (im && personMap[im[1].toLowerCase()]) person = personMap[im[1].toLowerCase()];
  return { product, person };
}

// ── Meta API: fetch new ad-level daily data ───────────────
const GV = "v21.0";

async function fetchJson(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.error) return json;
    if (i < attempts - 1 && [1, 2, 4, 17, 32].includes(json.error.code)) {
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    throw new Error("Meta API: " + json.error.message);
  }
}

async function fetchPaged(baseUrl, params, token) {
  const all = [];
  let next = baseUrl + "?" + new URLSearchParams({ ...params, access_token: token });
  while (next) {
    const json = await fetchJson(next);
    all.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return all;
}

function extractVal(arr, win) {
  return (arr || [])
    .filter(a => a.action_type === "offsite_conversion.fb_pixel_purchase")
    .reduce((s, a) => s + parseFloat(a[win] || 0), 0);
}

async function fetchNewAdRows(since, until) {
  const ids = (process.env.META_AD_ACCOUNT_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  const token = process.env.META_ACCESS_TOKEN;
  if (!ids.length || !token) throw new Error("META token 미설정");

  const TEAM_MAP = { "906987379684182": "1팀", "1723779808065856": "2팀" };
  const rows = [];
  for (const id of ids) {
    const data = await fetchPaged(
      `https://graph.facebook.com/${GV}/act_${id}/insights`,
      {
        level: "ad",
        fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,action_values",
        time_range: JSON.stringify({ since, until }),
        time_increment: "1",
        action_attribution_windows: '["1d_click","7d_click"]',
        filtering: '[{"field":"campaign.effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]',
        limit: "500",
      },
      token
    );
    for (const row of data) {
      rows.push({
        date: row.date_start,
        team: TEAM_MAP[id] || "미분류",
        campId:    row.campaign_id  || "",
        campName:  row.campaign_name|| "",
        adsetId:   row.adset_id    || "",
        adsetName: row.adset_name  || "",
        adId:      row.ad_id       || "",
        adName:    row.ad_name     || "",
        spend:     parseFloat(row.spend) || 0,
        impr:      parseInt(row.impressions) || 0,
        clicks:    parseInt(row.clicks) || 0,
        p1d: extractVal(row.actions, "1d_click"),
        p7d: extractVal(row.actions, "7d_click"),
        v1d: extractVal(row.action_values, "1d_click"),
        v7d: extractVal(row.action_values, "7d_click"),
      });
    }
  }
  return rows;
}

function weekLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const y = d.getUTCFullYear() % 100, m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return `${y}년 ${m}월 ${Math.ceil(day / 7)}주차`;
}
function quarter(m) { return m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4"; }

async function appendAndConvert(apiRows, productMap, personMap) {
  const csvLines = [];
  const internalRows = [];
  for (const r of apiRows) {
    const [yr, mo] = r.date.split("-");
    const { product, person } = parseAdMeta(r.adName, productMap, personMap);
    csvLines.push([
      yr, mo, "-", "-", r.date,
      r.adName, r.campId, r.campName, r.adsetId, r.adsetName, r.adId, "KRW",
      r.spend, r.impr, "", r.clicks, "", "", r.p7d, "", r.v1d, r.v7d,
      weekLabel(r.date), person, product, r.team, quarter(parseInt(mo)), "상시",
    ].map(csvEscape).join(","));
    internalRows.push({
      date: r.date, adName: r.adName, campId: r.campId, campName: r.campName,
      adsetId: r.adsetId, adsetName: r.adsetName, adId: r.adId,
      spend: r.spend, impr: r.impr, clicks: r.clicks,
      purchases: r.p7d, c1val: r.v1d, c7val: r.v7d,
      person, product, team: PRODUCT_NAME_TEAM[product] || r.team,
    });
  }
  if (csvLines.length && !CI_MODE) {
    fs.appendFileSync(CSV_PATH, "\n" + csvLines.join("\n"), "utf8");
    console.log(`[dashboard] ${csvLines.length}행 CSV 추가`);
  } else if (csvLines.length) {
    console.log(`[dashboard] CI모드: ${csvLines.length}행 수신 (CSV 저장 생략)`);
  }
  return internalRows;
}

// ── Aggregation ───────────────────────────────────────────
// dailyBreakdown: 'none' | 'camp' | 'full'
function agg(records, { campLimit = Infinity, adLimit = Infinity, dailyBreakdown = 'none', adFirstDate = {} } = {}) {
  const byDate = {}, byProd = {}, byCamp = {}, byAd = {}, byPer = {};
  const campDay = {}, adDay = {};
  let spend = 0, purchases = 0, val = 0, clicks = 0, impr = 0;

  for (const r of records) {
    spend += r.spend; purchases += r.purchases; val += r.c1val; clicks += r.clicks; impr += r.impr;

    if (!byDate[r.date]) byDate[r.date] = { spend: 0, purchases: 0, val: 0, clicks: 0, impr: 0 };
    byDate[r.date].spend += r.spend; byDate[r.date].purchases += r.purchases;
    byDate[r.date].val += r.c1val; byDate[r.date].clicks += r.clicks; byDate[r.date].impr += r.impr;

    if (!byProd[r.product]) byProd[r.product] = { spend: 0, purchases: 0, val: 0, clicks: 0 };
    byProd[r.product].spend += r.spend; byProd[r.product].purchases += r.purchases; byProd[r.product].val += r.c1val;

    if (!byCamp[r.campName]) byCamp[r.campName] = { spend: 0, purchases: 0, val: 0, impr: 0, clicks: 0, team: r.team };
    byCamp[r.campName].spend += r.spend; byCamp[r.campName].purchases += r.purchases; byCamp[r.campName].val += r.c1val;
    byCamp[r.campName].impr += r.impr; byCamp[r.campName].clicks += r.clicks;

    if (!byAd[r.adName]) byAd[r.adName] = { campName: r.campName, campId: r.campId, product: r.product, person: r.person, team: r.team, spend: 0, purchases: 0, val: 0, impr: 0, clicks: 0, firstDate: adFirstDate[r.adName] || r.date, lastDate: r.date };
    else if (byAd[r.adName].product === '미분류' && r.product !== '미분류') { byAd[r.adName].product = r.product; byAd[r.adName].team = r.team; }
    byAd[r.adName].spend += r.spend; byAd[r.adName].purchases += r.purchases; byAd[r.adName].val += r.c1val;
    byAd[r.adName].impr += r.impr; byAd[r.adName].clicks += r.clicks;
    if (r.date < byAd[r.adName].firstDate) byAd[r.adName].firstDate = r.date;
    if (r.date > byAd[r.adName].lastDate)  byAd[r.adName].lastDate  = r.date;

    if (!byPer[r.person]) byPer[r.person] = { team: r.team, spend: 0, purchases: 0, val: 0 };
    byPer[r.person].spend += r.spend; byPer[r.person].purchases += r.purchases; byPer[r.person].val += r.c1val;

    if (dailyBreakdown === 'camp' || dailyBreakdown === 'full') {
      if (!campDay[r.campName]) campDay[r.campName] = {};
      if (!campDay[r.campName][r.date]) campDay[r.campName][r.date] = { s: 0, p: 0, v: 0 };
      campDay[r.campName][r.date].s += r.spend;
      campDay[r.campName][r.date].p += r.purchases;
      campDay[r.campName][r.date].v += r.c1val;
    }
    if (dailyBreakdown === 'full') {
      if (!adDay[r.adName]) adDay[r.adName] = {};
      if (!adDay[r.adName][r.date]) adDay[r.adName][r.date] = { s: 0, p: 0, v: 0 };
      adDay[r.adName][r.date].s += r.spend;
      adDay[r.adName][r.date].p += r.purchases;
      adDay[r.adName][r.date].v += r.c1val;
    }
  }

  const roas = spend > 0 ? val / spend * 100 : 0;
  const mk = (obj, top) => Object.entries(obj)
    .map(([name, d]) => ({ name, ...d, roas: d.spend > 0 ? d.val / d.spend * 100 : 0, share: val > 0 ? d.val / val * 100 : 0 }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, top || Infinity);

  // FULL_DAILY 기간(thisMonth 등)은 adDay 제한 없음 — byAd와 동일 범위 보장
  // (연간/전체 기간은 dailyBreakdown='none'이므로 adDay=null로 반환)

  return {
    kpi: { spend, purchases, val, roas, clicks, impr },
    byDate: Object.entries(byDate)
      .map(([date, d]) => ({ date, ...d, roas: d.spend > 0 ? d.val / d.spend * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byProduct: mk(byProd),
    byCamp:    mk(byCamp, campLimit),
    byAd:      Object.entries(byAd)
      .map(([name, d]) => ({ name, ...d, roas: d.spend > 0 ? d.val / d.spend * 100 : 0 }))
      .sort((a, b) => b.spend - a.spend).slice(0, adLimit),
    byPerson:  mk(byPer),
    campDay:   dailyBreakdown !== 'none' ? campDay : null,
    adDay:     dailyBreakdown === 'full' ? adDay   : null,
  };
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  const now = nowKST();
  const today = ds(now);
  const yd = ds(shiftDays(-1));
  const genTime = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log("[dashboard] 시작:", today, genTime);

  // Load historical data
  let records = [];
  if (CI_MODE) {
    // CI: Meta API에서 당해년도 전체 월별 청크 fetch (한 번에 요청 시 용량 초과 에러 방지)
    const fetchFrom = process.env.FETCH_FROM || `${today.slice(0, 4)}-01-01`;
    console.log(`[dashboard] CI모드: ${fetchFrom} ~ ${yd} 월별 fetch`);
    try {
      const { productMap, personMap } = buildLookups([]);
      const allApiRows = [];
      let chunkStart = fetchFrom;
      while (chunkStart <= yd) {
        const [cy, cm] = chunkStart.split("-").map(Number);
        const lastOfMonth = ds(new Date(Date.UTC(cy, cm, 0)));
        const chunkEnd = lastOfMonth < yd ? lastOfMonth : yd;
        console.log(`[dashboard] fetch chunk: ${chunkStart} ~ ${chunkEnd}`);
        const rows = await fetchNewAdRows(chunkStart, chunkEnd);
        allApiRows.push(...rows);
        chunkStart = ds(new Date(Date.UTC(cy, cm, 1)));
      }
      console.log(`[dashboard] Meta API 총 ${allApiRows.length}행 수신`);
      records = await appendAndConvert(allApiRows, productMap, personMap);
    } catch (e) {
      console.error("[dashboard] Meta API 오류:", e.message);
      process.exit(1);
    }
  } else {
    records = loadCSV();
    const maxDate = records.map(r => r.date).sort().at(-1) || "2000-01-01";
    console.log("[dashboard] 최신 CSV 날짜:", maxDate);
    if (maxDate < yd) {
      const since = ds(new Date(new Date(maxDate + "T00:00:00Z").getTime() + 86400000));
      console.log(`[dashboard] 새 데이터 수집: ${since} ~ ${yd}`);
      try {
        const { productMap, personMap } = buildLookups(records);
        const apiRows = await fetchNewAdRows(since, yd);
        console.log(`[dashboard] Meta API ${apiRows.length}행 수신`);
        const newRecs = await appendAndConvert(apiRows, productMap, personMap);
        records = records.concat(newRecs);
      } catch (e) {
        console.warn("[dashboard] Meta API 오류 (기존 데이터로 진행):", e.message);
      }
    }
  }

  // Period definitions
  const dataEnd = records.map(r => r.date).sort().at(-1) || yd; // 실제 데이터 최신일 (today ≠ dataEnd 가능)
  const [y, mo] = today.split("-").map(Number);
  const lastMo = mo > 1 ? mo - 1 : 12, lastY = mo > 1 ? y : y - 1;
  const minYear = parseInt(records.map(r => r.date.slice(0, 4)).sort()[0] || "2023");

  // 연도별
  const yearDefs = [];
  for (let yr = minYear; yr < y; yr++) {
    yearDefs.push({ id: `y${yr}`, label: `${yr}년`, start: `${yr}-01-01`, end: `${yr}-12-31` });
  }

  // 월별 (전 기간 모든 월)
  const monthDefs = [];
  for (let yr = minYear; yr <= y; yr++) {
    const endMo = yr < y ? 12 : mo;
    for (let m = 1; m <= endMo; m++) {
      const startDate = `${yr}-${pad(m)}-01`;
      const endDate = yr < y || m < mo ? ds(new Date(Date.UTC(yr, m, 0))) : dataEnd;
      monthDefs.push({ id: `m${yr}${pad(m)}`, label: `${yr}년 ${m}월`, year: yr, month: m, start: startDate, end: endDate });
    }
  }

  // yearMonths 맵 (사이드바 월 네비게이션용)
  const yearMonths = {};
  for (const md of monthDefs) {
    if (!yearMonths[md.year]) yearMonths[md.year] = [];
    yearMonths[md.year].push(md.month);
  }

  // 단기·고정 기간
  const fixedDefs = [
    { id: "yesterday", label: "어제",                    start: yd,                           end: yd },
    { id: "thisMonth", label: `${y}년 ${mo}월`,         start: `${y}-${pad(mo)}-01`,        end: dataEnd },
    { id: "lastMonth", label: `${lastY}년 ${lastMo}월`, start: `${lastY}-${pad(lastMo)}-01`, end: ds(new Date(Date.UTC(y, mo - 1, 0))) },
    { id: "last30d",   label: "최근 30일",               start: ds(shiftDays(-29)),           end: dataEnd },
    { id: "last7d",    label: "최근 7일",                start: ds(shiftDays(-6)),            end: dataEnd },
    { id: "ytd",       label: `${y}년 누계`,             start: `${y}-01-01`,                 end: dataEnd },
    ...yearDefs,
    { id: "all",       label: "전체 (2023~)",            start: `${minYear}-01-01`,           end: dataEnd },
  ];
  const allDefs = [...fixedDefs, ...monthDefs];

  // 일자별 드릴다운은 단기 기간만 (파일 크기 제어)
  const FULL_DAILY = new Set(["yesterday", "thisMonth", "lastMonth", "last30d", "last7d"]);
  // 커스텀 날짜 범위 확장: 최근 4개월 monthly periods도 adDay 포함
  // (연도→월 사이드바 네비게이션은 curPeriod를 'm202607' 같은 월별 id로 설정하므로
  //  'thisMonth'/'lastMonth' shortcut id와는 별개 항목 — 제외하면 그 경로에서 드릴다운이 깨짐)
  {
    const cutoff = new Date(Date.UTC(y, mo - 5, 1));
    for (const md of monthDefs) {
      const mId = 'm' + md.year + pad(md.month);
      if (new Date(Date.UTC(md.year, md.month - 1, 1)) >= cutoff) {
        FULL_DAILY.add(mId);
      }
    }
  }
  // 최근 3개월 기준
  const recentMonths = new Set([
    `m${y}${pad(mo)}`,
    `m${lastY}${pad(lastMo)}`,
    mo > 2 ? `m${y}${pad(mo-2)}` : `m${mo > 1 ? y : y-1}${pad(mo > 2 ? mo-2 : mo > 1 ? mo-1+12-1 : 12)}`,
  ]);

  // 소재별 라이브일자: 전체 기간 기준 (기간 필터와 무관하게 고정)
  const adFirstDate = {};
  for (const r of records) {
    if (!adFirstDate[r.adName] || r.date < adFirstDate[r.adName]) adFirstDate[r.adName] = r.date;
  }

  const periodData = {};
  for (const p of allDefs) {
    const recs = records.filter(r => r.date >= p.start && r.date <= p.end);
    const spanMs = new Date(p.end + "T00:00:00Z") - new Date(p.start + "T00:00:00Z");
    const prevEnd = ds(new Date(new Date(p.start + "T00:00:00Z").getTime() - 86400000));
    const prevStart = ds(new Date(new Date(p.start + "T00:00:00Z").getTime() - spanMs - 86400000));
    const prevRecs = records.filter(r => r.date >= prevStart && r.date <= prevEnd);
    const isYearOrAll = p.id.startsWith("y") || p.id === "all";
    const isRecentMonth = recentMonths.has(p.id);
    const isShortcut = FULL_DAILY.has(p.id) || ["ytd"].includes(p.id);
    // adLimit: 단기·최근월 전체, 연간 100, 구월 30
    const adLimit = isShortcut || isRecentMonth ? Infinity
                  : isYearOrAll ? 100
                  : 30;
    const opts = {
      adLimit,
      dailyBreakdown: FULL_DAILY.has(p.id) ? "full" : "none",
      adFirstDate,
    };
    periodData[p.id] = { ...p, ...agg(recs, opts), prevKpi: agg(prevRecs, { adLimit: 0 }).kpi };
  }

  // 사이드바 필터용 목록
  const allPersons = [...new Set(records.map(r => r.person).filter(p => p && p !== "담당자 미확인"))].sort((a, b) => a.localeCompare(b, "ko"));
  allPersons.push("담당자 미확인"); // 맨 마지막에 고정
  const allProducts = [...new Set(records.map(r => r.product).filter(p => p && p !== "미분류"))].sort((a, b) => a.localeCompare(b, "ko"));

  // 팀 cascade 필터용 맵
  const personTeamMap = {};
  for (const r of records) {
    if (r.person && r.person !== "담당자 미확인" && r.team) {
      if (!personTeamMap[r.person] || personTeamMap[r.person] === "미분류") {
        personTeamMap[r.person] = r.team;
      }
    }
  }
  // 계정 기반 추론보다 명시적 팀 배정 우선
  const PERSON_TEAM_OVERRIDE = { "이지현": "1팀", "장지영": "1팀" };
  for (const [person, team] of Object.entries(PERSON_TEAM_OVERRIDE)) {
    personTeamMap[person] = team;
  }
  const productTeamMap = {};
  for (const p of allProducts) {
    productTeamMap[p] = PRODUCT_NAME_TEAM[p] || "미분류";
  }

  // Generate HTML
  const html = buildDashboardHTML({ today, genTime, periodData, yearMonths, allPersons, allProducts, curYear: y, curMonth: mo, personTeamMap, productTeamMap, apiKey: process.env.GEMINI_API_KEY || '' });

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, "utf8");
  console.log("✅", OUTPUT_PATH);

  // GitHub API 배포 (changminkim-debug/hmr-pulse → GitHub Pages)
  // CI 모드에서도 GITHUB_TOKEN이 있으면 직접 배포
  if (!process.argv.includes("--no-deploy")) {
    await deployToPages("dashboard.html", OUTPUT_PATH);
  }

  if (process.argv.includes("--open")) {
    (await import("child_process")).exec(`start "" "${OUTPUT_PATH}"`);
  }
}

main().catch(e => { console.error("[실패]", e.message); process.exit(1); });
