import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

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

// Funktion för att komprimera videon
const compressVideo = (inputPath, outputPath, maxSizeMb) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec("libx264") // Använd x264 för att komprimera
      .audioCodec("aac") // Komprimera ljudet med AAC
      .size(`?${maxSizeMb}M`) // Sätt maxstorleken (t.ex. 8MB)
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
};

// Video-uppladdningsroute
router.post("/video", videoUpload.single("videoFile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Ingen fil har laddats upp" });
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
    // Komprimera videon
    await compressVideo(uploadedVideoPath, outputVideoPath, 8); // Maxstorlek 8MB

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
