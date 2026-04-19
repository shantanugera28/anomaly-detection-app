from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import shutil
import os
from PIL import Image
import io

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models = {
    "fire": YOLO("https://huggingface.co/Shantanu28/anomaly-detection-app/resolve/main/firebest.pt"),
    "weapon": YOLO("https://huggingface.co/Shantanu28/anomaly-detection-app/resolve/main/weaponbest.pt")
}

@app.get("/")
def home():
    return {"message": "API running"}

@app.get("/health")
def health():
    return {"status": "ready"}

@app.post("/predict")
async def predict(file: UploadFile = File(...), anomaly_type: str = Form(...)):
    model = models.get(anomaly_type)

    if model is None:
        return {"error": "Invalid anomaly type"}

    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    results = model(image, imgsz=640, conf=0.45)

    detections = []

    for r in results:
        names = r.names
        for box in r.boxes:
            cls_id = int(box.cls)
            detections.append({
                "label": names[cls_id],
                "confidence": float(box.conf)
            })

    return {
        "anomaly": anomaly_type,
        "detections": detections
    }