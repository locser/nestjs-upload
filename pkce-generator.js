/**
 * PKCE Generator - JavaScript thuần túy
 * Tạo code_verifier và code_challenge cho Zalo OAuth PKCE flow
 * Có thể chạy trong browser hoặc Node.js
 */

class PKCEGenerator {
  /**
   * Tạo code_verifier ngẫu nhiên
   * @param {number} length - Độ dài (43-128 ký tự, mặc định 128)
   * @returns {string} code_verifier
   */
  static generateCodeVerifier(length = 128) {
    if (length < 43 || length > 128) {
      throw new Error('Code verifier length must be between 43 and 128 characters');
    }
    
    // Tạo array các ký tự cho base64url
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    
    // Tạo random string
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return result;
  }

  /**
   * Chuyển string thành ArrayBuffer (cho crypto.subtle.digest)
   * @param {string} str - String cần chuyển đổi
   * @returns {ArrayBuffer}
   */
  static stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  /**
   * Chuyển ArrayBuffer thành base64url string
   * @param {ArrayBuffer} buffer - Buffer cần chuyển đổi
   * @returns {string} base64url string
   */
  static arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    // Chuyển bytes thành binary string
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    // Chuyển thành base64 rồi thành base64url
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Tạo code_challenge từ code_verifier (sử dụng Web Crypto API)
   * @param {string} codeVerifier - Code verifier
   * @returns {Promise<string>} code_challenge
   */
  static async generateCodeChallenge(codeVerifier) {
    // Kiểm tra Web Crypto API
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API not supported in this environment');
    }
    
    // Chuyển code_verifier thành ArrayBuffer
    const data = this.stringToArrayBuffer(codeVerifier);
    
    // Tạo SHA256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Chuyển thành base64url
    return this.arrayBufferToBase64Url(hashBuffer);
  }

  /**
   * Tạo code_challenge từ code_verifier (fallback cho Node.js)
   * @param {string} codeVerifier - Code verifier
   * @returns {string} code_challenge
   */
  static generateCodeChallengeSync(codeVerifier) {
    // Chỉ dùng trong Node.js
    if (typeof require === 'undefined') {
      throw new Error('Sync method only available in Node.js environment');
    }
    
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Tạo cả code_verifier và code_challenge
   * @param {number} length - Độ dài code_verifier
   * @returns {Promise<{codeVerifier: string, codeChallenge: string}>}
   */
  static async generatePKCEPair(length = 128) {
    const codeVerifier = this.generateCodeVerifier(length);
    
    let codeChallenge;
    try {
      // Thử dùng Web Crypto API trước
      codeChallenge = await this.generateCodeChallenge(codeVerifier);
    } catch (error) {
      // Fallback cho Node.js
      codeChallenge = this.generateCodeChallengeSync(codeVerifier);
    }
    
    return {
      codeVerifier,
      codeChallenge
    };
  }

  /**
   * Tạo authorization URL cho Zalo OAuth
   * @param {string} appId - App ID của Zalo
   * @param {string} redirectUri - Callback URL
   * @param {string} state - Optional state parameter
   * @returns {Promise<{authUrl: string, codeVerifier: string}>}
   */
  static async generateZaloAuthUrl(appId, redirectUri, state = null) {
    const { codeVerifier, codeChallenge } = await this.generatePKCEPair();
    
    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge
    });
    
    if (state) {
      params.append('state', state);
    }
    
    const authUrl = `https://oauth.zaloapp.com/v4/permission?${params.toString()}`;
    
    return {
      authUrl,
      codeVerifier
    };
  }
}

// Hàm tiện ích để test
async function testPKCE() {
  console.log('🔐 Testing PKCE Generator...\n');
  
  try {
    // Test 1: Tạo PKCE pair
    const { codeVerifier, codeChallenge } = await PKCEGenerator.generatePKCEPair();
    
    console.log('✅ PKCE Pair Generated:');
    console.log('📝 Code Verifier:', codeVerifier);
    console.log('🔑 Code Challenge:', codeChallenge);
    console.log('📏 Verifier Length:', codeVerifier.length);
    console.log('📏 Challenge Length:', codeChallenge.length);
    console.log('');
    
    // Test 2: Tạo Zalo auth URL
    const { authUrl, codeVerifier: savedVerifier } = await PKCEGenerator.generateZaloAuthUrl(
      'YOUR_APP_ID',
      'https://yourdomain.com/callback',
      'test_state_123'
    );
    
    console.log('✅ Zalo Auth URL Generated:');
    console.log('🌐 Auth URL:', authUrl);
    console.log('💾 Save this verifier:', savedVerifier);
    console.log('');
    
    console.log('🎯 Usage:');
    console.log('1. Redirect user to authUrl');
    console.log('2. Save codeVerifier in session/localStorage');
    console.log('3. Use codeVerifier in token exchange request');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Export cho Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PKCEGenerator;
}

// Export cho ES6 modules
if (typeof window === 'undefined' && typeof global !== 'undefined') {
  global.PKCEGenerator = PKCEGenerator;
}

// Tự động chạy test nếu file được chạy trực tiếp
if (typeof window !== 'undefined') {
  // Browser environment
  window.PKCEGenerator = PKCEGenerator;
  window.testPKCE = testPKCE;
  
  console.log('🚀 PKCE Generator loaded in browser!');
  console.log('💡 Run testPKCE() to see examples');
  console.log('💡 Use PKCEGenerator.generatePKCEPair() to generate codes');
} else if (require.main === module) {
  // Node.js environment - chạy trực tiếp
  testPKCE();
}