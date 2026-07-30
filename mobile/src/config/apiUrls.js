import { Platform } from 'react-native';

// Backend base URL for development.
//
// The Android emulator can't reach your PC through "localhost" — that resolves
// to the emulator itself. 10.0.2.2 is the special alias the Android emulator
// maps to the host machine's loopback, so the backend on your PC's port 5000
// is reachable there. (The iOS simulator uses localhost; a physical phone over
// Expo Go needs your PC's LAN IP — set EXPO_PUBLIC_API_URL to override.)
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${DEV_HOST}:5000/api`;

// Socket.io aynı sunucuda ama /api ön eki olmadan dinliyor — API_URL'den
// türetiyoruz ki tek bir EXPO_PUBLIC_API_URL ayarı ikisini birden taşısın.
export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');

// Yüklenen dosyalar (avatarlar) /api altında değil, sunucunun kökünden
// servis ediliyor — API yanıtları "/uploads/avatars/x.jpg" gibi göreli yol
// döndüğü için başına bu kök ekleniyor.
export const FILES_URL = API_URL.replace(/\/api\/?$/, '');

// Gelen fatura OCR'ı ayrı bir mikroserviste çalışıyor (invoice-ocr-v2, port
// 5002) — ana backend'le aynı JWT_SECRET'i paylaştığı için aynı token geçerli.
export const INVOICE_V2_API_URL =
  process.env.EXPO_PUBLIC_INVOICE_V2_API_URL || `http://${DEV_HOST}:5002/api`;
