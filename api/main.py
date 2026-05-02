from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import torch
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import cv2
import io
import base64
from collections import OrderedDict

# นำเข้า Class โมเดลจากไฟล์ของคุณ
from unet_model import UNet

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}

print("Loading model...")
model = UNet(in_channels=3, out_channels=1, base_channels=32)
checkpoint = torch.load("./best_unet_dfuc2022.pth", map_location=torch.device('cpu'))

new_state_dict = OrderedDict()
for k, v in checkpoint['model_state_dict'].items():
    name = k.replace("module.", "")
    new_state_dict[name] = v

model.load_state_dict(new_state_dict)
model.eval()
print("Model loaded successfully!")

def image_to_base64(img_array):
    """แปลง numpy array เป็น Base64 string"""
    _, buffer = cv2.imencode('.png', img_array)
    return base64.b64encode(buffer).decode('utf-8')

SYMPTOM_WEIGHT = {
    "pain": 8,
    "swelling": 12,
    "redness": 8,
    "odor": 15,
    "fever": 20,
}

ALLOWED_SYMPTOMS = frozenset(SYMPTOM_WEIGHT.keys())


def compute_risk_score(wound_ratio_percent: float, timeline_day: int, symptom_keys: list[str]) -> tuple[int, str]:
    """คำนวณคะแนนความเสี่ยง (0–100) และระดับเป็นภาษาไทยจากพื้นที่แผล อาการ และ timeline"""
    base = min(55.0, float(wound_ratio_percent) * 4.0)
    symptom_extra = sum(SYMPTOM_WEIGHT[k] for k in symptom_keys if k in SYMPTOM_WEIGHT)
    td = max(1, min(int(timeline_day), 365))
    timeline_extra = min(12.0, max(0, td - 1) * 0.75)
    score = int(min(100, round(base + symptom_extra + timeline_extra)))
    if score < 35:
        level_th = "ต่ำ"
    elif score < 65:
        level_th = "ปานกลาง"
    else:
        level_th = "สูง"
    return score, level_th


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    timeline_day: int = Form(1),
    symptoms: str = Form(""),
):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    transform = transforms.Compose([
        transforms.Resize((384, 512)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    input_tensor = transform(image).unsqueeze(0)
    
    with torch.no_grad():
        output = model(input_tensor)
        prob_mask = torch.sigmoid(output).squeeze().numpy()
        
    mask_bool = prob_mask > 0.5
    prediction_mask_cv = (mask_bool * 255).astype(np.uint8)
    
    # --- ปรับปรุงการทำ Overlay สีแดงโปร่งแสง ---
    orig_cv = cv2.cvtColor(np.array(image.resize((512, 384))), cv2.COLOR_RGB2BGR)
    
    # สร้างแผ่นสีแดงล้วน
    red_mask = np.zeros_like(orig_cv)
    red_mask[:, :, 2] = 255 # ช่องสีแดงในระบบ BGR
    
    # นำสีแดงมาผสมกับภาพเดิมเฉพาะจุดที่เป็นแผล (Alpha = 0.5)
    alpha = 0.5
    mask_3d = np.stack([mask_bool]*3, axis=-1)
    overlay_cv = np.where(mask_3d, cv2.addWeighted(orig_cv, 1-alpha, red_mask, alpha, 0), orig_cv)
    
    # เพิ่มขอบสีแดงเข้มให้ดูชัดเจนขึ้น
    contours, _ = cv2.findContours(prediction_mask_cv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay_cv, contours, -1, (0, 0, 200), 2)
    
    # คำนวณพื้นที่
    wound_pixels = int(np.sum(mask_bool))
    total_pixels = 384 * 512
    wound_ratio = (wound_pixels / total_pixels) * 100

    td = max(1, min(int(timeline_day), 365))
    raw_keys = [s.strip().lower() for s in symptoms.split(",") if s.strip()]
    symptom_keys = list(dict.fromkeys(k for k in raw_keys if k in ALLOWED_SYMPTOMS))

    risk_score, risk_level_th = compute_risk_score(wound_ratio, td, symptom_keys)

    return {
        "wound_area_pixels": wound_pixels,
        "wound_ratio_percent": round(wound_ratio, 2),
        "risk_score": risk_score,
        "risk_level_th": risk_level_th,
        "timeline_day": td,
        "symptoms_checked": symptom_keys,
        "mask_base64": image_to_base64(prediction_mask_cv),
        "overlay_base64": image_to_base64(overlay_cv),
    }