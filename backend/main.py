from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import os
import smtplib
import time

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models = {
    "fire": YOLO("https://huggingface.co/Shantanu28/anomaly-detection-app/resolve/main/firebest.pt"),
    "weapon": YOLO("https://huggingface.co/Shantanu28/anomaly-detection-app/resolve/main/weaponbest.pt")
}

last_email_time = 0
EMAIL_COOLDOWN = 60


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

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, receiver, msg.as_string())
        server.quit()

        print("Email sent successfully")

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
    global last_email_time

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

    current_time = time.time()

    if len(detections) > 0:
        if current_time - last_email_time > EMAIL_COOLDOWN:
            send_email_alert(anomaly_type, detections, contents)
            last_email_time = current_time

    return {
        "anomaly": anomaly_type,
        "detections": detections
    }