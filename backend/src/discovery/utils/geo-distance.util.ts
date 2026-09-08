/**
 * Production-Grade Geodesic Distance & Anti-Stalking Privacy Utilities.
 * Implements Haversine spherical great-circle calculation and industry-standard
 * distance binning / fuzzing (Tinder / Bumble model).
 */

export const EARTH_RADIUS_KM = 6371;

/**
 * Validates whether latitude and longitude are valid, non-zero (Null Island) coordinates.
 */
export function isValidCoordinate(
  lat?: number | null,
  lon?: number | null,
): boolean {
  if (
    lat === undefined ||
    lat === null ||
    lon === undefined ||
    lon === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return false;
  }

  // Reject invalid range
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }

  // Reject "Null Island" (0.0, 0.0) coordinates in the Atlantic Ocean which signify uninitialized state
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) {
    return false;
  }

  return true;
}

/**
 * Calculates the great-circle distance between two points on a sphere (Earth)
 * using the Haversine formula.
 *
 * @returns distance in kilometers, or null if coordinates are invalid
 */
export function calculateHaversineDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null,
): number | null {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const φ1 = toRad(lat1!);
  const φ2 = toRad(lat2!);
  const Δφ = toRad(lat2! - lat1!);
  const Δλ = toRad(lon2! - lon1!);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = EARTH_RADIUS_KM * c;
  return Number.isFinite(d) ? d : null;
}

/**
 * Formats distance with anti-stalking privacy fuzzing.
 *
 * Privacy Rules:
 * 1. Distance < 1 km: Returns "Less than 1 km away" (prevents desk/room trilateration).
 * 2. Distance >= 1 km: Bins to nearest integer ("X km away") to prevent 3-point triangulation.
 * 3. Graceful degradation: If coordinates are missing, falls back to city-level proximity.
 */
export function formatPrivacySafeDistance(
  distanceKm: number | null | undefined,
  candidateCity?: string | null,
  candidateRegion?: string | null,
  isSameCity?: boolean,
): string {
  if (distanceKm !== null && distanceKm !== undefined && Number.isFinite(distanceKm)) {
    if (distanceKm < 1.0) {
      return 'Less than 1 km away';
    }
    const roundedKm = Math.round(distanceKm);
    return `${roundedKm.toLocaleString('en-US')} km away`;
  }

  // Graceful degradation when coordinates are unavailable
  const cleanCity = candidateCity?.trim();
  const cleanRegion = candidateRegion?.trim();

  if (isSameCity && cleanCity) {
    return `Nearby in ${cleanCity}`;
  }

  if (cleanCity && cleanRegion) {
    return `${cleanCity}, ${cleanRegion}`;
  }

  if (cleanCity) {
    return cleanCity;
  }

  return 'Nearby';
}

export interface RelativeDistanceResult {
  distanceKm: number | null;
  distanceDisplay: string;
}

/**
 * Computes the relative distance and privacy-safe display string between the viewer
 * and a candidate profile.
 */
export function calculateRelativeDistance(
  userLat?: number | null,
  userLon?: number | null,
  userCity?: string | null,
  candidateLat?: number | null,
  candidateLon?: number | null,
  candidateCity?: string | null,
  candidateRegion?: string | null,
): RelativeDistanceResult {
  const distanceKm = calculateHaversineDistanceKm(
    userLat,
    userLon,
    candidateLat,
    candidateLon,
  );

  const cleanUserCity = userCity?.trim().toLowerCase();
  const cleanCandCity = candidateCity?.trim().toLowerCase();
  const isSameCity = Boolean(cleanUserCity && cleanCandCity && cleanUserCity === cleanCandCity);

  const distanceDisplay = formatPrivacySafeDistance(
    distanceKm,
    candidateCity,
    candidateRegion,
    isSameCity,
  );

  return {
    distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
    distanceDisplay,
  };
}
