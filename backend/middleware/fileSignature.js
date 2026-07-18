const fs = require('fs');

/**
 * Detects an image type from its actual leading bytes (magic numbers),
 * independent of whatever Content-Type/filename the client claimed. multer's
 * `fileFilter` only checks the client-supplied `mimetype` string, which is
 * trivially spoofable — this is the check that actually matters. Mirrors the
 * invoice-ocr services' signature guard, scoped to the avatar image types.
 */
function detectImageType(buffer) {
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
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50 // WEBP
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Runs after `uploadAvatar` (multer) has written the file to disk. Reads the
 * real leading bytes back and confirms they match a known image signature AND
 * that the signature agrees with the client-declared mimetype the filename's
 * extension was derived from. Any mismatch deletes the file and rejects the
 * request — so a spoofed Content-Type (e.g. an HTML payload declared as
 * image/png) can never survive on disk with an image extension.
 */
function verifyAvatarSignature(req, res, next) {
  if (!req.file) return next();

  try {
    const fd = fs.openSync(req.file.path, 'r');
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    const detected = detectImageType(buffer);

    if (!detected || detected !== req.file.mimetype) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Dosya içeriği geçerli bir görselle uyuşmuyor. Yalnızca gerçek JPEG, PNG veya WebP görselleri yükleyebilirsiniz.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { verifyAvatarSignature, detectImageType };
