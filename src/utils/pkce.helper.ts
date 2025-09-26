import * as crypto from 'crypto';

/**
 * PKCE (Proof Key for Code Exchange) Helper
 * Tạo code_verifier và code_challenge cho Zalo OAuth flow
 */
export class PKCEHelper {
  /**
   * Tạo code_verifier ngẫu nhiên
   * @param length Độ dài (43-128 ký tự, mặc định 128)
   * @returns code_verifier string
   */
  static generateCodeVerifier(length: number = 128): string {
    if (length < 43 || length > 128) {
      throw new Error('Code verifier length must be between 43 and 128 characters');
    }
    
    // Tạo random bytes và chuyển thành base64url
    const buffer = crypto.randomBytes(Math.ceil(length * 3 / 4));
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .substring(0, length);
  }

  /**
   * Tạo code_challenge từ code_verifier
   * @param codeVerifier Code verifier string
   * @returns code_challenge string (SHA256 hash + base64url encode)
   */
  static generateCodeChallenge(codeVerifier: string): string {
    // Tạo SHA256 hash của code_verifier
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    
    // Chuyển thành base64url encoding
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Tạo cả code_verifier và code_challenge
   * @param length Độ dài code_verifier (43-128 ký tự)
   * @returns Object chứa cả verifier và challenge
   */
  static generatePKCEPair(length: number = 128): {
    codeVerifier: string;
    codeChallenge: string;
  } {
    const codeVerifier = this.generateCodeVerifier(length);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    return {
      codeVerifier,
      codeChallenge,
    };
  }
}

/**
 * Ví dụ sử dụng PKCE Helper
 */
export class ZaloOAuthHelper {
  /**
   * Tạo URL authorization cho Zalo OAuth
   * @param appId App ID của Zalo
   * @param redirectUri Callback URL
   * @param state Optional state parameter
   * @returns Object chứa URL và code_verifier để lưu trữ
   */
  static generateAuthorizationUrl(
    appId: string,
    redirectUri: string,
    state?: string,
  ): {
    authUrl: string;
    codeVerifier: string;
  } {
    // Tạo PKCE pair
    const { codeVerifier, codeChallenge } = PKCEHelper.generatePKCEPair();
    
    // Tạo URL parameters
    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
    });
    
    if (state) {
      params.append('state', state);
    }
    
    const authUrl = `https://oauth.zaloapp.com/v4/permission?${params.toString()}`;
    
    return {
      authUrl,
      codeVerifier, // Lưu để dùng trong token exchange
    };
  }

  /**
   * Tạo request body cho token exchange
   * @param appId App ID
   * @param appSecret App Secret
   * @param authorizationCode Code nhận từ callback
   * @param codeVerifier Code verifier đã lưu từ bước trước
   * @returns URLSearchParams để gửi request
   */
  static createTokenExchangeBody(
    appId: string,
    appSecret: string,
    authorizationCode: string,
    codeVerifier: string,
  ): URLSearchParams {
    return new URLSearchParams({
      app_id: appId,
      app_secret: appSecret,
      code: authorizationCode,
      code_verifier: codeVerifier,
    });
  }
}