import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import "./App.css";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

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
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}

export default App;
