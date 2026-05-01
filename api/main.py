from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel   

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# class ImageForm(BaseModel):
#   body: File

@app.get("/")
async def root():
  return {"message": "Hello World"}

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
  image_bytes = await file.read()
  return {"data": file}