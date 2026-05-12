export const APP_NAME = 'E-ABSENSI LASDAUN';
export const APP_ORGANIZATION = 'Lapas Pemuda Kelas IIA Madiun';
export const APP_FULL_NAME = `${APP_NAME} ${APP_ORGANIZATION}`;
export const APP_LOGO_PATH = '/lapas-logo.jpg';
export const APP_SECONDARY_LOGO_PATH = '/pemasyarakatan-logo-2025.png';

export const OFFICE_EMAIL_DOMAIN = 'gmail.com';
export const DEFAULT_USER_PASSWORD = 'user123';

export const OFFICE_LOCATION = {
  label: 'Office Lapas Pemuda Kelas IIA Madiun',
  latitude: -7.6146827,
  longitude: 111.5239073,
  radiusMeters: 500,
};

export function createOfficeEmail(name: string): string {
  const localPart = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 48);

  return `${localPart || 'pegawai'}@${OFFICE_EMAIL_DOMAIN}`;
}

export function isAllowedEmailDomain(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${OFFICE_EMAIL_DOMAIN}`);
}

export function calculateDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude = OFFICE_LOCATION.latitude,
  toLongitude = OFFICE_LOCATION.longitude,
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const startLatitude = toRadians(fromLatitude);
  const endLatitude = toRadians(toLatitude);

  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function validateOfficeDistance(latitude?: number, longitude?: number) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return {
      ok: false,
      distanceMeters: null,
      message: 'AKTIFKAN LOKASI UNTUK ABSEN.',
    };
  }

  const distanceMeters = calculateDistanceMeters(latitude, longitude);
  if (distanceMeters > OFFICE_LOCATION.radiusMeters) {
    return {
      ok: false,
      distanceMeters,
      message: 'JARAK KAMU TERLALU JAUH DARI OFFICE!',
    };
  }

  return {
    ok: true,
    distanceMeters,
    message: 'Lokasi valid',
  };
}
