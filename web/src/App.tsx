import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios';
import './App.css'

type Prediction = {
  label: string
  confidence: number
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// const MOCK_LABELS = ['Cat', 'Dog', 'Car', 'Flower', 'Building', 'Food']

// function getConfidenceSeed(text: string): number {
//   return text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
// }

// function createMockPredictions(fileName: string): Prediction[] {
//   const seed = getConfidenceSeed(fileName) || 1
//   const firstIndex = seed % MOCK_LABELS.length
//   const secondIndex = (firstIndex + 2) % MOCK_LABELS.length
//   const thirdIndex = (firstIndex + 4) % MOCK_LABELS.length

//   const top = 0.75 + (seed % 15) / 100
//   const second = top - 0.17
//   const third = second - 0.14

//   return [
//     { label: MOCK_LABELS[firstIndex], confidence: top },
//     { label: MOCK_LABELS[secondIndex], confidence: second },
//     { label: MOCK_LABELS[thirdIndex], confidence: third },
//   ]
// }

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ''),
    [selectedFile]
  )

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  const resetResult = () => {
    setPredictions([])
    setErrorMessage('')
  }

  const validateImage = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage('Please upload JPG, PNG, or WEBP image format.')
      return false
    }
    setErrorMessage('')
    return true
  }

  const onSelectFile = (file: File | null) => {
    if (!file) return
    if (!validateImage(file)) return
    setSelectedFile(file)
    resetResult()
  }

  const onPredict = async () => {
    if (!selectedFile) {
      setErrorMessage('Please choose an image before predicting.')
      return
    }

    setIsLoading(true)
    setPredictions([])
    setErrorMessage('')

    // await new Promise((resolve) => setTimeout(resolve, 1600))
    // setPredictions(createMockPredictions(selectedFile.name))

    try {
      const formData = new FormData();
      formData.append("file", selectedFile); 

      const response = await axios.post("http://localhost:8000/api/predict", formData);

      if (!response) {
        throw new Error(`Server responded with status: ${response.status}`)
      }

      const data = await response.data;
      if(data && data.prediction) {
        setPredictions(data.prediction);
      } else {
        setErrorMessage("Cannot get prediction data.");
      }

    } catch(err) {
      console.error(`Prediction Error: ${err}`);
      setErrorMessage("Cannot Predict.");
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>Image Classification</h1>
        <p className="subtext">
          Upload an image or drag and drop it below, then run prediction.
        </p>

        <div
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            const file = event.dataTransfer.files?.[0] ?? null
            onSelectFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
          />

          {!selectedFile ? (
            <div className="placeholder">
              <strong>Drop image here</strong>
              <span>or click to browse image file</span>
            </div>
          ) : (
            <div className="preview">
              <img src={previewUrl} alt="Selected preview" />
              <div>
                <strong>{selectedFile.name}</strong>
                <p>{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}
        </div>

        {errorMessage && <p className="error">{errorMessage}</p>}

        <button
          className="predictButton"
          type="button"
          onClick={onPredict}
          disabled={isLoading}
        >
          {isLoading ? 'Predicting...' : 'Predict'}
        </button>

        {isLoading && (
          <div className="loadingBox">
            <div className="spinner" />
            <p>Analyzing image and preparing prediction...</p>
          </div>
        )}

        {predictions.length > 0 && (
          <section className="resultBox">
            <h2>Prediction Result</h2>
            <ul>
              {predictions.map((item) => (
                <li key={item.label}>
                  <div className="resultRow">
                    <span>{item.label}</span>
                    <span>{(item.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="barTrack">
                    <div
                      className="barFill"
                      style={{ width: `${(item.confidence * 100).toFixed(1)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  )
}

export default App