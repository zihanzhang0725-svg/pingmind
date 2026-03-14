import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const MATCH_FILE = path.join(ROOT, "data", "player_matches_local.json");
const PLAYERS_FILE = path.join(ROOT, "data", "players.json");

function main() {
  if (!fs.existsSync(MATCH_FILE)) {
    console.log("❌ player_matches_local.json 不存在");
    return;
  }

  const matchDb = JSON.parse(fs.readFileSync(MATCH_FILE, "utf-8"));
  let players = [];

  if (fs.existsSync(PLAYERS_FILE)) {
    players = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf-8"));
  }

  const existingNames = new Set(players.map(p => p.name));

  let maxId = players.length > 0
    ? Math.max(...players.map(p => p.id))
    : 100;

  for (const key in matchDb) {
    const player = matchDb[key];

    if (player.country === "CHN") {
      const formattedName = player.name.toUpperCase();

      if (!existingNames.has(formattedName)) {
        maxId++;

        players.push({
          id: maxId,
          name: formattedName,
          ranking: 999
        });

        console.log("✅ 新增中国球员:", formattedName);
      }
    }
  }

  fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2));
  console.log("🎉 同步完成");
}

main();