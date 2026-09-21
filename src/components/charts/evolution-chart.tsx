"use client";

import * as React from "react";

export type EvolutionPoint = { bucket: string; total: number };

/**
 * Gráfico de evolução (barras) em SVG nativo, sem dependências.
 * viewBox fixo + preserveAspectRatio="xMidYMid meet" mantém a proporção.
 */
export function EvolutionChart({
  points,
  color = "#2563EB",
  height = 200,
}: {
  points: EvolutionPoint[];
  color?: string;
  height?: number;
}) {
  const W = 800;
  const PAD = { top: 16, right: 8, bottom: 28, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const max = Math.max(1, ...points.map((p) => p.total));
  const n = points.length;
  const step = n > 1 ? innerW / n : innerW;

  const labelEvery = n > 24 ? Math.ceil(n / 12) : n > 12 ? 2 : 1;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        style={{ width: "100%", height: "auto", minWidth: n > 0 ? 480 : undefined }}
        role="img"
        aria-label="Evolução de tarefas concluídas"
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH * f}
            y2={PAD.top + innerH * f}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {points.map((p, i) => {
          const x = PAD.left + step * i + step / 2;
          const h = (p.total / max) * innerH;
          return (
            <React.Fragment key={p.bucket}>
              <rect
                x={x - Math.min(step * 0.36, 22)}
                y={innerH - h + PAD.top}
                width={Math.min(step * 0.72, 44)}
                height={h}
                rx={3}
                fill={p.total > 0 ? color : "#e2e8f0"}
              />
              {i % labelEvery === 0 && (
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {p.bucket.slice(5)}
                </text>
              )}
            </React.Fragment>
          );
        })}
        {n === 0 && (
          <text
            x={W / 2}
            y={innerH / 2 + PAD.top}
            textAnchor="middle"
            fontSize={13}
            fill="#64748b"
          >
            Sem dados no período
          </text>
        )}
      </svg>
    </div>
  );
}