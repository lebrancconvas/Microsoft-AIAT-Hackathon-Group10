import { useCallback, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import axios from 'axios';
import { VisitInsightsSection } from './components/VisitInsights';
import { Card } from './components/uiPrimitives';
import { appendVisit, getLastVisit, getVisitHistory, listPatientDirectory, normalizePatientName } from './progression/store';
import { buildClinicalSummaryLines } from './progression/summary';
import { theme } from './theme';

// const API_URL = import.meta.env.VITE_API_URL ?? 'https://awry-morality-garnet.ngrok-free.dev/predict';

const API_URL = '/predict';

const SYMPTOM_OPTIONS = [
  { key: 'pain', label: 'เจ็บ/ปวดบริเวณแผล' },
  { key: 'swelling', label: 'บวม / อักเสบ' },
  { key: 'redness', label: 'แดงรอบแผล' },
  { key: 'odor', label: 'มีกลิ่น' },
  { key: 'fever', label: 'มีไข้ / อาการทั่วไป' },
] as const;

type SymptomKey = (typeof SYMPTOM_OPTIONS)[number]['key'];

type PredictResult = {
  wound_area_pixels: number;
  wound_ratio_percent: number;
  risk_score: number;
  risk_level_th: string;
  timeline_day: number;
  symptoms_checked: string[];
  mask_base64: string;
  overlay_base64: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(file);
  });
}

function formatSymptomLine(keys: string[]): string {
  const labelByKey = Object.fromEntries(SYMPTOM_OPTIONS.map((o) => [o.key, o.label])) as Record<string, string>;
  if (!keys.length) return 'ไม่มีอาการที่เลือก';
  return keys.map((k) => labelByKey[k] ?? k).join(' · ');
}

/* ——— Presentational helpers (no business logic) ——— */

