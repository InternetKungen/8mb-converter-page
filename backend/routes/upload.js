import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { wss } from "../index.js";

const router = express.Router();

// Skapa lagringsinställning för multer
const createStorage = (uploadDir) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const fullUploadDir = path.resolve("public", uploadDir);

      // Skapa mappen om den inte finns
      if (!fs.existsSync(fullUploadDir)) {
        fs.mkdirSync(fullUploadDir, { recursive: true });
      }

      cb(null, fullUploadDir);
    },
    filename: (req, file, cb) => {
      // Skapa unikt filnamn
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  });

// Video-filuppladdning
const videoStorage = createStorage("uploads/videos");
const videoUpload = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/avi",
      "video/x-matroska",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Endast videofiler (MP4, WebM, MOV) är tillåtna"), false);
    }
  },
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1000 MB max storlek
});

// Uppdatera WebSocket-klienter
const broadcastProgress = (progress) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ progress }));
    }
  });
};

// Funktion för att komprimera videon
const compressVideo = (
  inputPath,
  outputPath,
  maxSizeMb,
  startTime = 0,
  endTime = null,
  maxDuration = 30
) => {
  return new Promise((resolve, reject) => {
    // Få information om ursprungsfilen för att beräkna bithastighet
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.error("Fel vid analys av video:", err);
        return reject(err);
      }

      const originalDuration = metadata.format.duration;

      // Beräkna faktisk duration baserat på start/sluttid
      let duration;
      if (endTime !== null) {
        // Om både start och sluttid är specificerade
        duration = Math.min(endTime - startTime, maxDuration);
      } else {
        // Om bara starttid är specificerad, använd maxDuration från starttid
        duration = Math.min(originalDuration - startTime, maxDuration);
      }

      // Säkerställ att duration är positiv
      if (duration <= 0) {
        return reject(
          new Error(
            "Ogiltig tidsintervall: sluttid måste vara större än starttid"
          )
        );
      }
      // Beräkna bitrate för att få ungefär maxSizeMb storlek
      // 8 * maxSizeMb * 1024 * 1024 = önskad filstorlek i bitar
      // Dividera med duration för att få bitar per sekund
      const targetBitrate = Math.floor(
        (8 * maxSizeMb * 1024 * 1024) / duration
      );

      console.log(
        `Starttid: ${startTime}s, Sluttid: ${
          endTime || "auto"
        }s, Längd: ${duration}s, Målbitrate: ${targetBitrate}bps`
      );

      ffmpeg(inputPath)
        .setStartTime(startTime) // Starta från specificerad tid
        .setDuration(duration) // Klipp till beräknad duration
        .output(outputPath)
        .videoCodec("libx264") // Använd x264 för att komprimera
        .audioCodec("aac") // Komprimera ljudet med AAC
        .audioBitrate("96k") // Standardisera ljudbitrate
        .videoBitrate(targetBitrate) // Använd beräknad bitrate
        .outputOptions([
          "-preset fast", // Balans mellan komprimeringstid och -kvalitet
          "-crf 30", // Högre värde = bättre kompression, sämre kvalitet
          "-movflags +faststart", // Optimera för webbuppspelning
          "-pix_fmt yuv420p", // Standardisera pixelformat för bättre kompatibilitet
          "-vf scale='min(1280,iw):-2'", // Begränsa upplösning till 1280px bredd
        ])
        .on("progress", (progress) => {
          console.log(`Behandlar: ${progress.percent}% färdig`);
          broadcastProgress(progress.percent);
        })
        .on("end", () => {
          console.log("Video komprimerad");
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("Fel vid komprimering av video:", err);
          reject(err);
        })
        .run();
    });
  });
};

// Video-uppladdningsroute
router.post("/video", videoUpload.single("videoFile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Ingen fil har laddats upp" });
  }

  // Hämta start- och sluttid från request body
  const startTime = parseFloat(req.body.startTime) || 0;
  const endTime = req.body.endTime ? parseFloat(req.body.endTime) : null;

  // Validera tidsintervall
  if (startTime < 0) {
    return res.status(400).json({ message: "Starttid kan inte vara negativ" });
  }

  if (endTime !== null && endTime <= startTime) {
    return res
      .status(400)
      .json({ message: "Sluttid måste vara större än starttid" });
  }

  // Sätt filens path
  const uploadedVideoPath = path.resolve(
    "public",
    "uploads",
    "videos",
    req.file.filename
  );

  // Sätt output path för den komprimerade videon
  const outputVideoPath = path.resolve(
    "public",
    "uploads",
    "videos",
    "compressed-" + req.file.filename
  );

  try {
    // Komprimera videon med anpassad start- och sluttid
    await compressVideo(
      uploadedVideoPath,
      outputVideoPath,
      6,
      startTime,
      endTime,
      30
    );

    res.json({
      message: "Video konverterad och uppladdad",
      filename: "compressed-" + req.file.filename,
      path: `/public/uploads/videos/compressed-${req.file.filename}`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Fel vid komprimering av video", error: error.message });
  }
});

export default router;
