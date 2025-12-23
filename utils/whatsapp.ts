/**
 * GalonAsrama WhatsApp Utility using Fonnte API
 */

const FONNTE_API_KEY = 'oXPLZK2ShdADAz1gP4QL';

export const sendWA = async (target: string, message: string) => {
  if (!target || target === '-' || target.trim() === '') return;

  // 1. Bersihkan semua karakter non-digit (menghapus +, spasi, dash, dll)
  let cleaned = target.replace(/\D/g, '');

  // 2. Normalisasi awalan ke 62
  // Jika mulai dengan 08..., ganti 0 menjadi 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } 
  // Jika sudah mulai dengan 62..., biarkan
  // Jika tidak mulai dengan 62 dan bukan 0, tambahkan 62 di depan
  else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: cleaned,
        message: message,
        countryCode: '62'
      })
    });
    
    const result = await response.json();
    if (!result.status) {
      console.error('Fonnte API Error:', result.reason);
    }
    return result;
  } catch (error) {
    console.error('Failed to connect to Fonnte:', error);
  }
};