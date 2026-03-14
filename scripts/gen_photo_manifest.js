import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const PHOTO_ROOT = path.join(PUBLIC_DIR, "player-photos");
const OUT_FILE = path.join(PHOTO_ROOT, "manifest.json");

function normNameKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferKeyFromBaseName(baseName) {
  const norm = normNameKey(baseName);
  if (!norm) return "";
  const tokens = norm.split(" ").filter(Boolean);

  // Handle common rename pattern like:
  // "COTON Flavien Flavien COTON" or "Eduard IONESCU IONESCU Eduard"
  // Collapse to the first half so player.nameEn/name can still match.
  if (tokens.length >= 4 && tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    const a = tokens.slice(0, half);
    const b = tokens.slice(half);
    const same = a.every((t, i) => t === b[i]);
    const reverse = a.every((t, i) => t === b[half - 1 - i]);
    if (same || reverse) return a.join(" ");
  }

  return norm;
}

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === ".DS_Store") continue;
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile()) out.push(full);
    }
  }
  return out;
}

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function encodeUrlPath(posixPath) {
  // Encode each path segment so non-ASCII folder/file names work in browsers.
  return posixPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function main() {
  if (!fs.existsSync(PHOTO_ROOT)) {
    console.error(`[gen_photo_manifest] Missing: ${PHOTO_ROOT}`);
    process.exitCode = 1;
    return;
  }

  const files = walkFiles(PHOTO_ROOT).filter(isImageFile);
  const entries = [];
  let maxMtimeMs = 0;

  for (const full of files) {
    const st = fs.statSync(full);
    maxMtimeMs = Math.max(maxMtimeMs, Number(st.mtimeMs) || 0);

    const relFromPublic = path.relative(PUBLIC_DIR, full);
    const url = `/${encodeUrlPath(toPosix(relFromPublic))}`;
    const file = path.basename(full);
    const base = path.basename(full, path.extname(full));
    const key = inferKeyFromBaseName(base);
    if (!key) continue;

    // group is the folder immediately under player-photos/
    const relFromPhotoRoot = path.relative(PHOTO_ROOT, full);
    const group = toPosix(relFromPhotoRoot).split("/")[0] || "";

    entries.push({ key, url, file, group });
  }

  // Stable output for diffs/debugging
  entries.sort((a, b) => (a.key + a.url).localeCompare(b.key + b.url));

  const manifest = {
    generatedAt: new Date().toISOString(),
    cacheBust: maxMtimeMs ? String(Math.floor(maxMtimeMs)) : String(Date.now()),
    count: entries.length,
    entries,
  };

  fs.mkdirSync(PHOTO_ROOT, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`[gen_photo_manifest] Wrote ${entries.length} entries -> ${OUT_FILE}`);
}

main();
