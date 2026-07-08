/**
 * OCR Service — Tesseract.js ile yerel fatura okuma (OpenAI'ye alternatif).
 * Dış API bağımlılığı yoktur; Türkçe dil paketi ilk çalıştırmada otomatik indirilip cache'lenir.
 */
const Tesseract = require('tesseract.js');
const config = require('../config');
const { preprocessForOCR } = require('./imagePreprocessor');
const { parseInvoiceText } = require('./invoiceParser');

/**
 * @param {string} filePath - Yüklenen dosyanın diskteki yolu
 * @param {string} mimeType - Dosya MIME tipi
 * @returns {Promise<Object>} - Yapılandırılmış fatura verisi (v1 ile aynı şekil)
 */
async function processInvoice(filePath, mimeType) {
  // 1. Görüntüyü OCR için optimize et
  const processedPath = await preprocessForOCR(filePath);

  // 2. Tesseract ile metin çıkar (Türkçe)
  const { data: { text, confidence } } = await Tesseract.recognize(
    processedPath,
    config.ocr.language,
    {
      logger: (m) => {
        if (m.status && typeof m.progress === 'number') {
          console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`);
        }
      },
    }
  );

  // 3. Kendi regex parser'ımız ile yapılandırılmış veri çıkar
  const parsed = parseInvoiceText(text);

  // Tesseract'ın kendi güven skoru ile pattern-eşleşme skorunun ortalaması
  parsed.confidenceScore = Math.round((parsed.confidenceScore + confidence) / 2);
  parsed.rawText = text; // Debug için ham metin sakla

  return parsed;
}

module.exports = { processInvoice };
