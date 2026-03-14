// server/scrapers/livesportResults.js
import axios from "axios";
import * as cheerio from "cheerio";
import { spawn } from "child_process";
import path from "path";

function ensureTrailingSlash(u) {
  if (!u) return "";
  return u.endsWith("/") ? u : u + "/";
}

function normalizeLivesportPlayerUrl(u) {
  if (!u) return "";
  let url = String(u).trim();
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("/")) url = "https://www.livesport.com" + url;
    else url = "https://www.livesport.com/" + url;
  }
  url = url.split("#")[0].split("?")[0];
  url = ensureTrailingSlash(url);
  return url;
}

function buildResultsUrl(playerUrl) {
  const u = normalizeLivesportPlayerUrl(playerUrl);
  if (u.endsWith("/results/")) return u;
  return ensureTrailingSlash(u) + "results/";
}

function cleanText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/**
 * axios 快抓：只能勉强抓到 date/score（对手/赛事通常抓不到）
 */
function parseMatchesFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const matches = [];

  $("div, li, tr, section").each((_, el) => {
    const t = cleanText($(el).text());
    if (!t || t.length < 12) return;

    const score = (t.match(/\b\d{1,2}[:\-]\d{1,2}\b(?:\s+\d{1,2}[:\-]\d{1,2}\b)*/)?.[0] || "")
      .replace(/-/g, ":");
    if (!score) return;

    const dateRaw =
      t.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/)?.[0] ||
      t.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}\b/i)?.[0] ||
      t.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ||
      "";

    matches.push({
      date: dateRaw || "",
      dateRaw,
      event: "",
      round: "",
      opponent: "",
      score,
      result: "",
      subEvent: "",
      sourceUrl: pageUrl,
    });
  });

  return uniqBy(matches, (m) => `${m.dateRaw}__${m.score}`);
}

/**
 * ✅ 关键：把 proxy / playerHint 传给 python
 */
function runPythonPlaywright({ playerUrl, years = 2, debug = false, proxyUrl = "", playerHint = "" }) {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(process.cwd(), "..");

    const defaultWin = path.resolve(projectRoot, "orgcrawler-v2/.venv/Scripts/python.exe");
    const defaultNix = path.resolve(projectRoot, "orgcrawler-v2/.venv/bin/python");
    const PYTHON_BIN =
      process.env.LIVESP_PY ||
      (process.platform === "win32" ? defaultWin : defaultNix);

    const scriptPath = path.resolve(projectRoot, "server/py/livesport_playwright.py");

    // argv: script url years debug playerHint
    const args = [
      scriptPath,
      playerUrl,
      String(years),
      debug ? "1" : "0",
      playerHint || "",
    ];

    console.log("[livesport] spawn python:", PYTHON_BIN);
    console.log("[livesport] args:", args);
    console.log("[livesport] proxy:", proxyUrl || "");

    const p = spawn(PYTHON_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        LIVESP_PROXY: proxyUrl || process.env.LIVESP_PROXY || "",
      },
    });

    p.on("error", (e) => reject(e));

    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`python exit ${code}\n${err || out}`));
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`python output not json\n${out}\n${err}`));
      }
    });
  });
}

export async function fetchLivesportResults({ playerUrl, playerName, years = 2, proxyUrl = null, debug = false }) {
  const normalizedPlayerUrl = normalizeLivesportPlayerUrl(playerUrl);
  const resultsUrl = buildResultsUrl(normalizedPlayerUrl);

  const axiosConfig = {
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://www.livesport.com/",
    },
    validateStatus: (s) => s >= 200 && s < 400,
  };

  let html = "";
  try {
    const resp = await axios.get(resultsUrl, axiosConfig);
    html = resp.data;
  } catch {
    html = "";
  }

  let matches = [];
  if (html) matches = parseMatchesFromHtml(html, resultsUrl);

  // ✅ 新判定：如果 event/opponent 绝大多数为空，就强制用 python
  const total = matches.length;
  const withEvent = matches.filter((m) => (m.event || "").trim().length >= 2).length;
  const withOpponent = matches.filter((m) => (m.opponent || "").trim().length >= 2).length;

  const axiosLooksBad =
    !matches ||
    total < 10 ||
    (withEvent / Math.max(1, total) < 0.2 && withOpponent / Math.max(1, total) < 0.2);

  let used = "axios";
  let py = null;

  if (axiosLooksBad) {
    used = "python_playwright";
    py = await runPythonPlaywright({
      playerUrl: resultsUrl,
      years,
      debug,
      proxyUrl: proxyUrl || "",
      playerHint: playerName || "",
    });

    if (!py?.ok || !Array.isArray(py.matches) || py.matches.length === 0) {
      throw new Error(`livesport: playwright parsed 0 matches. Check debug_livesport_rendered.html`);
    }
    matches = py.matches;
  }

  return {
    ok: true,
    name: playerName || "",
    updatedAt: new Date().toISOString(),
    source: "livesport",
    playerUrl: normalizedPlayerUrl,
    resultsUrl,
    years,
    count: matches.length,
    matches: matches.slice(0, 150).map((m) => ({
      date: m.date || "",
      event: m.event || "",
      round: m.round || "",
      opponent: m.opponent || "",
      score: m.score || "",
      result: m.result || "",
      subEvent: m.subEvent || "",
    })),
    meta: debug ? { used, pyMeta: py?.debug || py?.debugInfo || py?.debug_info || null } : undefined,
  };
}
