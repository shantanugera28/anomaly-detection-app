from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import shutil
import os

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models = {
    "fire": YOLO("models/firebest.pt"),
    "weapon": YOLO("models/weaponbest.pt")
}

@app.get("/")
def home():
    return {"message": "API running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...), anomaly_type: str = Form(...)):
    file_path = os.path.join("temp.jpg")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    model = models.get(anomaly_type)

    if model is None:
        return {"error": "Invalid anomaly type"}

    results = model(file_path)

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