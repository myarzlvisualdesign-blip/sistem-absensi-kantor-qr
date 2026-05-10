import QRCode from 'qrcode';
import crypto from 'crypto';

export function generateQRToken(): string {
  return crypto.randomUUID();
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
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}
