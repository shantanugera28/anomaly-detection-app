import { useState, useRef, useEffect } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [type, setType] = useState("fire");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const ping = () => {
      fetch("https://anomaly-detection-app-t27a.onrender.com/health")
        .catch(() => {});
    };

    ping();

    const id = setInterval(ping, 240000);

    return () => clearInterval(id);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setStatus("Camera started");
    } catch (err) {
      alert("Camera access denied or not available");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();

      tracks.forEach((track) => track.stop());

      videoRef.current.srcObject = null;
    }
  };

  const captureFrameAndDetect = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, 640, 480);

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        formData.append("anomaly_type", type);

        try {
          const res = await fetch(
            "https://anomaly-detection-app-t27a.onrender.com/predict",
            {
              method: "POST",
              body: formData,
            }
          );

          const data = await res.json();
          resolve(data);
        } catch (err) {
          resolve(null);
        }
      }, "image/jpeg", 0.6);
    });
  };

  const captureImage = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      alert("Start camera first");
      return;
    }

    setLoading(true);
    setStatus("Analyzing frame...");

    const data = await captureFrameAndDetect();

    if (data) {
      setResult(data);
    }

    setLoading(false);
    setStatus("Idle");
  };

  const stopRealtimeDetection = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    stopCamera();
    setStatus("Detection stopped");
  };

  const startRealtimeDetection = () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      alert("Start camera first");
      return;
    }

    setRunning(true);
    setStatus("Scanning...");

    let busy = false;

    intervalRef.current = setInterval(async () => {
      if (busy) return;

      busy = true;

      const data = await captureFrameAndDetect();

      if (data) {
        setResult(data);

        if (data.detections.length > 0) {
          stopRealtimeDetection();
          setStatus("Threat detected");
          alert("Threat detected. Camera stopped.");
        }
      }

      busy = false;
    }, 2000);
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
      setStatus("Analyzing image...");

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
      setStatus("Idle");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Anomaly Detection</h1>

      <p>Status: {status}</p>

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

      <h2>Webcam Detection</h2>

      <button onClick={startCamera}>Start Camera</button>

      <button onClick={stopCamera}>Stop Camera</button>

      <br /><br />

      <video ref={videoRef} autoPlay width="400" />

      <br /><br />

      <button onClick={captureImage} disabled={loading}>
        {loading ? "Detecting..." : "Capture & Detect"}
      </button>

      <br /><br />

      <button onClick={startRealtimeDetection} disabled={running}>
        Start Real-Time Detection
      </button>

      <button onClick={stopRealtimeDetection} disabled={!running}>
        Stop Detection
      </button>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <br /><br />

      {result && (
        <div>
          <h3>Detected:</h3>

          {result.detections.length === 0 ? (
            <p>No anomaly detected</p>
          ) : (
            result.detections.map((d, i) => (
              <p key={i}>
                {d.label} - {(d.confidence * 100).toFixed(2)}%
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;