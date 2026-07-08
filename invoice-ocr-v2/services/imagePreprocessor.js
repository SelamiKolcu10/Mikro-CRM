/**
 * Image Preprocessor — Sharp Pipeline
 *
 * OCR doğruluğunu artırmak için fatura görselini Tesseract'a vermeden önce
 * grayscale + kontrast + keskinleştirme + eşikleme işlemlerinden geçirir.
 */
const sharp = require('sharp');
const path = require('path');

/**
 * @param {string} inputPath - Yüklenen orijinal dosyanın yolu
 * @returns {Promise<string>} - İşlenmiş PNG dosyasının yolu
 */
async function preprocessForOCR(inputPath) {
  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(new RegExp(`${escapeRegExp(ext)}$`), '-processed.png');

  await sharp(inputPath)
    .grayscale()               // Renkleri kaldır
    .normalise()                // Kontrast normalleştirme
    .sharpen({ sigma: 1.5 })    // Kenarları keskinleştir
    .threshold(140)              // Siyah-beyaz eşikleme
    .png()                       // PNG olarak kaydet (kayıpsız)
    .toFile(outputPath);

  return outputPath;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { preprocessForOCR };
