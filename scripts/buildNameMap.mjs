// scripts/buildNameMap.mjs
import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const EXCEL_PATH = path.resolve("data/2024-2025_中国队威胁清单_男单50_女单50.xlsx");
const OUT_PATH = path.resolve("src/nameMap.js");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function wikidataSearch(nameEn) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", nameEn);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");

  const r = await fetch(url.toString(), {
    headers: { "User-Agent": "table-tennis-ci/1.0 (name mapping)" },
  });
  if (!r.ok) throw new Error(`wbsearchentities failed: ${r.status}`);
  const data = await r.json();
  return data.search || [];
}

async function wikidataGetZhLabel(qid) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", qid);
  url.searchParams.set("props", "labels");
  // 多语言兜底：zh / zh-hans / zh-cn
  url.searchParams.set("languages", "zh|zh-hans|zh-cn");
  url.searchParams.set("format", "json");

  const r = await fetch(url.toString(), {
    headers: { "User-Agent": "table-tennis-ci/1.0 (name mapping)" },
  });
  if (!r.ok) throw new Error(`wbgetentities failed: ${r.status}`);
  const data = await r.json();
  const ent = data.entities?.[qid];
  const labels = ent?.labels || {};

  // 优先顺序
  const zh = labels.zh?.value || labels["zh-hans"]?.value || labels["zh-cn"]?.value;
  return zh || null;
}

function pickBestCandidate(candidates) {
  // 优先描述里带 table tennis
  const good = candidates.find((c) =>
    (c.description || "").toLowerCase().includes("table tennis")
  );
  return good || candidates[0] || null;
}

function readNamesFromExcel(excelPath) {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`找不到 Excel：${excelPath}\n请确认你已放到 data/ 目录下。`);
  }

  const wb = xlsx.readFile(excelPath);
  const sheets = ["Men_Singles_Threat50", "Women_Singles_Threat50"];

  const names = new Set();

  for (const s of sheets) {
    const ws = wb.Sheets[s];
    if (!ws) throw new Error(`Excel 缺少工作表：${s}`);
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

    for (const row of rows) {
      // 你的表头是 name（英文名）
      const n = String(row.name || "").trim();
      if (n) names.add(n);
    }
  }
  return Array.from(names);
}

async function main() {
  const names = readNamesFromExcel(EXCEL_PATH);
  console.log(`读取到英文名：${names.length} 个（男单+女单去重后）`);

  const map = {};
  const failed = [];

  for (let i = 0; i < names.length; i++) {
    const nameEn = names[i];
    process.stdout.write(`(${i + 1}/${names.length}) 查询：${nameEn} ... `);

    try {
      const candidates = await wikidataSearch(nameEn);
      const best = pickBestCandidate(candidates);

      if (!best?.id) {
        console.log("未找到QID ❌");
        failed.push(nameEn);
        await sleep(200);
        continue;
      }

      const zh = await wikidataGetZhLabel(best.id);

      if (!zh) {
        console.log(`找到QID=${best.id}，但无中文标签 ⚠️`);
        failed.push(nameEn);
      } else {
        map[nameEn] = zh;
        console.log(`✅ ${zh}`);
      }
    } catch (e) {
      console.log(`异常 ❌ ${e.message}`);
      failed.push(nameEn);
    }

    // 轻一点的限速，避免被封
    await sleep(250);
  }

  const content =
    `// src/nameMap.js\n` +
    `// 自动生成：英文名 -> 中文名（Wikidata）\n` +
    `export const NAME_ZH_MAP = ${JSON.stringify(map, null, 2)};\n`;

  fs.writeFileSync(OUT_PATH, content, "utf-8");
  console.log(`\n已生成：${OUT_PATH}`);
  console.log(`成功：${Object.keys(map).length}，失败/缺失：${failed.length}`);

  if (failed.length) {
    const failPath = path.resolve("src/nameMap.missing.txt");
    fs.writeFileSync(failPath, failed.join("\n"), "utf-8");
    console.log(`缺失名单已保存：${failPath}（你可以后续手动补）`);
  }
}

main();
