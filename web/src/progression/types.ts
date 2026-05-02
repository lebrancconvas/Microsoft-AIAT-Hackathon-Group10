/** Single saved assessment after /predict (client-side history). */
export type VisitRecord = {
  id: string;
  /** ISO instant for sorting; combines assigned observation **calendar date** with upload clock time. */
  at: string;
  /** `YYYY-MM-DD` — date assigned as day of observation (สังเกตการณ์). Missing on older saved visits. */
  observationDate?: string;
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
