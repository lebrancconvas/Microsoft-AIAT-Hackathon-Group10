import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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

function formatSymptomsForHistory(keys: string[]): string {
  const labels: Record<string, string> = {
    pain: 'เจ็บ/ปวดบริเวณแผล',
    swelling: 'บวม / อักเสบ',
    redness: 'แดงรอบแผล',
    odor: 'มีกลิ่น',
    fever: 'มีไข้ / อาการทั่วไป',
    other: 'อื่นๆ',
  };
  if (!keys.length) return 'ไม่มีอาการที่เลือก';
  return keys
    .map((k) => {
      if (k.startsWith('other:')) {
        const text = k.slice('other:'.length).trim();
        return text ? `อื่นๆ: ${text}` : 'อื่นๆ';
      }
      return labels[k] ?? k;
    })
    .join(' · ');
}

function formatObservationLongThai(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { dateStyle: 'long' });
}

function formatUploadDateTimeThai(atIso: string): string {
  return new Date(atIso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function VisitHistoryItem({ visit }: { visit: VisitRecord }) {
  return (
    <div
      style={{
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.sm,
        padding: '10px',
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
      }}
    >
      <div style={{ margin: '0 0 8px 0' }}>
        <p style={{ margin: 0, fontSize: '13px', color: theme.color.text, fontWeight: 800 }}>
          วันที่สังเกตการณ์:{' '}
          {visit.observationDate ? formatObservationLongThai(visit.observationDate) : new Date(visit.at).toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: theme.color.textMuted, fontWeight: 600 }}>
          วันที่และเวลาที่อัปโหลด: {formatUploadDateTimeThai(visit.at)}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <img
          src={visit.originalImageDataUrl}
          alt="ภาพต้นฉบับย้อนหลัง"
          style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${theme.color.border}` }}
        />
        <img
          src={visit.overlayImageDataUrl}
          alt="ภาพวิเคราะห์ย้อนหลัง"
          style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${theme.color.border}` }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: theme.color.textSoft, fontWeight: 600 }}>
        <span>พื้นที่: {visit.woundAreaPixels.toLocaleString()}</span>
        <span>สัดส่วน: {visit.woundRatioPercent}%</span>
        <span>Risk: {visit.riskScore} ({visit.riskLevelTh})</span>
      </div>
      <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: theme.color.text, fontWeight: 600, lineHeight: 1.45 }}>
        การบันทึกอาการ: {formatSymptomsForHistory(visit.symptomsChecked)}
      </p>
    </div>
  );
}

/** ชิปแสดงเฉพาะวันที่สังเกตการณ์ที่ผู้ใช้กำหนด (รูปแบบสั้น เช่น 1/5/69) */
function chipObservationDateLabel(visit: VisitRecord): string {
  if (visit.observationDate) {
    const parts = visit.observationDate.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' });
    }
  }
  return new Date(visit.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' });
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
  /** `chartHistory` เรียงจากเก่าไปใหม่แล้ว (วันที่สังเกตการณ์ → เวลาอัปโหลด) */
  const historyAsc = useMemo(() => [...chartHistory], [chartHistory]);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

  useEffect(() => {
    if (!historyAsc.length) {
      setSelectedVisitId(null);
      return;
    }
    const hasCurrent = selectedVisitId ? historyAsc.some((v) => v.id === selectedVisitId) : false;
    if (!hasCurrent) {
      setSelectedVisitId(historyAsc[historyAsc.length - 1].id);
    }
  }, [historyAsc, selectedVisitId]);

  const selectedVisit = historyAsc.find((v) => v.id === selectedVisitId) ?? historyAsc[0] ?? null;

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

      <Card style={{ padding: '18px 18px' }}>
        <h3 style={sectionTitleStyle}>ประวัติภาพและผลวิเคราะห์</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: theme.color.textMuted, lineHeight: 1.45 }}>
          เรียงตามวันที่สังเกตการณ์จากเก่าไปใหม่ — แตะวันที่เพื่อดูรายละเอียด (หากวันที่ซ้ำ เรียงตามเวลาอัปโหลด)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {historyAsc.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: theme.color.textMuted }}>ยังไม่มีประวัติภาพของผู้ป่วยรายนี้</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
                {historyAsc.map((visit) => {
                  const dateLabel = chipObservationDateLabel(visit);
                  const isActive = selectedVisit?.id === visit.id;
                  return (
                    <button
                      key={visit.id}
                      type="button"
                      title={`อัปโหลด ${formatUploadDateTimeThai(visit.at)}`}
                      onClick={() => setSelectedVisitId(visit.id)}
                      style={{
                        border: `1px solid ${isActive ? theme.color.primary : theme.color.border}`,
                        backgroundColor: isActive ? 'rgba(14, 165, 233, 0.12)' : theme.color.surface,
                        color: theme.color.text,
                        borderRadius: '8px',
                        minWidth: '72px',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontFamily: theme.font,
                        boxShadow: isActive ? theme.shadow.sm : 'none',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>{dateLabel}</span>
                    </button>
                  );
                })}
              </div>
              {selectedVisit ? <VisitHistoryItem visit={selectedVisit} /> : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
