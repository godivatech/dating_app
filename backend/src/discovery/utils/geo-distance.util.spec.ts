import {
  calculateHaversineDistanceKm,
  formatPrivacySafeDistance,
  calculateRelativeDistance,
  isValidCoordinate,
} from './geo-distance.util';

describe('GeoDistanceUtil', () => {
  describe('isValidCoordinate', () => {
    it('accepts valid coordinates', () => {
      expect(isValidCoordinate(13.0827, 80.2707)).toBe(true); // Chennai
      expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true); // Sydney
      expect(isValidCoordinate(90, 180)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
    });

    it('rejects Null Island (0,0)', () => {
      expect(isValidCoordinate(0, 0)).toBe(false);
      expect(isValidCoordinate(0.00001, 0.00001)).toBe(false);
    });

    it('rejects null, undefined, and non-finite values', () => {
      expect(isValidCoordinate(null, 80)).toBe(false);
      expect(isValidCoordinate(13, undefined)).toBe(false);
      expect(isValidCoordinate(NaN, 80)).toBe(false);
      expect(isValidCoordinate(13, Infinity)).toBe(false);
    });

    it('rejects coordinates exceeding valid bounds', () => {
      expect(isValidCoordinate(91, 50)).toBe(false);
      expect(isValidCoordinate(-91, 50)).toBe(false);
      expect(isValidCoordinate(50, 181)).toBe(false);
      expect(isValidCoordinate(50, -181)).toBe(false);
    });
  });

  describe('calculateHaversineDistanceKm', () => {
    it('calculates accurate distance between Chennai and Bangalore (~290 km)', () => {
      const chennai = { lat: 13.0827, lon: 80.2707 };
      const bangalore = { lat: 12.9716, lon: 77.5946 };

      const dist = calculateHaversineDistanceKm(
        chennai.lat,
        chennai.lon,
        bangalore.lat,
        bangalore.lon,
      );

      expect(dist).not.toBeNull();
      expect(dist!).toBeGreaterThan(280);
      expect(dist!).toBeLessThan(300);
    });

    it('calculates small distances (~500m) accurately', () => {
      // 0.0045 deg latitude is ~500 meters
      const p1 = { lat: 13.0827, lon: 80.2707 };
      const p2 = { lat: 13.0872, lon: 80.2707 };

      const dist = calculateHaversineDistanceKm(p1.lat, p1.lon, p2.lat, p2.lon);
      expect(dist).not.toBeNull();
      expect(dist!).toBeGreaterThan(0.4);
      expect(dist!).toBeLessThan(0.6);
    });

    it('returns null if coordinates are missing or invalid', () => {
      expect(calculateHaversineDistanceKm(null, 80, 12, 77)).toBeNull();
      expect(calculateHaversineDistanceKm(13, 80, null, null)).toBeNull();
      expect(calculateHaversineDistanceKm(0, 0, 12, 77)).toBeNull(); // Null island
    });
  });

  describe('formatPrivacySafeDistance (Anti-Stalking Protections)', () => {
    it('bins any distance < 1 km into "Less than 1 km away"', () => {
      expect(formatPrivacySafeDistance(0)).toBe('Less than 1 km away');
      expect(formatPrivacySafeDistance(0.2)).toBe('Less than 1 km away');
      expect(formatPrivacySafeDistance(0.95)).toBe('Less than 1 km away');
    });

    it('rounds distances >= 1 km to nearest integer', () => {
      expect(formatPrivacySafeDistance(1.0)).toBe('1 km away');
      expect(formatPrivacySafeDistance(1.4)).toBe('1 km away');
      expect(formatPrivacySafeDistance(2.5)).toBe('3 km away');
      expect(formatPrivacySafeDistance(14.8)).toBe('15 km away');
    });

    it('falls back to "Nearby in [City]" when in same city without GPS', () => {
      expect(formatPrivacySafeDistance(null, 'Chennai', 'Tamil Nadu', true)).toBe(
        'Nearby in Chennai',
      );
    });

    it('falls back to city/region when different city without GPS', () => {
      expect(formatPrivacySafeDistance(null, 'Coimbatore', 'Tamil Nadu', false)).toBe(
        'Coimbatore, Tamil Nadu',
      );
      expect(formatPrivacySafeDistance(null, 'Madurai', null, false)).toBe('Madurai');
    });

    it('falls back to "Nearby" when no location data exists', () => {
      expect(formatPrivacySafeDistance(null, null, null, false)).toBe('Nearby');
    });
  });

  describe('calculateRelativeDistance', () => {
    it('computes privacy-safe result when GPS coordinates are available', () => {
      const result = calculateRelativeDistance(
        13.0827,
        80.2707,
        'Chennai',
        13.0835,
        80.2715,
        'Chennai',
        'Tamil Nadu',
      );

      // Distance is ~120m -> should display "Less than 1 km away"
      expect(result.distanceKm).not.toBeNull();
      expect(result.distanceKm!).toBeLessThan(1.0);
      expect(result.distanceDisplay).toBe('Less than 1 km away');
    });

    it('gracefully degrades to city proximity when one user has no GPS', () => {
      const result = calculateRelativeDistance(
        null,
        null,
        'Chennai',
        13.0827,
        80.2707,
        'chennai ',
        'Tamil Nadu',
      );

      expect(result.distanceKm).toBeNull();
      expect(result.distanceDisplay).toBe('Nearby in chennai');
    });
  });
});
