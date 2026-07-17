const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  // Random filename — never trust the client-supplied original name (path
  // traversal / collision risk), extension derived from the validated mimetype.
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
    cb(null, `${req.user._id}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — bkz. tasarım: hafif profil fotoğrafı
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      return cb(new Error('Yalnızca JPEG, PNG veya WebP formatında görsel yükleyebilirsiniz.'));
    }
    cb(null, true);
  },
}).single('avatar');

module.exports = { uploadAvatar, AVATAR_DIR };
