/**
 * Geometry Utilities - Coordinate calculations and conversions
 *
 * DEPENDENCIES: None (pure mathematical functions)
 * PERFORMANCE: O(n) for circle generation, O(1) for conversions
 *
 * Features:
 * - FOV (Field of View) circle calculations
 * - Coordinate system conversions
 * - Distance calculations on sphere
 * - Angular conversions
 * - Great circle calculations
 */

// Earth radius in kilometers (mean radius)
export const EARTH_RADIUS_KM = 6371;

// Earth radius in meters
export const EARTH_RADIUS_M = 6371000;

/**
 * Calculate FOV circle polygon
 * Computes ground coordinates for sensor field of view at given altitude
 *
 * @param {number} sensorLat - Sensor latitude (degrees)
 * @param {number} sensorLon - Sensor longitude (degrees)
 * @param {number} fovAltitude - Reference altitude for FOV calculation (km)
 * @param {number} numPoints - Number of polygon vertices (default 64)
 * @returns {Array<[number, number]>} Array of [lon, lat] coordinates forming a circle
 *
 * PERFORMANCE: O(n) where n = numPoints
 */
export function calculateFOVCircle(sensorLat, sensorLon, fovAltitude, numPoints = 64) {
    // Calculate horizon distance using spherical geometry
    // d = sqrt(2 * R * H + H^2) where H is satellite altitude
    const horizonDistance = Math.sqrt(2 * EARTH_RADIUS_KM * fovAltitude + fovAltitude * fovAltitude);

    // Convert to angular radius (degrees)
    const angularRadius = (horizonDistance / EARTH_RADIUS_KM) * (180 / Math.PI);

    // Generate circle points
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;

        // Calculate point at distance and bearing from sensor
        const lat = sensorLat + angularRadius * Math.cos(angle);
        const lon = sensorLon + (angularRadius * Math.sin(angle)) / Math.cos(sensorLat * Math.PI / 180);

        points.push([lon, lat]);
    }

    return points;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Calculate great circle distance between two points (Haversine formula)
 * @param {number} lat1 - First point latitude (degrees)
 * @param {number} lon1 - First point longitude (degrees)
 * @param {number} lat2 - Second point latitude (degrees)
 * @param {number} lon2 - Second point longitude (degrees)
 * @returns {number} Distance in kilometers
 */
export function greatCircleDistance(lat1, lon1, lat2, lon2) {
    const φ1 = degreesToRadians(lat1);
    const φ2 = degreesToRadians(lat2);
    const Δφ = degreesToRadians(lat2 - lat1);
    const Δλ = degreesToRadians(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Start latitude (degrees)
 * @param {number} lon1 - Start longitude (degrees)
 * @param {number} lat2 - End latitude (degrees)
 * @param {number} lon2 - End longitude (degrees)
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = degreesToRadians(lat1);
    const φ2 = degreesToRadians(lat2);
    const Δλ = degreesToRadians(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    const bearing = (radiansToDegrees(θ) + 360) % 360;

    return bearing;
}

/**
 * Calculate destination point given start point, bearing, and distance
 * @param {number} lat - Start latitude (degrees)
 * @param {number} lon - Start longitude (degrees)
 * @param {number} bearing - Bearing in degrees
 * @param {number} distance - Distance in kilometers
 * @returns {Object} Object with {lat, lon} properties
 */
export function calculateDestination(lat, lon, bearing, distance) {
    const δ = distance / EARTH_RADIUS_KM;
    const θ = degreesToRadians(bearing);
    const φ1 = degreesToRadians(lat);
    const λ1 = degreesToRadians(lon);

    const φ2 = Math.asin(
        Math.sin(φ1) * Math.cos(δ) +
        Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );

    const λ2 = λ1 + Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

    return {
        lat: radiansToDegrees(φ2),
        lon: radiansToDegrees(λ2)
    };
}

/**
 * Normalize longitude to -180 to 180 range
 * @param {number} lon - Longitude in degrees
 * @returns {number} Normalized longitude
 */
export function normalizeLongitude(lon) {
    let normalized = lon % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    return normalized;
}

/**
 * Clamp latitude to -90 to 90 range
 * @param {number} lat - Latitude in degrees
 * @returns {number} Clamped latitude
 */
export function clampLatitude(lat) {
    return Math.max(-90, Math.min(90, lat));
}

/**
 * Check if coordinates are valid
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @returns {boolean} True if valid
 */
export function isValidCoordinate(lat, lon) {
    return !isNaN(lat) && !isNaN(lon) &&
           lat >= -90 && lat <= 90 &&
           lon >= -180 && lon <= 180;
}

/**
 * Calculate midpoint between two coordinates
 * @param {number} lat1 - First point latitude (degrees)
 * @param {number} lon1 - First point longitude (degrees)
 * @param {number} lat2 - Second point latitude (degrees)
 * @param {number} lon2 - Second point longitude (degrees)
 * @returns {Object} Object with {lat, lon} properties
 */
export function calculateMidpoint(lat1, lon1, lat2, lon2) {
    const φ1 = degreesToRadians(lat1);
    const λ1 = degreesToRadians(lon1);
    const φ2 = degreesToRadians(lat2);
    const λ2 = degreesToRadians(lon2);

    const Bx = Math.cos(φ2) * Math.cos(λ2 - λ1);
    const By = Math.cos(φ2) * Math.sin(λ2 - λ1);

    const φ3 = Math.atan2(
        Math.sin(φ1) + Math.sin(φ2),
        Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
    );

    const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);

    return {
        lat: radiansToDegrees(φ3),
        lon: radiansToDegrees(λ3)
    };
}

/**
 * Calculate bounding box for a set of coordinates
 * @param {Array<[number, number]>} coordinates - Array of [lon, lat] pairs
 * @returns {Object} Bounding box {minLon, minLat, maxLon, maxLat}
 */
export function calculateBoundingBox(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return null;
    }

    let minLon = coordinates[0][0];
    let maxLon = coordinates[0][0];
    let minLat = coordinates[0][1];
    let maxLat = coordinates[0][1];

    for (const [lon, lat] of coordinates) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }

    return { minLon, minLat, maxLon, maxLat };
}
