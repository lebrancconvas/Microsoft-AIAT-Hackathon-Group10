from fastapi import FastAPI, UploadFile, File
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

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
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
    
    return {
        "wound_area_pixels": wound_pixels,
        "wound_ratio_percent": round(wound_ratio, 2),
        "mask_base64": image_to_base64(prediction_mask_cv),
        "overlay_base64": image_to_base64(overlay_cv)
    }