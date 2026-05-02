import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setOriginalImagePreview(URL.createObjectURL(file));
      setResult(null); // เคลียร์ผลลัพธ์เก่าเมื่อเลือกรูปใหม่
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // ยิง API ไปที่ FastAPI Backend
      const response = await axios.post('http://localhost:8000/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการประมวลผล');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🩺 ระบบประเมินและวิเคราะห์บาดแผล (Wound Segmentation)</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button 
          onClick={handleUpload} 
          disabled={!selectedFile || isLoading}
          style={{ marginLeft: '10px', padding: '5px 15px', cursor: isLoading ? 'wait' : 'pointer' }}
        >
          {isLoading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ภาพ'}
        </button>
      </div>

      {result && (
        <>
          <h3>ผลลัพธ์การประเมิน (Evaluation Results)</h3>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
            {/* คอลัมน์ที่ 1: ภาพต้นฉบับ */}
            <div style={{ flex: 1 }}>
              <p>Original Image</p>
              <img src={originalImagePreview!} alt="Original" style={{ width: '100%', borderRadius: '8px' }} />
            </div>
            
            {/* คอลัมน์ที่ 2: ภาพ Mask */}
            <div style={{ flex: 1 }}>
              <p>Prediction Mask</p>
              <img src={`data:image/png;base64,${result.mask_base64}`} alt="Mask" style={{ width: '100%', borderRadius: '8px' }} />
            </div>

            {/* คอลัมน์ที่ 3: ภาพ Overlay */}
            <div style={{ flex: 1 }}>
              <p>Overlay (Wound Area)</p>
              <img src={`data:image/png;base64,${result.overlay_base64}`} alt="Overlay" style={{ width: '100%', borderRadius: '8px' }} />
            </div>
          </div>

          {/* ตารางข้อมูล */}
          <h3>ข้อมูลผู้ป่วย/ผลวิเคราะห์</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '10px' }}>Wound Area (Pixels)</th>
                <th style={{ padding: '10px' }}>Risk Score</th>
                <th style={{ padding: '10px' }}>Timeline</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px' }}>{result.wound_area_pixels.toLocaleString()}</td>
                <td style={{ padding: '10px' }}>{result.wound_area_pixels > 10000 ? 'High' : 'Medium'}</td>
                <td style={{ padding: '10px' }}>Day 3</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default App;  