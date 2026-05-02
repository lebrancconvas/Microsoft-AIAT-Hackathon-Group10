import type { CSSProperties } from 'react';
import type { VisitRecord } from '../progression/types';

const themeChart = {
  lineWound: '#0ea5e9',
  lineRisk: '#f43f5e',
  grid: 'rgba(148, 163, 184, 0.35)',
  text: '#64748b',
} as const;

type Props = {
  visits: VisitRecord[];
  style?: CSSProperties;
};

/** Lightweight SVG dual-series chart: wound area + risk score vs visit index (no extra deps). */
export function ProgressionChart({ visits, style }: Props) {
  if (visits.length < 2) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          fontSize: '13px',
          color: themeChart.text,
          backgroundColor: 'rgba(248, 250, 252, 0.9)',
          borderRadius: '12px',
          border: `1px dashed ${themeChart.grid}`,
          ...style,
        }}
      >
        บันทึกครั้งถัดไปเพื่อแสดงกราฟแนวโน้ม (ต้องมีอย่างน้อย 2 ครั้ง)
      </div>
    );
  }

  const W = 560;
  const H = 220;
  const padL = 44;
  const padR = 44;
  const padT = 16;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const areas = visits.map((v) => v.woundAreaPixels);
  const risks = visits.map((v) => v.riskScore);
  const maxArea = Math.max(...areas, 1);
  const maxRisk = Math.max(...risks, 1);

  const xs = visits.map((_, i) => padL + (innerW * i) / Math.max(visits.length - 1, 1));

  const yArea = (a: number) => padT + innerH * (1 - a / maxArea);
  const yRisk = (r: number) => padT + innerH * (1 - r / maxRisk);

  const pathArea = visits.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${yArea(v.woundAreaPixels)}`).join(' ');
  const pathRisk = visits.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${yRisk(v.riskScore)}`).join(' ');

  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', minWidth: '280px' }} aria-label="กราฟแนวโน้มพื้นที่แผลและคะแนนความเสี่ยง">
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={themeChart.grid} strokeWidth={1} />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke={themeChart.grid} strokeWidth={1} />

        <path d={pathArea} fill="none" stroke={themeChart.lineWound} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathRisk} fill="none" stroke={themeChart.lineRisk} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" />

        {visits.map((v, i) => (
          <g key={v.id}>
            <circle cx={xs[i]} cy={yArea(v.woundAreaPixels)} r={4} fill={themeChart.lineWound} />
            <circle cx={xs[i]} cy={yRisk(v.riskScore)} r={3.5} fill={themeChart.lineRisk} />
          </g>
        ))}

        <text x={padL} y={H - 10} fontSize={11} fill={themeChart.text} fontFamily="inherit">
          ครั้งที่ 1 → {visits.length}
        </text>
        <text x={padL + innerW - 120} y={14} fontSize={11} fill={themeChart.lineWound} fontFamily="inherit" fontWeight={700}>
          — พื้นที่แผล (พิกเซล)
        </text>
        <text x={padL + innerW - 120} y={28} fontSize={11} fill={themeChart.lineRisk} fontFamily="inherit" fontWeight={700}>
          ··· คะแนนความเสี่ยง
        </text>
      </svg>
    </div>
  );
}
