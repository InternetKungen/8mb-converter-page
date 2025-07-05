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
  const [showProgress, setShowProgress] = useState(false);
  const [converting, setConverting] = useState(false);
  const [startTime, setStartTime] = useState<string>("0");
  const [endTime, setEndTime] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) {
        setProgress(data.progress);
        setConverting(true);
        setUploading(false);
      }

      // If conversion is complete
      if (data.path) {
        setDownloadLink(data.path);
        setConverting(false);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    setDownloadLink(null);
    setProgress(null);
    setShowProgress(false);
  }, [file]);

  // Funktion för att få videolängd
  const getVideoDuration = (file: File) => {
    return new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        reject(new Error("Kunde inte läsa videofilens metadata"));
      };

      video.src = URL.createObjectURL(file);
    });
  };

  // Hantera filer via drag & drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);

      try {
        const duration = await getVideoDuration(selectedFile);
        setVideoDuration(duration);
        // Sätt standardvärden för start/sluttid
        setStartTime("0");
        setEndTime(Math.min(duration, 30).toString());
      } catch (error) {
        console.error("Fel vid läsning av videolängd:", error);
        setVideoDuration(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"] },
    maxFiles: 1,
  });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);

      try {
        const duration = await getVideoDuration(selectedFile);
        setVideoDuration(duration);
        // Sätt standardvärden för start/sluttid
        setStartTime("0");
        setEndTime(Math.min(duration, 30).toString());
      } catch (error) {
        console.error("Fel vid läsning av videolängd:", error);
        setVideoDuration(null);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const validateTimeInputs = (): boolean => {
    const start = parseFloat(startTime);
    const end = endTime ? parseFloat(endTime) : null;

    if (start < 0) {
      setMessage("Starttid kan inte vara negativ");
      return false;
    }

    if (videoDuration && start >= videoDuration) {
      setMessage("Starttid kan inte vara längre än videons längd");
      return false;
    }

    if (end !== null && end <= start) {
      setMessage("Sluttid måste vara större än starttid");
      return false;
    }

    if (end !== null && videoDuration && end > videoDuration) {
      setMessage("Sluttid kan inte vara längre än videons längd");
      return false;
    }

    return true;
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Välj en fil först.");
      return;
    }

    if (!validateTimeInputs()) {
      return;
    }

    setUploading(true);
    setConverting(false);
    setShowProgress(true);
    setMessage("");
    setDownloadLink(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("videoFile", file);
    formData.append("startTime", startTime);
    if (endTime) {
      formData.append("endTime", endTime);
    }

    // Skapa en XMLHttpRequest för att övervaka uppladdningen
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        // Upload is complete, now conversion starts
        setUploading(false); // Set uploading to false to show "Konvertering" text
        setConverting(true);
        setProgress(0); // Reset progress for conversion phase

        const data = JSON.parse(xhr.responseText);
        setMessage(`Uppladdning lyckades: ${data.filename}`);

        // Only set download link if it's available immediately
        // Otherwise, it will likely be set by the WebSocket updates
        if (data.path) {
          setDownloadLink(data.path);
          setConverting(false);
        }
      } else {
        setMessage(`Fel vid uppladdning: ${xhr.statusText}`);
        setUploading(false);
        setConverting(false);
      }
    };

    xhr.onerror = () => {
      setMessage("Ett fel inträffade vid uppladdning.");
      setUploading(false);
      setConverting(false);
    };

    xhr.open("POST", "/api/upload/video", true);
    xhr.send(formData);
  };

  return (
    <div className="app">
      <div className={`logo ${converting ? "animating" : ""}`}>
        <img
          className="logo-img"
          src={logoImage}
          alt="8MB Video converter logo"
        />
      </div>
      <div className="container">
        <h2>8MB Video Converter</h2>
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

        {downloadLink ? (
          <div className="download-container">
            <a href={downloadLink} download className="download-button">
              ⬇ Hämta video
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading || converting}
          >
            {uploading
              ? "Laddar upp..."
              : converting
              ? "Konverterar..."
              : "Ladda upp"}
          </button>
        )}

        {/* Time Controls och Progress container på samma område */}
        <div className={`controls-progress-area ${file ? "show" : ""}`}>
          {/* Visa videolängd och tid-kontroller */}
          {file && videoDuration && !downloadLink && (
            <div
              className={`time-controls ${
                uploading || converting ? "disabled" : "show"
              }`}
            >
              <div className="time-slider-container">
                <div className="time-values">
                  <div className="time-value">
                    <label>Start</label>
                    <span>{formatTime(parseFloat(startTime))}</span>
                  </div>

                  <div className="time-preview time-value">
                    <label>Tid</label>
                    <span>
                      {endTime
                        ? Math.max(
                            0,
                            parseFloat(endTime) - parseFloat(startTime)
                          ).toFixed(1)
                        : Math.min(
                            30,
                            videoDuration - parseFloat(startTime)
                          ).toFixed(1)}
                    </span>
                  </div>

                  <div className="time-value">
                    <label>Slut</label>
                    <span>
                      {formatTime(
                        parseFloat(endTime) ||
                          Math.min(videoDuration, parseFloat(startTime) + 30)
                      )}
                    </span>
                  </div>
                </div>

                <div className="dual-range-slider">
                  <div className="slider-track"></div>
                  <div
                    className="slider-range"
                    style={{
                      left: `${(parseFloat(startTime) / videoDuration) * 100}%`,
                      width: `${
                        (((parseFloat(endTime) ||
                          Math.min(videoDuration, parseFloat(startTime) + 30)) -
                          parseFloat(startTime)) /
                          videoDuration) *
                        100
                      }%`,
                    }}
                  ></div>

                  <input
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.1"
                    value={startTime}
                    onChange={(e) => {
                      const newStartTime = parseFloat(e.target.value);
                      const currentEndTime =
                        parseFloat(endTime) ||
                        Math.min(videoDuration, newStartTime + 30);
                      if (newStartTime < currentEndTime) {
                        setStartTime(e.target.value);
                      }
                    }}
                    className="slider slider-start"
                  />

                  <input
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.1"
                    value={
                      endTime ||
                      Math.min(videoDuration, parseFloat(startTime) + 30)
                    }
                    onChange={(e) => {
                      const newEndTime = parseFloat(e.target.value);
                      const currentStartTime = parseFloat(startTime);
                      if (newEndTime > currentStartTime) {
                        setEndTime(e.target.value);
                      }
                    }}
                    className="slider slider-end"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Progress container med animation */}
          <div className={`progress-container ${showProgress ? "show" : ""}`}>
            <div
              className="progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
            <div className="progress-text">
              {progress !== null && (
                <p>
                  {uploading
                    ? "Uppladdning"
                    : converting
                    ? "Konvertering"
                    : "Klar"}
                  : {downloadLink ? "100" : progress.toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
        <div
          className={`progress-message ${
            message && downloadLink ? "show" : ""
          }`}
        >
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

export default App;
