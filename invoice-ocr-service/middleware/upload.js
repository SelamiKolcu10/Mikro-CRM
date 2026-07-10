const multer = require('multer');
const path = require('path');
const config = require('../config');

// Storage configuration — save to ./uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  // Deliberately NOT using `file.originalname`'s extension here — that's
  // fully attacker-controlled and unrelated to the file's actual content
  // (see the MIME-spoofing note on `fileFilter` below). Every upload lands
  // on disk with a neutral, non-executable `.upload` suffix; only
  // middleware/fileSignature.js (which checks real magic bytes after this
  // completes) is allowed to assign the final, real extension.
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `invoice-${uniqueSuffix}.upload`);
  },
});

// Cheap first-pass filter on the client-declared Content-Type — rejects
// obviously-wrong uploads before they're even written to disk. This is NOT
// the real security boundary: `file.mimetype` is just a string the client
// sent and is trivially spoofable. The actual verification (comparing real
// file bytes against this same declared type) happens in
// middleware/fileSignature.js, after multer finishes writing the file.
const fileFilter = (req, file, cb) => {
  if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Desteklenmeyen dosya türü: ${file.mimetype}. İzin verilen: JPEG, PNG, WebP, PDF`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
    files: config.upload.maxBulkFiles,
  },
});

module.exports = upload;
