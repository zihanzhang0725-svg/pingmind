import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import * as cheerio from "cheerio";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

// ====== 配置 ======
const EXCEL_PATH = path.resolve("data/2024-2025_中国队威胁清单_男单50_女单50.xlsx");
const OUT_JS_PATH = path.resolve("src/nameMap.js");
const OUT_MISSING_PATH = path.resolve("src/nameMap.missing.txt");
const SHEETS = ["Men_Singles_Threat50", "Women_Singles_Threat50"];

// ✅ 如果你这边维基基本都连不上：改成 false（推荐）
const USE_ZH_WIKI = false;

// 限速（百度更容易触发风控，建议 400~900）
const SLEEP_MS = 500;

// ====== 工具 ======
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    // 注意：这里不要 throw，给上层决定怎么处理（避免“一错全错”）
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  } finally {
    clearTimeout(t);
  }
}

function cleanZhTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/-.*$/, "")
    .trim();
}

function normalizeEnName(name) {
  let s = String(name || "").trim().replace(/\s+/g, " ");

  // 处理：LEBRUN Felix Felix LEBRUN
  const parts = s.split(" ");
  if (parts.length >= 4) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    const mid = parts.slice(1, parts.length - 1);
    if (first.toUpperCase() === last.toUpperCase() && mid.length > 0) {
      s = `${mid[0]} ${first}`;
    }
  }

  // 首字母大写
  s = s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");

  return s;
}

function readNamesFromExcel(excelPath) {
  if (!fs.existsSync(excelPath)) {
    throw new Error(
      `找不到 Excel：${excelPath}\n请把 EXCEL_PATH 改成你 xlsx 的真实路径（相对项目根目录）`
    );
  }
  const wb = xlsx.readFile(excelPath);
  const names = new Set();

  for (const s of SHEETS) {
    const ws = wb.Sheets[s];
    if (!ws) {
      throw new Error(`Excel 缺少工作表：${s}\n当前工作表：${wb.SheetNames.join(", ")}`);
    }
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
    for (const row of rows) {
      const n = String(row.name || "").trim();
      if (n) names.add(n);
    }
  }
  return Array.from(names);
}

// ====== 数据源：中文维基（可选） ======
async function tryZhWiki(nameEn) {
  const url = `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(nameEn)}`;
  const { ok, status, text } = await fetchHtml(url);

  // 不 ok 就返回 null（不要 throw）
  if (!ok) return null;

  const $ = cheerio.load(text);

  const h1 = cleanZhTitle($("#firstHeading").first().text());
  if (h1 && !h1.includes("搜索")) return h1;

  const t = cleanZhTitle($(".mw-search-result-heading a").first().text());
  if (t) return t;

  return null;
}

// ====== 数据源：百度百科 ======
async function tryBaiduBaike(query) {
  const url = `https://baike.baidu.com/search/word?word=${encodeURIComponent(query)}`;
  const { ok, status, text } = await fetchHtml(url);

  // 百度有时会 302 / 200，但是内容是风控页；这里先用解析结果判断
  if (!ok) return null;

  const $ = cheerio.load(text);

  // 词条页标题
  let title =
    cleanZhTitle($(".lemmaWgt-lemmaTitle-title h1").first().text()) ||
    cleanZhTitle($("h1").first().text());

  if (title && !title.includes("百度百科") && !title.includes("搜索")) return title;

  // 搜索结果页
  title =
    cleanZhTitle($("a.result-title").first().text()) ||
    cleanZhTitle($(".search-list a").first().text());

  if (title && !title.includes("百度百科") && !title.includes("搜索")) return title;

  return null;
}

// ====== 组合：维基失败也继续百度 ======
async function resolveZhNameSmart(rawNameEn) {
  const nameEn = normalizeEnName(rawNameEn);

  // 1) 维基（可选）
  if (USE_ZH_WIKI) {
    try {
      const zh = await tryZhWiki(nameEn);
      if (zh) return { zh, used: "zhwiki" };
    } catch {
      // 维基失败直接忽略，继续百度
    }
  }

  // 2) 百度（原名）
  try {
    const zh = await tryBaiduBaike(nameEn);
    if (zh) return { zh, used: "baike" };
  } catch {
    // 忽略，继续兜底
  }

  // 3) 百度 + 关键词兜底（乒乓球）
  try {
    const zh = await tryBaiduBaike(`${nameEn} 乒乓球`);
    if (zh) return { zh, used: "baike+kw" };
  } catch {
    // ignored
  }

  return { zh: null, used: "none" };
}

// ====== 主流程 ======
async function main() {
  const names = readNamesFromExcel(EXCEL_PATH);
  console.log(`读取到英文名：${names.length} 个`);

  const map = {};
  const failed = [];

  for (let i = 0; i < names.length; i++) {
    const nameEn = names[i];
    process.stdout.write(`(${i + 1}/${names.length}) 查询：${nameEn} ... `);

    try {
      const { zh, used } = await resolveZhNameSmart(nameEn);
      if (zh) {
        map[nameEn] = zh;
        console.log(`✅ ${zh} (${used})`);
      } else {
        console.log("未命中 ⚠️");
        failed.push(nameEn);
      }
    } catch (e) {
      // 这里才算真正异常（会显示更具体）
      console.log(`异常 ❌ ${e.message} | cause: ${e.cause?.message || "none"}`);
      failed.push(nameEn);
    }

    await sleep(SLEEP_MS);
  }

  const content =
    `// src/nameMap.js\n` +
    `// 自动生成：英文名 -> 中文名（主要来源：百度百科）\n` +
    `export const NAME_ZH_MAP = ${JSON.stringify(map, null, 2)};\n`;

  fs.writeFileSync(OUT_JS_PATH, content, "utf-8");
  console.log(`\n已生成：${OUT_JS_PATH}`);
  console.log(`成功：${Object.keys(map).length}，失败：${failed.length}`);

  if (failed.length) {
    fs.writeFileSync(OUT_MISSING_PATH, failed.join("\n"), "utf-8");
    console.log(`缺失名单：${OUT_MISSING_PATH}`);
  }
}

main().catch((e) => {
  console.error("脚本运行失败：", e);
  process.exit(1);
});
