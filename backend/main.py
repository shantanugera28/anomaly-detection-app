from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import shutil
import os
from PIL import Image
import io
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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

def send_email_alert(anomaly_type, detections):
    sender = os.getenv("EMAIL_USER")
    password = os.getenv("EMAIL_PASS")
    receiver = os.getenv("ALERT_TO")

    if not sender or not password or not receiver:
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = sender
        msg["To"] = receiver
        msg["Subject"] = f"ALERT: {anomaly_type.upper()} Detected"

        body = f"""
Anomaly detected.

Type: {anomaly_type}

Detections:
{detections}
"""
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, receiver, msg.as_string())
        server.quit()

    except Exception as e:
        print("Email failed:", e)

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

    results = model(image, imgsz=416, conf=0.20)

    detections = []

    for r in results:
        names = r.names
        for box in r.boxes:
            cls_id = int(box.cls)
            detections.append({
                "label": names[cls_id],
                "confidence": float(box.conf)
            })
    
    if len(detections) > 0:
        send_email_alert(anomaly_type, detections)

    return {
        "anomaly": anomaly_type,
        "detections": detections
    }