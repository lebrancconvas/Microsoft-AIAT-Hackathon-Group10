import type { PatientDirectoryRow, VisitRecord } from './types';

const STORAGE_KEY = 'microsoft-ai-hack-g10-progression-v1';
const DEFAULT_PATIENT_LABEL = 'ผู้ป่วยทั่วไป';

/** Minimal placeholder when trimming payload so localStorage quota fits */
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export type PredictSnapshotInput = {
  observation_date: string;
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

function observationDayStartMs(ymd: string): number | null {
  const parts = ymd.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d).getTime();
}

/** Sort oldest → newest observation, then earlier upload first */
export function compareVisitsByObservationThenAt(a: VisitRecord, b: VisitRecord): number {
  const ma = a.observationDate ? observationDayStartMs(a.observationDate) : null;
  const mb = b.observationDate ? observationDayStartMs(b.observationDate) : null;
  const ta = ma ?? new Date(a.at).getTime();
  const tb = mb ?? new Date(b.at).getTime();
  if (ta !== tb) return ta - tb;
  return new Date(a.at).getTime() - new Date(b.at).getTime();
}

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

/** Raw disk snapshot only (no in-memory overlay). */
function readLocalStorageStore(): Record<string, VisitRecord[]> {
  if (typeof localStorage === 'undefined') return {};
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

/**
 * When localStorage is full or blocked, visits for this tab live here so the UI still updates.
 * Lost on full page reload — acceptable fallback for demos / privacy modes.
 */
const memorySessionByPatient: Record<string, VisitRecord[]> = {};

function dedupeVisitsById(lists: VisitRecord[][]): VisitRecord[] {
  const map = new Map<string, VisitRecord>();
  for (const list of lists) {
    for (const v of list) {
      map.set(v.id, v);
    }
  }
  return Array.from(map.values());
}

function visitsForPatientMerged(patientName: string): VisitRecord[] {
  const ls = readLocalStorageStore()[patientName] ?? [];
  const mem = memorySessionByPatient[patientName] ?? [];
  return dedupeVisitsById([ls, mem]);
}

export function loadPatientStore(): Record<string, VisitRecord[]> {
  const ls = readLocalStorageStore();
  const keys = Array.from(new Set([...Object.keys(ls), ...Object.keys(memorySessionByPatient)]));
  const out: Record<string, VisitRecord[]> = {};
  for (const k of keys) {
    const merged = [...visitsForPatientMerged(k)].sort(compareVisitsByObservationThenAt);
    if (merged.length) out[k] = merged;
  }
  return out;
}

export function savePatientStore(store: Record<string, VisitRecord[]>): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function normalizePatientName(raw: string): string {
  const t = raw.trim();
  return t.length > 0 ? t : DEFAULT_PATIENT_LABEL;
}

export function getLastVisit(patientName: string): VisitRecord | null {
  const sorted = [...visitsForPatientMerged(patientName)].sort(compareVisitsByObservationThenAt);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

export function getVisitHistory(patientName: string): VisitRecord[] {
  const list = [...visitsForPatientMerged(patientName)];
  list.sort(compareVisitsByObservationThenAt);
  return list;
}

function trimToMaxOldestFirst(list: VisitRecord[]): VisitRecord[] {
  const next = [...list];
  while (next.length > MAX_VISITS_PER_PATIENT) next.shift();
  return next;
}

function tryPersistPatientList(patientName: string, list: VisitRecord[]): boolean {
  const store = { ...readLocalStorageStore(), [patientName]: list };
  return savePatientStore(store);
}

export type AppendVisitOutcome = {
  record: VisitRecord;
  /** false = kept in tab memory only (quota / private mode); UI still updates */
  savedToLocalStorage: boolean;
};

/**
 * Persist a new visit. Drops oldest saved visits (by observation date) if quota is exceeded,
 * then may replace the original-image payload with a tiny placeholder so at least overlay + metrics persist.
 * If localStorage still fails, keeps this tab's history in memory so charts/history render immediately.
 */
export function appendVisit(patientName: string, input: PredictSnapshotInput): AppendVisitOutcome {
  const baseRecord: VisitRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}`,
    at: new Date().toISOString(),
    observationDate: input.observation_date,
    timelineDay: input.timeline_day,
    woundAreaPixels: input.wound_area_pixels,
    woundRatioPercent: input.wound_ratio_percent,
    riskScore: input.risk_score,
    riskLevelTh: input.risk_level_th,
    symptomsChecked: input.symptoms_checked,
    originalImageDataUrl: input.original_image_data_url,
    overlayImageDataUrl: input.overlay_image_data_url,
  };

  const sortedBase = [...visitsForPatientMerged(patientName)].sort(compareVisitsByObservationThenAt);

  const attempts: VisitRecord[] = [baseRecord, { ...baseRecord, originalImageDataUrl: TINY_PNG_DATA_URL }];

  for (const candidate of attempts) {
    for (let dropCount = 0; dropCount <= sortedBase.length; dropCount++) {
      const merged = trimToMaxOldestFirst([...sortedBase.slice(dropCount), candidate].sort(compareVisitsByObservationThenAt));
      if (tryPersistPatientList(patientName, merged)) {
        delete memorySessionByPatient[patientName];
        return { record: candidate, savedToLocalStorage: true };
      }
    }
  }

  const fallback = attempts[1];
  const mergedMem = trimToMaxOldestFirst([...sortedBase, fallback].sort(compareVisitsByObservationThenAt));
  memorySessionByPatient[patientName] = mergedMem;
  return { record: fallback, savedToLocalStorage: false };
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
