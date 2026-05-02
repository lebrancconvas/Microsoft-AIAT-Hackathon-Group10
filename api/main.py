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
from unet_model import UNet # คลาสโมเดลของคุณ

app = FastAPI()

# อนุญาตให้ Frontend (React) เรียกใช้งาน API ข้ามโดเมนได้ (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # ในโปรดักชันควรเปลี่ยนเป็น URL ของ Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# โหลดโมเดลตอนเริ่มเซิร์ฟเวอร์
model = UNet(in_channels=3, out_channels=1, base_channels=32)
checkpoint = torch.load("./best_unet_dfuc2022.pth", map_location=torch.device('cpu'))
new_state_dict = OrderedDict({k.replace("module.", ""): v for k, v in checkpoint['model_state_dict'].items()})
model.load_state_dict(new_state_dict)
model.eval()

# ฟังก์ชันแปลงภาพเป็น Base64 เพื่อส่งกลับให้ React
def image_to_base64(img_array):
    _, buffer = cv2.imencode('.png', img_array)
    return base64.b64encode(buffer).decode('utf-8')

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # 1. อ่านไฟล์ภาพ
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # 2. Pre-processing
    transform = transforms.Compose([
        transforms.Resize((384, 512)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    input_tensor = transform(image).unsqueeze(0)
    
    # 3. Inference
    with torch.no_grad():
        output = model(input_tensor)
        prob_mask = torch.sigmoid(output).squeeze().numpy()
        
    # 4. สร้างรูปภาพผลลัพธ์
    mask_bool = prob_mask > 0.5
    prediction_mask_cv = (mask_bool * 255).astype(np.uint8)
    
    # สร้าง Overlay
    orig_cv = cv2.cvtColor(np.array(image.resize((512, 384))), cv2.COLOR_RGB2BGR)
    overlay_color = np.zeros_like(orig_cv)
    overlay_color[:, :, 2] = 255 # สีแดง (OpenCV ใช้ BGR)
    mask_3d = np.repeat(mask_bool[:, :, np.newaxis], 3, axis=2)
    overlay_cv = np.where(mask_3d, cv2.addWeighted(orig_cv, 0.7, overlay_color, 0.3, 0), orig_cv)
    
    # 5. คำนวณพื้นที่
    wound_pixels = int(np.sum(mask_bool))
    
    # ส่งผลลัพธ์กลับเป็น JSON
    return {
        "wound_area_pixels": wound_pixels,
        "mask_base64": image_to_base64(prediction_mask_cv),
        "overlay_base64": image_to_base64(overlay_cv)
    }

# วิธีรัน: uvicorn main:app --reload --port 8000