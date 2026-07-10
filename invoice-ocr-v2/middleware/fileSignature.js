const fs = require('fs');
const path = require('path');

/**
 * Detects file type from its actual bytes (magic numbers), independent of
 * whatever Content-Type/filename the client claimed. multer's `fileFilter`
 * only checks the client-supplied `mimetype` string, which is trivially
 * spoofable — this is the check that actually matters.
 */
function detectFileType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf'; // %PDF
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50 // WEBP
  ) {
    return 'image/webp';
  }
  return null;
}

// Server controls the saved extension — never trust `file.originalname`,
// which is exactly how an attacker could get an .html/.svg payload written
// to disk with an executable-in-the-browser extension despite passing the
// (spoofable) mimetype filter.
const EXTENSION_BY_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * Runs after multer (upload.single/array) has already saved the file(s) to
 * disk under a neutral, extension-less temp name (see middleware/upload.js).
 * Reads the first bytes back, confirms they match a known signature AND
 * that the signature agrees with what the client declared, then renames to
 * the verified, server-chosen extension. Any mismatch deletes the file and
 * rejects the request — nothing attacker-controlled ever reaches disk with
 * an attacker-chosen extension.
 */
function verifyFileSignature(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) return next();

  try {
    for (const file of files) {
      const fd = fs.openSync(file.path, 'r');
      const buffer = Buffer.alloc(12);
      fs.readSync(fd, buffer, 0, 12, 0);
      fs.closeSync(fd);

      const detected = detectFileType(buffer);

      if (!detected || detected !== file.mimetype) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          error: `Dosya içeriği beyan edilen türle uyuşmuyor (${file.originalname}). Dosya reddedildi.`,
        });
      }

      const verifiedPath = file.path.replace(/\.upload$/, EXTENSION_BY_TYPE[detected]);
      fs.renameSync(file.path, verifiedPath);
      file.path = verifiedPath;
      file.filename = path.basename(verifiedPath);
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { verifyFileSignature, detectFileType, EXTENSION_BY_TYPE };
