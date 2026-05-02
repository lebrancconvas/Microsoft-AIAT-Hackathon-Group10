import type { CSSProperties, ReactNode } from 'react';
import type { PatientDirectoryRow, VisitRecord } from '../progression/types';
import { theme } from '../theme';
import { Card } from './uiPrimitives';
import { ProgressionChart } from './ProgressionChart';

function DirectoryRow({
  row,
  active,
  onSelect,
}: {
  row: PatientDirectoryRow;
  active: boolean;
  onSelect: () => void;
}) {
  const dateShort = new Date(row.lastAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: theme.radius.sm,
        border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
        backgroundColor: active ? 'rgba(14, 165, 233, 0.08)' : theme.color.surface,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: theme.font,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '13px', color: theme.color.text, flex: '1 1 auto', minWidth: 0 }}>
        {row.patientName}
        <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: theme.color.textMuted, marginTop: '2px' }}>
          {row.visitCount} ครั้งที่บันทึก
        </span>
      </span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: theme.color.danger, whiteSpace: 'nowrap' }}>
        {row.lastRiskLevelTh} ({row.lastRiskScore})
      </span>
      <span style={{ fontSize: '11px', color: theme.color.textMuted, whiteSpace: 'nowrap' }}>{dateShort}</span>
    </button>
  );
}

export function VisitInsightsSection({
  summaryLines,
  directory,
  chartHistory,
  chartPatientLabel,
  activePatientName,
  onSelectPatient,
  childrenBeforeList,
}: {
  summaryLines: string[] | null;
  directory: PatientDirectoryRow[];
  chartHistory: VisitRecord[];
  chartPatientLabel: string;
  activePatientName: string;
  onSelectPatient?: (name: string) => void;
  childrenBeforeList?: ReactNode;
}) {
  const sectionTitleStyle: CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: '16px',
    color: theme.color.text,
    fontWeight: 800,
    letterSpacing: '-0.03em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {summaryLines && summaryLines.length > 0 ? (
        <Card style={{ padding: '18px 18px', borderLeft: `4px solid ${theme.color.accentTeal}` }}>
          <h3 style={sectionTitleStyle}>สรุป (Summary)</h3>
          <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: theme.color.textMuted, fontWeight: 600 }}>
            จากการประเมินครั้งล่าสุด — เปรียบเทียบกับครั้งก่อนของผู้ป่วยท่านเดียวกัน
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', color: theme.color.textSoft, fontSize: '14px', lineHeight: 1.55, fontWeight: 500 }}>
            {summaryLines.map((line, i) => (
              <li key={i} style={{ marginBottom: '6px' }}>
                {line}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {childrenBeforeList}

      <Card style={{ padding: '18px 18px' }}>
        <h3 style={sectionTitleStyle}>รายชื่อผู้ป่วย (ล่าสุด)</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: theme.color.textMuted }}>
          แสดงระดับความเสี่ยงล่าสุดของแต่ละรายจากประวัติในเครื่องนี้
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
          {directory.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: theme.color.textMuted }}>ยังไม่มีประวัติ</p>
          ) : (
            directory.map((row) => (
              <DirectoryRow
                key={row.patientName}
                row={row}
                active={row.patientName === activePatientName}
                onSelect={() => onSelectPatient?.(row.patientName)}
              />
            ))
          )}
        </div>
      </Card>

      <Card style={{ padding: '18px 18px' }}>
        <h3 style={sectionTitleStyle}>กราฟแนวโน้ม (Progression)</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: theme.color.textMuted }}>
          ผู้ป่วย: <strong style={{ color: theme.color.text }}>{chartPatientLabel}</strong> — {chartHistory.length} ครั้งที่บันทึก
        </p>
        <ProgressionChart visits={chartHistory} />
      </Card>
    </div>
  );
}
