import React, { useMemo } from "react";

const ThreatRanking = ({ data }) => {
  // 1️⃣ 把对象转数组
  const players = useMemo(() => {
    if (!data) return [];

    return Object.entries(data)
      .map(([name, value]) => ({
        name,
        ...value,
      }))
      .filter(p => p.threatScore > 0) // 去掉空数据
      .sort((a, b) => b.threatScore - a.threatScore)
      .slice(0, 20); // Top20
  }, [data]);

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ color: "white", marginBottom: "20px" }}>
        对华威胁排行榜 Top20
      </h2>

      <div>
        {players.map((player, index) => (
          <div
            key={player.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 12px",
              marginBottom: "6px",
              background:
                index < 3
                  ? "rgba(255,0,0,0.2)"
                  : "rgba(255,255,255,0.05)",
              borderRadius: "6px",
              color: "white",
            }}
          >
            <span>
              {index + 1}. {player.name}
            </span>

            <span>
              {player.threatScore.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThreatRanking;