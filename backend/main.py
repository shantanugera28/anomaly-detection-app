from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from PIL import Image
import io
import os
import smtplib
import time
import gc
import asyncio
from threading import Lock

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

app = FastAPI(title="Anomaly Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_URLS = {
    "fire": "https://huggingface.co/Shantanu28/anomaly-detection-app/resolve/main/firebest.pt",
    "weapon": "https://huggingface.co/Shantanu28/anomaly-detection-app/resolve/main/weaponbest.pt"
}

models_cache = {}
model_lock = Lock()

last_email_time = 0
EMAIL_COOLDOWN = 60


def get_model(anomaly_type):
    if anomaly_type not in MODEL_URLS:
        return None

    if anomaly_type not in models_cache:
        with model_lock:
            if anomaly_type not in models_cache:
                models_cache[anomaly_type] = YOLO(MODEL_URLS[anomaly_type])

    return models_cache[anomaly_type]


def send_email_alert(anomaly_type, detections, image_bytes):
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

        attachment = MIMEBase("application", "octet-stream")
        attachment.set_payload(image_bytes)
        encoders.encode_base64(attachment)

        attachment.add_header(
            "Content-Disposition",
            f'attachment; filename="{anomaly_type}_detected.jpg"'
        )

        msg.attach(attachment)

        server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
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
async def predict(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    anomaly_type: str = Form(...)
):
    global last_email_time

    try:
        model = get_model(anomaly_type)

        if model is None:
            raise HTTPException(status_code=400, detail="Invalid anomaly type")

        contents = await file.read()

        if not contents:
            raise HTTPException(status_code=400, detail="Empty file")

        image = Image.open(io.BytesIO(contents)).convert("RGB")
        image.thumbnail((640, 640))

        results = await asyncio.to_thread(
            model,
            image,
            imgsz=320,
            conf=0.25,
            verbose=False
        )

        detections = []

        for r in results:
            names = r.names

            for box in r.boxes:
                cls_id = int(box.cls)
                coords = box.xyxy[0].tolist()

                detections.append({
                    "label": names[cls_id],
                    "confidence": round(float(box.conf), 4),
                    "x1": round(coords[0], 2),
                    "y1": round(coords[1], 2),
                    "x2": round(coords[2], 2),
                    "y2": round(coords[3], 2)
                })

        current_time = time.time()

        if len(detections) > 0:
            if current_time - last_email_time > EMAIL_COOLDOWN:
                background_tasks.add_task(
                    send_email_alert,
                    anomaly_type,
                    detections,
                    contents
                )
                last_email_time = current_time

        del results
        del image
        gc.collect()

        return JSONResponse({
            "success": True,
            "anomaly": anomaly_type,
            "count": len(detections),
            "detections": detections
        })

    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"success": False, "error": e.detail}
        )

    except Exception as e:
        gc.collect()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )