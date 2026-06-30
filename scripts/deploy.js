import fs from "fs";
import path from "path";

const REPO = process.env.GITHUB_PAGES_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const BASE_URL = "https://changminkim-debug.github.io/hmr-pulse";

function apiHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "hmr-dashboard",
  };
}

// Git Data API — supports files up to 100 MB (GitHub Contents API is limited to 1 MB)
async function deployViaGitDataApi(filename, content) {
  const base = `https://api.github.com/repos/${REPO}`;
  const h = apiHeaders();

  // 1. Create blob
  const blobRes = await fetch(`${base}/git/blobs`, {
    method: "POST", headers: h,
    body: JSON.stringify({ content: Buffer.from(content).toString("base64"), encoding: "base64" }),
  });
  if (!blobRes.ok) { console.log("[deploy] blob 생성 실패:", (await blobRes.json()).message); return false; }
  const { sha: blobSha } = await blobRes.json();

  // 2. Get current HEAD of default branch
  const repoRes = await fetch(`${base}`, { headers: h });
  const defaultBranch = repoRes.ok ? (await repoRes.json()).default_branch || "main" : "main";

  const refRes = await fetch(`${base}/git/refs/heads/${defaultBranch}`, { headers: h });
  if (!refRes.ok) { console.log("[deploy] ref 조회 실패"); return false; }
  const latestSha = (await refRes.json()).object.sha;

  // 3. Get tree SHA of latest commit
  const commitRes = await fetch(`${base}/git/commits/${latestSha}`, { headers: h });
  if (!commitRes.ok) { console.log("[deploy] commit 조회 실패"); return false; }
  const treeSha = (await commitRes.json()).tree.sha;

  // 4. Create new tree pointing blob to path
  const treeRes = await fetch(`${base}/git/trees`, {
    method: "POST", headers: h,
    body: JSON.stringify({ base_tree: treeSha, tree: [{ path: filename, mode: "100644", type: "blob", sha: blobSha }] }),
  });
  if (!treeRes.ok) { console.log("[deploy] tree 생성 실패:", (await treeRes.json()).message); return false; }
  const newTreeSha = (await treeRes.json()).sha;

  // 5. Create new commit
  const newCommitRes = await fetch(`${base}/git/commits`, {
    method: "POST", headers: h,
    body: JSON.stringify({ message: `deploy: ${filename}`, tree: newTreeSha, parents: [latestSha] }),
  });
  if (!newCommitRes.ok) { console.log("[deploy] commit 생성 실패:", (await newCommitRes.json()).message); return false; }
  const newCommitSha = (await newCommitRes.json()).sha;

  // 6. Fast-forward branch ref
  const updateRes = await fetch(`${base}/git/refs/heads/${defaultBranch}`, {
    method: "PATCH", headers: h,
    body: JSON.stringify({ sha: newCommitSha }),
  });
  if (!updateRes.ok) { console.log("[deploy] ref 업데이트 실패:", (await updateRes.json()).message); return false; }
  return true;
}

export async function deployToPages(filename, localPath) {
  if (!TOKEN || !REPO) {
    console.log("[deploy] GITHUB_TOKEN / GITHUB_PAGES_REPO 미설정, 스킵");
    return;
  }

  const content = fs.readFileSync(localPath, "utf8");

  const ok = await deployViaGitDataApi(filename, content);
  if (ok) console.log(`🌐 배포 완료: ${BASE_URL}/${filename}`);
}

/**
 * GitHub Pages 레포에서 파일 다운로드 (CI 모드에서 CSV 복원용)
 */
export async function downloadFromPages(filename, localPath) {
  if (!TOKEN || !REPO) return false;
  const apiUrl = `https://api.github.com/repos/${REPO}/contents/${filename}`;
  const headers = { Authorization: `Bearer ${TOKEN}`, "User-Agent": "hmr-dashboard" };
  try {
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, content, "utf8");
    return true;
  } catch { return false; }
}

/**
 * GitHub Pages에 없는 아카이브 파일만 골라 업로드.
 * @param {string} archiveDir - 로컬 archive/ 폴더 절대 경로
 * @param {string} todayStr   - 오늘 날짜 "YYYY-MM-DD" (오늘 것은 별도 처리)
 */
export async function deployMissingArchives(archiveDir, todayStr) {
  if (!TOKEN || !REPO) return;

  const files = fs.readdirSync(archiveDir)
    .filter(f => /^pulse-\d{8}\.html$/.test(f));

  for (const f of files) {
    const d = f.slice(6, 10) + "-" + f.slice(10, 12) + "-" + f.slice(12, 14);
    if (d === todayStr) continue; // 오늘 것은 pulse.js 메인 흐름에서 처리

    const apiUrl = `https://api.github.com/repos/${REPO}/contents/archive/${f}`;
    const headers = { Authorization: `Bearer ${TOKEN}`, "User-Agent": "hmr-dashboard" };

    const checkRes = await fetch(apiUrl, { headers });
    if (checkRes.ok) continue; // 이미 배포됨 → 스킵

    console.log(`[deploy] 미배포 아카이브 업로드: ${f}`);
    await deployToPages(`archive/${f}`, `${archiveDir}/${f}`);
  }
}
