import { useState } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Välj en fil först.");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("videoFile", file);

    try {
      const response = await fetch("/api/upload/video", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Uppladdning lyckades: ${data.filename}`);
      } else {
        setMessage(`Fel: ${data.message}`);
      }
    } catch (error) {
      setMessage("Något gick fel vid uppladdning.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app">
      <h2>Upload Video</h2>
      <label>
        Välj en video:
        <input type="file" accept="video/*" onChange={handleFileChange} />
      </label>
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? "Laddar upp..." : "Ladda upp"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
