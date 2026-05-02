import React, { useCallback, useRef, useState } from 'react';
import axios from 'axios';

// const API_URL = import.meta.env.VITE_API_URL ?? 'https://awry-morality-garnet.ngrok-free.dev/predict';

const API_URL = "/predict";

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

function formatSymptomLine(keys: string[]): string {
  const labelByKey = Object.fromEntries(SYMPTOM_OPTIONS.map((o) => [o.key, o.label])) as Record<string, string>;
  if (!keys.length) return 'ไม่มีอาการที่เลือก';
  return keys.map((k) => labelByKey[k] ?? k).join(' · ');
}

function App() {
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overlay' | 'original'>('overlay');
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

    const checkedKeys = SYMPTOM_OPTIONS.filter((o) => symptoms[o.key]).map((o) => o.key);
    const td = Math.min(365, Math.max(1, Math.floor(timelineDay) || 1));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('timeline_day', String(td));
    formData.append('symptoms', checkedKeys.join(','));

    try {
      const { data } = await axios.post<PredictResult>(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (err) {
      console.error('API Error:', err);
      setErrorMessage('ไม่สามารถวิเคราะห์ภาพได้ กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsLoading(false);
    }
  }, [symptoms, timelineDay]);

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

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handleNewImage(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { handleNewImage(e.target.files?.[0]); e.target.value = ''; }} />

      {/* Header */}
      <header style={{ backgroundColor: '#ffffff', padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', backgroundColor: '#0ea5e9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>+</div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Microsoft x AIAT Hackathon (Group 10)</h1>
        </div>
        <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>ระบบติดตามแผลเบาหวานด้วยภาพ</p>  
      </header>

      <main style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box', flex: 1 }}>
        
        {/* Timeline + symptom check-in (ส่งประกอบการประเมินพร้อมภาพ) */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>ข้อมูลประกอบก่อนวิเคราะห์ภาพ</p>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Timeline — วันที่ติดตาม (วัน)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={timelineDay}
              onChange={(e) => setTimelineDay(Number(e.target.value))}
              disabled={isLoading}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', color: '#0f172a' }}
            />
          </label>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>การบันทึกอาการ (Symptom check-in)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SYMPTOM_OPTIONS.map((o) => (
              <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={symptoms[o.key]}
                  disabled={isLoading}
                  onChange={(e) => setSymptoms((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#0ea5e9' }}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button 
            onClick={() => fileInputRef.current?.click()} disabled={isLoading}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            📂 อัปโหลดรูป
          </button>
          <button 
            onClick={() => cameraInputRef.current?.click()} disabled={isLoading}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#0ea5e9', color: '#ffffff', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.2)' }}
          >
            📷 ถ่ายภาพ
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #e0f2fe', borderTop: '3px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
            <p style={{ margin: 0, color: '#475569', fontWeight: '500' }}>กำลังให้ AI ประมวลผล...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '20px' }}>
            {errorMessage}
          </div>
        )}

        {/* Results Card */}
        {result && originalImagePreview && !isLoading && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            
            {/* Image Viewer with Tabs */}
            <div style={{ position: 'relative', width: '100%', backgroundColor: '#0f172a', aspectRatio: '4/3' }}>
              <img 
                src={activeTab === 'overlay' ? `data:image/png;base64,${result.overlay_base64}` : originalImagePreview} 
                alt="Wound Analysis" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
              
              {/* Floating Tab Controls inside image */}
              <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', padding: '4px', borderRadius: '20px', display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => setActiveTab('original')}
                  style={{ padding: '6px 16px', borderRadius: '16px', border: 'none', backgroundColor: activeTab === 'original' ? '#ffffff' : 'transparent', color: activeTab === 'original' ? '#0f172a' : '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ภาพต้นฉบับ
                </button>
                <button 
                  onClick={() => setActiveTab('overlay')}
                  style={{ padding: '6px 16px', borderRadius: '16px', border: 'none', backgroundColor: activeTab === 'overlay' ? '#ffffff' : 'transparent', color: activeTab === 'overlay' ? '#0f172a' : '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ภาพที่ถูกประมวลผล   
                </button>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div style={{ padding: '24px' }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>ผลการวิเคราะห์</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>พื้นที่บาดแผล (พิกเซล)</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#0ea5e9' }}>{result.wound_area_pixels.toLocaleString()}</p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>คะแนนความเสี่ยง (Risk score)</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#f43f5e' }}>{result.risk_score}</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', fontWeight: '600', color: '#475569' }}>ระดับ: {result.risk_level_th}</p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>การบันทึกอาการ (Symptom check-in)</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0f172a', lineHeight: 1.45 }}>{formatSymptomLine(result.symptoms_checked)}</p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>Timeline</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>วันที่ {result.timeline_day}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>สัดส่วนแผลต่อภาพ</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#f43f5e' }}>{result.wound_ratio_percent}%</p>
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#92400e', lineHeight: '1.5' }}>
                  <strong>หมายเหตุ:</strong> ข้อมูลนี้วิเคราะห์โดยโมเดล U-Net (DFUC2022) เพื่อประกอบการตัดสินใจเบื้องต้น ไม่สามารถใช้ทดแทนการวินิจฉัยของแพทย์ได้
                </p>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;