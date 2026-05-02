/** Single saved assessment after /predict (client-side history). */
export type VisitRecord = {
  id: string;
  at: string;
  timelineDay: number;
  woundAreaPixels: number;
  woundRatioPercent: number;
  riskScore: number;
  riskLevelTh: string;
  symptomsChecked: string[];
  originalImageDataUrl: string;
  overlayImageDataUrl: string;
};

export type PatientDirectoryRow = {
  patientName: string;
  visitCount: number;
  lastAt: string;
  lastRiskLevelTh: string;
  lastRiskScore: number;
};
