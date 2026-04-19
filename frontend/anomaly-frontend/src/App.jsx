import { useState, useRef, useEffect } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [type, setType] = useState("fire");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [preview, setPreview] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const ping = () => {
      fetch("https://anomaly-detection-app-t27a.onrender.com/health").catch(
        () => {}
      );
    };

    ping();
    const id = setInterval(ping, 240000);
    return () => clearInterval(id);
  }, []);

  const drawBoxes = (detections) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineWidth = 3;
    ctx.font = "16px Arial";
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "#ef4444";

    detections.forEach((d) => {
      ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);
      ctx.fillText(
        `${d.label} ${(d.confidence * 100).toFixed(1)}%`,
        d.x1,
        d.y1 - 8
      );
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setStatus("Camera started");
    } catch (err) {
      alert("Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
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
        } catch {
          resolve(null);
        }
      }, "image/jpeg", 0.6);
    });
  };

  const captureImage = async () => {
    if (!videoRef.current?.srcObject) {
      alert("Start camera first");
      return;
    }

    setLoading(true);
    setStatus("Analyzing frame...");

    const data = await captureFrameAndDetect();

    if (data) {
      setResult(data);
      drawBoxes(data.detections);
      setPreview(canvasRef.current.toDataURL("image/jpeg"));
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
    if (!videoRef.current?.srcObject) {
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
        drawBoxes(data.detections);
        setPreview(canvasRef.current.toDataURL("image/jpeg"));

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
      alert("Please upload image first");
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

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);
        drawBoxes(data.detections);

        setPreview(canvas.toDataURL("image/jpeg"));
      };

      img.src = URL.createObjectURL(file);
    } catch {
      alert("Error detecting image");
    } finally {
      setLoading(false);
      setStatus("Idle");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6">
          <h1 className="text-4xl font-bold">Anomaly Detection Dashboard</h1>
          <p className="text-slate-400 mt-2">
            Fire & Weapon Smart Monitoring System
          </p>

          <div className="mt-4 inline-block px-4 py-2 rounded-full bg-blue-600 text-sm font-semibold">
            Status: {status}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
            <h2 className="text-2xl font-semibold">Upload Detection</h2>

            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-sm"
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-800 p-3 rounded-xl"
            >
              <option value="fire">Fire</option>
              <option value="weapon">Weapon</option>
            </select>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded-xl font-semibold"
            >
              {loading ? "Detecting..." : "Detect from Image"}
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
            <h2 className="text-2xl font-semibold">Webcam Detection</h2>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={startCamera}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl"
              >
                Start Camera
              </button>

              <button
                onClick={stopCamera}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl"
              >
                Stop Camera
              </button>
            </div>

            <video
              ref={videoRef}
              autoPlay
              className="w-full rounded-xl border border-slate-700"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={captureImage}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 p-3 rounded-xl"
              >
                Capture & Detect
              </button>

              <button
                onClick={startRealtimeDetection}
                disabled={running}
                className="bg-purple-600 hover:bg-purple-700 p-3 rounded-xl"
              >
                Start Live
              </button>

              <button
                onClick={stopRealtimeDetection}
                disabled={!running}
                className="col-span-2 bg-slate-700 hover:bg-slate-600 p-3 rounded-xl"
              >
                Stop Detection
              </button>
            </div>
          </div>
        </div>

        {preview && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
            <h2 className="text-2xl font-semibold mb-4">Detection Preview</h2>
            <img
              src={preview}
              alt="preview"
              className="rounded-xl border border-slate-700 w-full"
            />
          </div>
        )}

        {result && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
            <h2 className="text-2xl font-semibold mb-4">Detection Results</h2>

            {result.detections.length === 0 ? (
              <p className="text-green-400 font-medium">No anomaly detected</p>
            ) : (
              result.detections.map((d, i) => (
                <div key={i} className="mb-5">
                  <div className="flex justify-between mb-1">
                    <span>{d.label}</span>
                    <span>{(d.confidence * 100).toFixed(2)}%</span>
                  </div>

                  <div className="w-full bg-slate-700 h-3 rounded-full">
                    <div
                      className="bg-red-500 h-3 rounded-full"
                      style={{ width: `${d.confidence * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}

export default App;