import { useState, useRef } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [type, setType] = useState("fire");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied or not available");
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      alert("Start camera first");
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", blob, "webcam.jpg");
      formData.append("anomaly_type", type);

      try {
        setLoading(true);

        const res = await fetch(
          "https://anomaly-detection-app-t27a.onrender.com/predict",
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await res.json();
        setResult(data);
      } catch (err) {
        alert("Error detecting from webcam");
      } finally {
        setLoading(false);
      }
    }, "image/jpeg");
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("Please upload a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("anomaly_type", type);

    try {
      setLoading(true);

      const res = await fetch(
        "https://anomaly-detection-app-t27a.onrender.com/predict",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert("Error detecting image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Anomaly Detection</h1>

      {/* Upload Section */}
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />

      <br /><br />

      <select onChange={(e) => setType(e.target.value)}>
        <option value="fire">Fire</option>
        <option value="weapon">Weapon</option>
      </select>

      <br /><br />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Detecting..." : "Detect from Image"}
      </button>

      <hr />

      {/* Webcam Section */}
      <h2>Webcam Detection</h2>

      <button onClick={startCamera}>Start Camera</button>

      <br /><br />

      <video ref={videoRef} autoPlay width="400" />

      <br /><br />

      <button onClick={captureImage} disabled={loading}>
        {loading ? "Detecting..." : "Capture & Detect"}
      </button>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <br /><br />

      {/* Result Section */}
      {result && (
        <div>
          <h3>Detected:</h3>
          {result.detections.map((d, i) => (
            <p key={i}>
              {type} - {(d.confidence * 100).toFixed(2)}%
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;