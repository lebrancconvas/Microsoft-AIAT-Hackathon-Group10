import type { PatientDirectoryRow, VisitRecord } from './types';

const STORAGE_KEY = 'microsoft-ai-hack-g10-progression-v1';
const DEFAULT_PATIENT_LABEL = 'ผู้ป่วยทั่วไป';

export type PredictSnapshotInput = {
  timeline_day: number;
  wound_area_pixels: number;
  wound_ratio_percent: number;
  risk_score: number;
  risk_level_th: string;
  symptoms_checked: string[];
  original_image_data_url: string;
  overlay_image_data_url: string;
};
const MAX_VISITS_PER_PATIENT = 30;

function safeParse(raw: string | null): Record<string, VisitRecord[]> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) return {};
    return v as Record<string, VisitRecord[]>;
  } catch {
    return {};
  }
}

export function loadPatientStore(): Record<string, VisitRecord[]> {
  if (typeof localStorage === 'undefined') return {};
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function savePatientStore(store: Record<string, VisitRecord[]>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function normalizePatientName(raw: string): string {
  const t = raw.trim();
  return t.length > 0 ? t : DEFAULT_PATIENT_LABEL;
}

export function getLastVisit(patientName: string): VisitRecord | null {
  const list = loadPatientStore()[patientName];
  if (!list?.length) return null;
  return list[list.length - 1];
}

export function getVisitHistory(patientName: string): VisitRecord[] {
  return [...(loadPatientStore()[patientName] ?? [])];
}

export function appendVisit(patientName: string, input: PredictSnapshotInput): VisitRecord {
  const store = loadPatientStore();
  const list = store[patientName] ?? [];
  const record: VisitRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}`,
    at: new Date().toISOString(),
    timelineDay: input.timeline_day,
    woundAreaPixels: input.wound_area_pixels,
    woundRatioPercent: input.wound_ratio_percent,
    riskScore: input.risk_score,
    riskLevelTh: input.risk_level_th,
    symptomsChecked: input.symptoms_checked,
    originalImageDataUrl: input.original_image_data_url,
    overlayImageDataUrl: input.overlay_image_data_url,
  };
  list.push(record);
  if (list.length > MAX_VISITS_PER_PATIENT) {
    list.splice(0, list.length - MAX_VISITS_PER_PATIENT);
  }
  store[patientName] = list;
  savePatientStore(store);
  return record;
}

export function listPatientDirectory(): PatientDirectoryRow[] {
  const store = loadPatientStore();
  const rows: PatientDirectoryRow[] = [];
  for (const [patientName, visits] of Object.entries(store)) {
    if (!visits?.length) continue;
    const last = visits[visits.length - 1];
    rows.push({
      patientName,
      visitCount: visits.length,
      lastAt: last.at,
      lastRiskLevelTh: last.riskLevelTh,
      lastRiskScore: last.riskScore,
    });
  }
  rows.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return rows;
}
