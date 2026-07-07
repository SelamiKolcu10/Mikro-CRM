/**
 * OCR Service — Google Gemini Vision API Integration
 *
 * Processes invoice images/PDFs using Gemini's multimodal capabilities
 * to extract structured invoice data (vendor info, line items, VAT breakdown).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseAIResponse } = require('./parserService');

// Initialize Gemini AI
let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY ortam değişkeni ayarlanmamış. .env dosyasını kontrol edin.');
    }
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

/**
 * The structured prompt sent to Gemini for invoice parsing.
 * This is critical — it tells the AI exactly what format to return.
 */
const INVOICE_EXTRACTION_PROMPT = `
Sen bir fatura analiz uzmanısın. Bu fatura görselini dikkatlice analiz et ve aşağıdaki JSON formatında yanıt ver.

KURALLAR:
1. Tüm sayısal değerleri NUMBER olarak dön (string değil).
2. Matrah (baseAmount) = KDV hariç tutar.
3. KDV Tutarı (vatAmount) = baseAmount × (vatRate / 100).
4. totalAmount = baseAmount + vatAmount.
5. grandTotal = Faturanın en altındaki GENEL TOPLAM.
6. KDV oranları Türkiye standartlarına göre: %1, %10 veya %20.
7. Eğer faturada birden fazla KDV oranı varsa, her birini ayrı satır olarak ayıkla.
8. Tarih formatı: YYYY-MM-DD
9. confidenceScore: Bu faturayı okuma konusundaki güvenin (0-100 arası).
10. Eğer bir alanı okuyamıyorsan, boş string "" veya null dön, tahmin etme.

JSON FORMATI:
{
  "vendorName": "Satıcı firma adı",
  "vendorTaxNumber": "Vergi numarası",
  "invoiceNumber": "Fatura seri/sıra no",
  "invoiceDate": "YYYY-MM-DD",
  "lineItems": [
    {
      "description": "Kalem açıklaması",
      "quantity": 1,
      "unitPrice": 0,
      "baseAmount": 0,
      "vatRate": 0,
      "vatAmount": 0,
      "totalAmount": 0
    }
  ],
  "grandTotal": 0,
  "confidenceScore": 0
}

SADECE JSON döndür, başka hiçbir açıklama veya metin ekleme.
`;

/**
 * Process a single invoice file through Gemini Vision API.
 *
 * @param {string} filePath - Path to the uploaded invoice file
 * @param {string} mimeType - MIME type of the file
 * @returns {Object} - Parsed invoice data
 */
async function processInvoice(filePath, mimeType) {
  try {
    const aiModel = getModel();

    // Read the file as base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    // Prepare the image part for Gemini
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    // Retry logic for Google Gemini Free Tier limits (429 Too Many Requests)
    let result = null;
    let retries = 3;
    let delay = 20000; // 20 seconds base delay

    for (let i = 0; i < retries; i++) {
      try {
        // Send to Gemini
        result = await aiModel.generateContent([
          INVOICE_EXTRACTION_PROMPT,
          imagePart,
        ]);
        break; // Success, exit retry loop
      } catch (err) {
        if (err.status === 429 || (err.message && err.message.includes('429'))) {
          console.warn(`[OCR] Rate limit hit (429). Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries})`);
          if (i === retries - 1) throw err; // If last attempt, throw the error
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Exponential backoff
        } else {
          throw err; // Not a rate limit error, throw immediately
        }
      }
    }

    const response = result.response;
    const text = response.text();

    // Parse the AI response
    const parsed = parseAIResponse(text);

    return parsed;
  } catch (error) {
    console.error('OCR Service Error:', error.message);

    // Return a minimal structure so the pipeline doesn't break
    return {
      vendorName: '',
      vendorTaxNumber: '',
      invoiceNumber: '',
      invoiceDate: null,
      lineItems: [],
      grandTotal: 0,
      confidenceScore: 0,
      error: error.message,
    };
  }
}

module.exports = {
  processInvoice,
};
