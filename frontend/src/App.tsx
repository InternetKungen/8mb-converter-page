import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import "./App.css";
import logoImage from "./assets/img/8mb-converter-page.png";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) {
        setProgress(data.progress);
      }
    };

    return () => ws.close();
  }, []);

  // Hantera filer via drag & drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"] },
    maxFiles: 1,
  });
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
    setDownloadLink(null);

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
        setDownloadLink(data.path);
      } else {
        setMessage(
          `Fel: ${data.message}, Detaljer: ${JSON.stringify(data.error)}`
        );
        console.error("Serverfel:", data);
      }
    } catch (error) {
      console.error("Klientfel:", error);
      setMessage(
        `Något gick fel vid uppladdning: ${
          error instanceof Error ? error.message : "Okänt fel"
        }`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app">
      <div className="logo">
        <img
          className="logo-img"
          src={logoImage}
          alt="8MB Video converter logo"
        />
      </div>
      <div className="container">
        <h2>8MB Video converter</h2>
        {/* Drag & Drop Area */}
        <div {...getRootProps()} className="dropzone">
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Släpp filen här...</p>
          ) : (
            <p>Dra & släpp en fil här, eller klicka för att välja en fil</p>
          )}
        </div>
        {/* Alternativ: Välj fil via knapp */}
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: "none" }} // Döljer den ursprungliga filväljaren
          id="file-upload"
        />

        <label htmlFor="file-upload" className="custom-file-upload">
          {file ? file.name : "Välj en fil"}
        </label>

        {/* <input type="file" accept="video/*" onChange={handleFileChange} /> */}

        <button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Laddar upp..." : "Ladda upp"}
        </button>

        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <div className="progress-text">
            {progress !== null && (
              <p>
                Konverteringsprogress:{" "}
                {downloadLink ? "100" : progress.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        <div className="progress-message">{message && <p>{message}</p>}</div>

        {/* Visa nedladdningslänk om filen har konverterats */}
        {downloadLink && (
          <div className="download-container">
            <a href={downloadLink} download className="download-button">
              ⬇ Hämta video
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
