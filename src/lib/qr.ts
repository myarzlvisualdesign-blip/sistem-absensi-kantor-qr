import QRCode from 'qrcode';
import crypto from 'crypto';

export function generateQRToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function generateQRCode(token: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

export async function generateQRCodeBuffer(token: string): Promise<Buffer> {
  try {
    const buffer = await QRCode.toBuffer(token, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code buffer');
  }
}

export function validateQRToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  // Token should be 32 hex characters
  const hexRegex = /^[a-f0-9]{32}$/i;
  return hexRegex.test(token);
}
