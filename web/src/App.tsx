import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/predict';

type PredictResult = {
  wound_area_pixels: number;
  mask_base64: string;
  overlay_base64: string;
};

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const revokePreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const runPredict = useCallback(async (file: File) => {
    setIsLoading(true);
    setResult(null);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await axios.post<PredictResult>(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (err) {
      console.error('Error uploading image:', err);
      setErrorMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หรือประมวลผลภาพได้ กรุณาลองอีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNewImage = useCallback(
    (file: File | undefined | null) => {
      if (!file || !file.type.startsWith('image/')) {
        setErrorMessage('กรุณาเลือกไฟล์รูปภาพ (เช่น JPG, PNG)');
        return;
      }

      revokePreview(originalImagePreview);
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setOriginalImagePreview(url);
      setResult(null);
      setErrorMessage(null);
      void runPredict(file);
    },
    [originalImagePreview, revokePreview, runPredict]
  );

  useEffect(() => {
    return () => {
      if (originalImagePreview) URL.revokeObjectURL(originalImagePreview);
    };
  }, [originalImagePreview]);

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleNewImage(event.target.files?.[0]);
    event.target.value = '';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    handleNewImage(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="app">
      <div className="app__glow" aria-hidden />
      <header className="app__header">
        <p className="app__eyebrow">Microsoft × AIAT Hackathon · Group 10</p>
        <h1 className="app__title">ระบบประเมินและวิเคราะห์บาดแผล</h1>
        <p className="app__subtitle">
          อัปโหลดหรือลากวางภาพบาดแผล — ระบบจะวิเคราะห์อัตโนมัติและแสดงผลการแบ่งกลุ่ม (segmentation)
        </p>
      </header>

      <section className="upload-card">
        <div
          className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${isLoading ? 'dropzone--busy' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!isLoading) fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="dropzone__input"
            onChange={onFileInputChange}
            disabled={isLoading}
          />

          <div className="dropzone__inner">
            <span className="dropzone__icon" aria-hidden>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="dropzone__title">
              {isLoading ? 'กำลังวิเคราะห์ภาพ…' : 'ลากวางภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
            </p>
            <p className="dropzone__hint">รองรับ JPG, PNG, WEBP — ไม่ต้องกดปุ่มวิเคราะห์เพิ่ม</p>
          </div>

          {selectedFile && originalImagePreview && (
            <div className="dropzone__thumb">
              <img src={originalImagePreview} alt="" />
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="app__error" role="alert">
            {errorMessage}
          </p>
        )}
      </section>

      {isLoading && (
        <div className="loading-strip" aria-live="polite">
          <span className="loading-strip__spinner" />
          <span>กำลังประมวลผลโมเดล U-Net และสร้างมาสก์…</span>
        </div>
      )}

      {result && originalImagePreview && (
        <section className="results">
          <div className="results__head">
            <h2>ผลลัพธ์การประเมิน</h2>
            <span className="results__badge">
              พื้นที่บาดแผลโดยประมาณ · {result.wound_area_pixels.toLocaleString()} พิกเซล
            </span>
          </div>

          <div className="results__grid">
            <figure className="result-panel">
              <figcaption>ภาพต้นฉบับ</figcaption>
              <div className="result-panel__frame">
                <img src={originalImagePreview} alt="ภาพต้นฉบับ" />
              </div>
            </figure>

            <figure className="result-panel">
              <figcaption>มาสก์ที่ทำนาย (Prediction mask)</figcaption>
              <div className="result-panel__frame">
                <img src={`data:image/png;base64,${result.mask_base64}`} alt="มาสก์การแบ่งกลุ่ม" />
              </div>
            </figure>

            <figure className="result-panel">
              <figcaption>ซ้อนทับบนภาพ (Overlay)</figcaption>
              <div className="result-panel__frame">
                <img src={`data:image/png;base64,${result.overlay_base64}`} alt="ภาพซ้อนทับบริเวณบาดแผล" />
              </div>
            </figure>
          </div>

          <div className="metrics">
            <table className="metrics__table">
              <thead>
                <tr>
                  <th>พื้นที่บาดแผล (พิกเซล)</th>
                  <th>ระดับความเสี่ยง (ตัวอย่าง)</th>
                  <th>Timeline (ตัวอย่าง)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{result.wound_area_pixels.toLocaleString()}</td>
                  <td>{result.wound_area_pixels > 10000 ? 'สูง' : 'ปานกลาง'}</td>
                  <td>วันที่ 3</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