function SectionTitle({ title, hint, compact }: { title: string; hint?: string; compact?: boolean }) {
  return (
    <div style={{ marginBottom: compact ? '8px' : '14px' }}>
      <h2
        style={{
          margin: 0,
          fontSize: compact ? '14px' : '15px',
          fontWeight: 700,
          color: theme.color.text,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {hint ? (
        <p
          style={{
            margin: compact ? '3px 0 0 0' : '6px 0 0 0',
            fontSize: compact ? '11px' : '13px',
            color: theme.color.textMuted,
            lineHeight: 1.35,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function FieldLabel({ children, dense }: { children: ReactNode; dense?: boolean }) {
  return (
    <span
      style={{
        display: 'block',
        marginBottom: dense ? '4px' : '8px',
        fontSize: dense ? '12px' : '13px',
        fontWeight: 600,
        color: theme.color.textMuted,
      }}
    >
      {children}
    </span>
  );
}

function MetricTile({
  label,
  value,
  valueColor,
  footer,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme.color.surfaceMuted,
        padding: '18px 16px',
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border}`,
        boxShadow: theme.shadow.sm,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${theme.color.primary} 0%, ${theme.color.accentTeal} 100%)`,
          opacity: 0.85,
        }}
      />
      <p style={{ margin: '6px 0 6px 0', color: theme.color.textMuted, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <div style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: valueColor ?? theme.color.text, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
        {value}
      </div>
      {footer ? <div style={{ marginTop: '8px' }}>{footer}</div> : null}
    </div>
  );
}

function App() {
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overlay' | 'original'>('overlay');
  const [patientName, setPatientName] = useState('');
  const [sessionSummaryLines, setSessionSummaryLines] = useState<string[] | null>(null);
  const lastAssessmentPatientRef = useRef<string | null>(null);
  const [timelineDay, setTimelineDay] = useState<number>(1);
  const [symptoms, setSymptoms] = useState<Record<SymptomKey, boolean>>({
    pain: false,
    swelling: false,
    redness: false,
    odor: false,
    fever: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const revokePreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const runPredict = useCallback(async (file: File) => {
    setIsLoading(true);
    setResult(null);
    setErrorMessage(null);
    setActiveTab('overlay');
    setSessionSummaryLines(null);

    const checkedKeys = SYMPTOM_OPTIONS.filter((o) => symptoms[o.key]).map((o) => o.key);
    const td = Math.min(365, Math.max(1, Math.floor(timelineDay) || 1));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('timeline_day', String(td));
    formData.append('symptoms', checkedKeys.join(','));

    try {
      const originalDataUrl = await fileToDataUrl(file);
      const { data } = await axios.post<PredictResult>(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const resolvedName = normalizePatientName(patientName);
      const previous = getLastVisit(resolvedName);
      appendVisit(resolvedName, {
        ...data,
        original_image_data_url: originalDataUrl,
        overlay_image_data_url: `data:image/png;base64,${data.overlay_base64}`,
      });
      setSessionSummaryLines(buildClinicalSummaryLines(data, previous));
      lastAssessmentPatientRef.current = resolvedName;
      setResult(data);
    } catch (err) {
      console.error('API Error:', err);
      setErrorMessage('ไม่สามารถวิเคราะห์ภาพได้ กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsLoading(false);
    }
  }, [symptoms, timelineDay, patientName]);

  const handleNewImage = useCallback(
    (file: File | undefined | null) => {
      if (!file || !file.type.startsWith('image/')) return;

      revokePreview(originalImagePreview);
      const url = URL.createObjectURL(file);
      setOriginalImagePreview(url);
      void runPredict(file);
    },
    [originalImagePreview, revokePreview, runPredict]
  );

  const onHiddenFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleNewImage(e.target.files?.[0]);
      e.target.value = '';
    },
    [handleNewImage]
  );

  const handleSelectPatientFromDirectory = useCallback((name: string) => {
    setPatientName(name);
    if (name !== lastAssessmentPatientRef.current) {
      setSessionSummaryLines(null);
    }
  }, []);

  const chartPatientKey = normalizePatientName(patientName);
  const progressionHistory = getVisitHistory(chartPatientKey);
  const patientDirectory = listPatientDirectory();

  const btnBase: CSSProperties = {
    flex: 1,
    minHeight: '52px',
    padding: '14px 16px',
    borderRadius: theme.radius.md,
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
    fontFamily: theme.font,
  };

  return (
    <div className="app-root" style={{ fontFamily: theme.font, background: theme.color.bgPage, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .app-root * { box-sizing: border-box; }
        .app-root button:focus-visible,
        .app-root input:focus-visible {
          outline: 2px solid ${theme.color.primary};
          outline-offset: 2px;
        }
        .app-root button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        @keyframes app-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes app-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onHiddenFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onHiddenFileChange} />

      <header
        style={{
          backgroundColor: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '22px 20px 20px',
          borderBottom: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              background: `linear-gradient(135deg, ${theme.color.primary} 0%, ${theme.color.accentTeal} 100%)`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 800,
              fontSize: '20px',
              boxShadow: theme.shadow.btnPrimary,
            }}
          >
            +
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(18px, 4.5vw, 24px)', color: theme.color.text, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Microsoft x AIAT Hackathon (Group 10)
          </h1>
        </div>
        <p style={{ margin: '12px 0 0 0', color: theme.color.textMuted, fontSize: '14px', fontWeight: 500, maxWidth: '420px', lineHeight: 1.5 }}>
          ระบบติดตามแผลเบาหวานด้วยภาพ
        </p>
      </header>

      <main style={{ padding: '24px 18px 48px', maxWidth: '640px', margin: '0 auto', width: '100%', flex: 1 }}>
        <Card style={{ padding: '14px 16px', marginBottom: '12px', borderLeft: `4px solid ${theme.color.primary}` }}>
          <SectionTitle
            compact
            title="ข้อมูลประกอบก่อนวิเคราะห์ภาพ"
            hint="ส่งพร้อมภาพเมื่อกดอัปโหลดหรือถ่ายภาพ"
          />
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <FieldLabel dense>ชื่อผู้ป่วย / รหัส (สำหรับประวัติและกราฟ)</FieldLabel>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="เช่น คุณสมชาย หรือ HN-1024"
              disabled={isLoading}
              autoComplete="name"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.color.borderStrong}`,
                fontSize: '15px',
                color: theme.color.text,
                fontFamily: theme.font,
                backgroundColor: theme.color.surface,
                boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)',
              }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <FieldLabel dense>วันที่ติดตาม (วัน)</FieldLabel>
            <input
              type="number"
              min={1}
              max={365}
              value={timelineDay}
              onChange={(e) => setTimelineDay(Number(e.target.value))}
              disabled={isLoading}
              style={{
                width: '100%',
                maxWidth: '112px',
                padding: '8px 12px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.color.borderStrong}`,
                fontSize: '15px',
                color: theme.color.text,
                fontFamily: theme.font,
                backgroundColor: theme.color.surface,
                boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)',
              }}
            />
          </label>
          <FieldLabel dense>การบันทึกอาการ</FieldLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '6px',
            }}
          >
            {SYMPTOM_OPTIONS.map((o) => (
              <label
                key={o.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isLoading ? 'default' : 'pointer',
                  fontSize: '12px',
                  color: theme.color.text,
                  fontWeight: 500,
                  padding: '7px 9px',
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${symptoms[o.key] ? theme.color.primary : theme.color.border}`,
                  backgroundColor: symptoms[o.key] ? 'rgba(14, 165, 233, 0.08)' : theme.color.surface,
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                  minHeight: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={symptoms[o.key]}
                  disabled={isLoading}
                  onChange={(e) => setSymptoms((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: theme.color.primary, flexShrink: 0 }}
                />
                <span style={{ lineHeight: 1.25 }}>{o.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '22px' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={{
              ...btnBase,
              border: `1px solid ${theme.color.borderStrong}`,
              backgroundColor: theme.color.surface,
              color: theme.color.text,
              boxShadow: theme.shadow.sm,
            }}
            onMouseDown={(e) => {
              if (!isLoading) e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = '';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
            }}
          >
            <span aria-hidden style={{ fontSize: '18px' }}>
              📂
            </span>
            อัปโหลดรูป
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isLoading}
            style={{
              ...btnBase,
              border: 'none',
              background: `linear-gradient(135deg, ${theme.color.primary} 0%, ${theme.color.primaryDark} 100%)`,
              color: '#ffffff',
              boxShadow: theme.shadow.btnPrimary,
            }}
            onMouseDown={(e) => {
              if (!isLoading) e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = '';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
            }}
          >
            <span aria-hidden style={{ fontSize: '18px' }}>
              📷
            </span>
            ถ่ายภาพ
          </button>
        </div>

        {isLoading && (
          <Card style={{ padding: '48px 28px', textAlign: 'center', marginBottom: '18px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                border: `3px solid rgba(14, 165, 233, 0.2)`,
                borderTopColor: theme.color.primary,
                borderRadius: '50%',
                animation: 'app-spin 0.85s linear infinite',
                margin: '0 auto 18px auto',
              }}
            />
            <p style={{ margin: 0, color: theme.color.textSoft, fontWeight: 600, fontSize: '15px', animation: 'app-pulse 1.4s ease-in-out infinite' }}>
              กำลังให้ AI ประมวลผล...
            </p>
          </Card>
        )}

        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: theme.color.errorBg,
              border: `1px solid ${theme.color.errorBorder}`,
              color: theme.color.errorText,
              padding: '18px 20px',
              borderRadius: theme.radius.md,
              textAlign: 'center',
              marginBottom: '20px',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: theme.shadow.sm,
            }}
          >
            {errorMessage}
          </div>
        )}

        {result && originalImagePreview && !isLoading && (
          <Card style={{ overflow: 'hidden', padding: 0, boxShadow: theme.shadow.lg }}>
            <div style={{ position: 'relative', width: '100%', backgroundColor: theme.color.viewerBg, aspectRatio: '4/3' }}>
              <img
                src={activeTab === 'overlay' ? `data:image/png;base64,${result.overlay_base64}` : originalImagePreview}
                alt="Wound Analysis"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />

              <div
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(12, 18, 34, 0.72)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  padding: '5px',
                  borderRadius: theme.radius.pill,
                  display: 'flex',
                  gap: '6px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('original')}
                  style={{
                    padding: '10px 18px',
                    borderRadius: theme.radius.pill,
                    border: 'none',
                    backgroundColor: activeTab === 'original' ? '#ffffff' : 'transparent',
                    color: activeTab === 'original' ? theme.color.text : 'rgba(255,255,255,0.92)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, color 0.2s ease',
                    fontFamily: theme.font,
                  }}
                >
                  ภาพต้นฉบับ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('overlay')}
                  style={{
                    padding: '10px 18px',
                    borderRadius: theme.radius.pill,
                    border: 'none',
                    backgroundColor: activeTab === 'overlay' ? '#ffffff' : 'transparent',
                    color: activeTab === 'overlay' ? theme.color.text : 'rgba(255,255,255,0.92)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, color 0.2s ease',
                    fontFamily: theme.font,
                  }}
                >
                  ภาพที่ถูกประมวลผล
                </button>
              </div>
            </div>

            <div style={{ padding: '26px 22px 28px' }}>
              <h2 style={{ margin: '0 0 18px 0', fontSize: '19px', color: theme.color.text, fontWeight: 800, letterSpacing: '-0.03em' }}>
                ผลการวิเคราะห์
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <MetricTile label="พื้นที่บาดแผล (พิกเซล)" value={result.wound_area_pixels.toLocaleString()} valueColor={theme.color.primary} />
                <MetricTile
                  label="คะแนนความเสี่ยง (Risk score)"
                  value={result.risk_score}
                  valueColor={theme.color.danger}
                  footer={<span style={{ fontSize: '13px', fontWeight: 700, color: theme.color.textSoft }}>ระดับ: {result.risk_level_th}</span>}
                />
                <MetricTile
                  label="การบันทึกอาการ (Symptom check-in)"
                  value={<span style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.45 }}>{formatSymptomLine(result.symptoms_checked)}</span>}
                  valueColor={theme.color.text}
                />
                <MetricTile label="Timeline" value={`วันที่ ${result.timeline_day}`} valueColor={theme.color.text} />
              </div>

              <div style={{ marginTop: '14px' }}>
                <MetricTile label="สัดส่วนแผลต่อภาพ" value={`${result.wound_ratio_percent}%`} valueColor={theme.color.danger} />
              </div>

              <div style={{ marginTop: '22px' }}>
                <VisitInsightsSection
                  summaryLines={sessionSummaryLines}
                  directory={patientDirectory}
                  chartHistory={progressionHistory}
                  chartPatientLabel={chartPatientKey}
                  activePatientName={chartPatientKey}
                  onSelectPatient={handleSelectPatientFromDirectory}
                />
              </div>

              <div
                style={{
                  marginTop: '22px',
                  padding: '16px 18px',
                  backgroundColor: theme.color.warningBg,
                  borderRadius: theme.radius.sm,
                  borderLeft: `4px solid ${theme.color.warningBorder}`,
                  boxShadow: theme.shadow.sm,
                }}
              >
                <p style={{ margin: 0, fontSize: '13px', color: theme.color.warningText, lineHeight: 1.55, fontWeight: 500 }}>
                  <strong style={{ fontWeight: 800 }}>หมายเหตุ:</strong> ข้อมูลนี้วิเคราะห์โดยโมเดล U-Net (DFUC2022) เพื่อประกอบการตัดสินใจเบื้องต้น ไม่สามารถใช้ทดแทนการวินิจฉัยของแพทย์ได้
                </p>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

export default App;
