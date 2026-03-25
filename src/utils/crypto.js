// src/utils/crypto.js
import CryptoJS from 'crypto-js';

// Hàm mã hóa tin nhắn
export const encryptMessage = (message, secretKey) => {
  try {
    return CryptoJS.AES.encrypt(message, secretKey).toString();
  } catch (error) {
    console.error("Lỗi mã hóa:", error);
    return null;
  }
};

// Hàm giải mã tin nhắn
export const decryptMessage = (ciphertext, secretKey) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || "🔒 [Ký tự vô nghĩa - Sai mật khẩu]";
  } catch (error) {
    return "🔒 [Ký tự vô nghĩa - Sai mật khẩu]";
  }
};