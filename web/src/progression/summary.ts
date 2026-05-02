import type { PredictSnapshotInput } from './store';
import type { VisitRecord } from './types';

const RATIO_EPS = 0.07;

/**
 * Thai clinical-style summary lines comparing current predict vs previous visit (if any).
 */
export function buildClinicalSummaryLines(current: PredictSnapshotInput, previous: VisitRecord | null): string[] {
  const lines: string[] = [];

  if (!previous) {
    lines.push('บันทึกครั้งแรกสำหรับผู้ป่วยรายนี้ — ครั้งถัดไปจะใช้เปรียบเทียบแนวโน้มพื้นที่แผลและความเสี่ยง');
  } else {
    const prevArea = previous.woundAreaPixels;
    const curArea = current.wound_area_pixels;
    if (prevArea > 0) {
      const ratioChange = (curArea - prevArea) / prevArea;
      if (ratioChange > RATIO_EPS) {
        lines.push('พื้นที่แผลเพิ่มขึ้นจากครั้งก่อน — ควรโทรติดตามหรือปรึกษาแพทย์เพื่อประเมินซ้ำ');
      } else if (ratioChange < -RATIO_EPS) {
        lines.push('พื้นที่แผลลดลงจากครั้งก่อน — แนวโน้มดีขึ้น ควรสังเกตอาการและถ่ายภาพติดตามต่อ');
      } else {
        lines.push('พื้นที่แผลใกล้เคียงครั้งก่อน — ควรทำตามแผนการดูแลและติดตามต่อเนื่อง');
      }
    }

    if (current.risk_score > previous.riskScore + 8) {
      lines.push('คะแนนความเสี่ยงสูงขึ้นจากครั้งก่อน — หากมีอาการผิดปกติควรขอคำแนะนำทางการแพทย์');
    } else if (current.risk_score + 8 < previous.riskScore) {
      lines.push('คะแนนความเสี่ยงต่ำลงจากครั้งก่อน — ควรรักษาการดูแลและบันทึกอาการต่อเนื่อง');
    }

    if (current.risk_level_th === 'สูง') {
      lines.push('ระดับความเสี่ยงอยู่ในระดับสูง — แนะนำให้ประเมินใกล้ชิดและพิจารณาพบผู้เชี่ยวชาญ');
    } else if (current.risk_level_th === 'ปานกลาง') {
      lines.push('ระดับความเสี่ยงปานกลาง — ควรเฝ้าระวังและทบทวนการดูแลแผลเป็นประจำ');
    }
  }

  if (!lines.length) {
    lines.push('สรุป: ประเมินจากภาพและข้อมูลที่กรอก — ใช้ประกอบการติดตามเท่านั้น ไม่แทนการวินิจฉัยของแพทย์');
  }

  return lines;
}
