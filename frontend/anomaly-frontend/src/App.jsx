import { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [type, setType] = useState("fire");
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("anomaly_type", type);

    const res = await fetch("https://anomaly-detection-app-t27a.onrender.com/predict", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Anomaly Detection</h1>

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />

      <br /><br />

      <select onChange={(e) => setType(e.target.value)}>
        <option value="fire">Fire</option>
        <option value="weapon">Weapon</option>
      </select>

      <br /><br />

      <button onClick={handleSubmit}>Detect</button>

      <br /><br />

      {result && (
        <div>
          <h3>Detected:</h3>
          {result.detections.map((d, i) => (
            <p key={i}>
              {d.label} - {(d.confidence * 100).toFixed(2)}%
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;