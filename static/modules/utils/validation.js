/**
 * Validation Utilities - Input validation and sanitization
 *
 * DEPENDENCIES: None (pure validation functions)
 * SECURITY: XSS protection, input sanitization
 *
 * Features:
 * - Coordinate validation (lat, lon, altitude)
 * - Name validation with length limits
 * - TLE (Two-Line Element) validation
 * - HTML sanitization (XSS prevention)
 * - Numeric range validation
 * - String sanitization
 */

/**
 * Validate latitude coordinate
 * @param {number|string} lat - Latitude value
 * @returns {Object} {valid: boolean, error: string|null, value: number|null}
 */
export function validateLatitude(lat) {
    // Convert to number if string
    const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;

    // Check if valid number
    if (isNaN(numLat)) {
        return { valid: false, error: 'Latitude must be a number', value: null };
    }

    // Check range
    if (numLat < -90 || numLat > 90) {
        return { valid: false, error: 'Latitude must be between -90 and 90', value: null };
    }

    return { valid: true, error: null, value: numLat };
}

/**
 * Validate longitude coordinate
 * @param {number|string} lon - Longitude value
 * @returns {Object} {valid: boolean, error: string|null, value: number|null}
 */
export function validateLongitude(lon) {
    // Convert to number if string
    const numLon = typeof lon === 'string' ? parseFloat(lon) : lon;

    // Check if valid number
    if (isNaN(numLon)) {
        return { valid: false, error: 'Longitude must be a number', value: null };
    }

    // Check range
    if (numLon < -180 || numLon > 180) {
        return { valid: false, error: 'Longitude must be between -180 and 180', value: null };
    }

    return { valid: true, error: null, value: numLon };
}

/**
 * Validate altitude (sensor altitude in meters)
 * @param {number|string} alt - Altitude value
 * @param {number} min - Minimum altitude (default -500m, Dead Sea)
 * @param {number} max - Maximum altitude (default 9000m, Mt. Everest)
 * @returns {Object} {valid: boolean, error: string|null, value: number|null}
 */
export function validateAltitude(alt, min = -500, max = 9000) {
    // Convert to number if string
    const numAlt = typeof alt === 'string' ? parseFloat(alt) : alt;

    // Check if valid number
    if (isNaN(numAlt)) {
        return { valid: false, error: 'Altitude must be a number', value: null };
    }

    // Check range
    if (numAlt < min || numAlt > max) {
        return { valid: false, error: `Altitude must be between ${min} and ${max} meters`, value: null };
    }

    return { valid: true, error: null, value: numAlt };
}

/**
 * Validate FOV altitude (satellite altitude in kilometers)
 * @param {number|string} fovAlt - FOV altitude value
 * @param {number} min - Minimum altitude (default 100km)
 * @param {number} max - Maximum altitude (default 50000km, beyond LEO)
 * @returns {Object} {valid: boolean, error: string|null, value: number|null}
 */
export function validateFOVAltitude(fovAlt, min = 100, max = 50000) {
    // Convert to number if string
    const numFovAlt = typeof fovAlt === 'string' ? parseFloat(fovAlt) : fovAlt;

    // Check if valid number
    if (isNaN(numFovAlt)) {
        return { valid: false, error: 'FOV altitude must be a number', value: null };
    }

    // Check range
    if (numFovAlt < min || numFovAlt > max) {
        return { valid: false, error: `FOV altitude must be between ${min} and ${max} kilometers`, value: null };
    }

    return { valid: true, error: null, value: numFovAlt };
}

/**
 * Validate name (sensor or satellite name)
 * @param {string} name - Name to validate
 * @param {number} maxLength - Maximum length (default 30)
 * @param {number} minLength - Minimum length (default 1)
 * @returns {Object} {valid: boolean, error: string|null, value: string|null}
 */
export function validateName(name, maxLength = 30, minLength = 1) {
    // Check if string
    if (typeof name !== 'string') {
        return { valid: false, error: 'Name must be a string', value: null };
    }

    // Trim whitespace
    const trimmedName = name.trim();

    // Check if empty
    if (trimmedName.length < minLength) {
        return { valid: false, error: `Name must be at least ${minLength} character(s)`, value: null };
    }

    // Check length
    if (trimmedName.length > maxLength) {
        return { valid: false, error: `Name must be ${maxLength} characters or less`, value: null };
    }

    // Check for invalid characters (basic XSS prevention)
    const invalidChars = /[<>]/;
    if (invalidChars.test(trimmedName)) {
        return { valid: false, error: 'Name contains invalid characters (< >)', value: null };
    }

    return { valid: true, error: null, value: trimmedName };
}

/**
 * Validate TLE (Two-Line Element) format
 * @param {string} line1 - TLE line 1
 * @param {string} line2 - TLE line 2
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateTLE(line1, line2) {
    // Check if strings
    if (typeof line1 !== 'string' || typeof line2 !== 'string') {
        return { valid: false, error: 'TLE lines must be strings' };
    }

    // Trim whitespace
    const trimmedLine1 = line1.trim();
    const trimmedLine2 = line2.trim();

    // Check line 1 length (69 characters)
    if (trimmedLine1.length !== 69) {
        return { valid: false, error: `TLE line 1 must be 69 characters (got ${trimmedLine1.length})` };
    }

    // Check line 2 length (69 characters)
    if (trimmedLine2.length !== 69) {
        return { valid: false, error: `TLE line 2 must be 69 characters (got ${trimmedLine2.length})` };
    }

    // Check line 1 starts with '1'
    if (trimmedLine1[0] !== '1') {
        return { valid: false, error: 'TLE line 1 must start with "1"' };
    }

    // Check line 2 starts with '2'
    if (trimmedLine2[0] !== '2') {
        return { valid: false, error: 'TLE line 2 must start with "2"' };
    }

    // Check satellite catalog number matches (positions 2-6)
    const catalogNum1 = trimmedLine1.substring(2, 7);
    const catalogNum2 = trimmedLine2.substring(2, 7);
    if (catalogNum1 !== catalogNum2) {
        return { valid: false, error: 'TLE catalog numbers do not match' };
    }

    // Basic checksum validation (optional, positions 68)
    // Note: Full checksum validation would require calculating modulo 10
    const checksum1 = trimmedLine1[68];
    const checksum2 = trimmedLine2[68];
    if (!/[0-9]/.test(checksum1) || !/[0-9]/.test(checksum2)) {
        return { valid: false, error: 'TLE checksums must be digits' };
    }

    return { valid: true, error: null };
}

/**
 * Sanitize HTML string (prevent XSS attacks)
 * Removes all HTML tags and encodes special characters
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeHTML(html) {
    if (typeof html !== 'string') {
        return '';
    }

    // Remove all HTML tags
    let sanitized = html.replace(/<[^>]*>/g, '');

    // Encode special characters
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');

    return sanitized;
}

/**
 * Validate numeric value within range
 * @param {number|string} value - Value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} {valid: boolean, error: string|null, value: number|null}
 */
export function validateNumber(value, min, max, fieldName = 'Value') {
    // Convert to number if string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Check if valid number
    if (isNaN(numValue)) {
        return { valid: false, error: `${fieldName} must be a number`, value: null };
    }

    // Check if finite
    if (!isFinite(numValue)) {
        return { valid: false, error: `${fieldName} must be finite`, value: null };
    }

    // Check range
    if (numValue < min || numValue > max) {
        return { valid: false, error: `${fieldName} must be between ${min} and ${max}`, value: null };
    }

    return { valid: true, error: null, value: numValue };
}

/**
 * Validate integer value within range
 * @param {number|string} value - Value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} {valid: boolean, error: string|null, value: number|null}
 */
export function validateInteger(value, min, max, fieldName = 'Value') {
    // First validate as number
    const numResult = validateNumber(value, min, max, fieldName);
    if (!numResult.valid) {
        return numResult;
    }

    // Check if integer
    if (!Number.isInteger(numResult.value)) {
        return { valid: false, error: `${fieldName} must be an integer`, value: null };
    }

    return { valid: true, error: null, value: numResult.value };
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {Object} {valid: boolean, error: string|null, value: string|null}
 */
export function validateEmail(email) {
    if (typeof email !== 'string') {
        return { valid: false, error: 'Email must be a string', value: null };
    }

    const trimmedEmail = email.trim();

    // Basic email regex (not comprehensive, but good enough)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
        return { valid: false, error: 'Invalid email format', value: null };
    }

    return { valid: true, error: null, value: trimmedEmail };
}

/**
 * Validate required field (not empty)
 * @param {any} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateRequired(value, fieldName = 'Field') {
    // Check for null or undefined
    if (value === null || value === undefined) {
        return { valid: false, error: `${fieldName} is required` };
    }

    // Check for empty string
    if (typeof value === 'string' && value.trim() === '') {
        return { valid: false, error: `${fieldName} is required` };
    }

    return { valid: true, error: null };
}

/**
 * Validate multiple fields at once
 * Returns first validation error encountered, or success if all pass
 * @param {Array<Function>} validators - Array of validator functions (each returns {valid, error})
 * @returns {Object} {valid: boolean, error: string|null}
 */
export function validateAll(validators) {
    for (const validator of validators) {
        const result = validator();
        if (!result.valid) {
            return result;
        }
    }
    return { valid: true, error: null };
}

/**
 * Validate sensor input (composite validation)
 * @param {Object} sensor - Sensor object with {name, lat, lon, alt, fovAltitude}
 * @returns {Object} {valid: boolean, errors: Object, values: Object}
 */
export function validateSensor(sensor) {
    const errors = {};
    const values = {};

    // Validate name
    const nameResult = validateName(sensor.name, 20, 1);
    if (!nameResult.valid) errors.name = nameResult.error;
    else values.name = nameResult.value;

    // Validate latitude
    const latResult = validateLatitude(sensor.lat);
    if (!latResult.valid) errors.lat = latResult.error;
    else values.lat = latResult.value;

    // Validate longitude
    const lonResult = validateLongitude(sensor.lon);
    if (!lonResult.valid) errors.lon = lonResult.error;
    else values.lon = lonResult.value;

    // Validate altitude
    const altResult = validateAltitude(sensor.alt);
    if (!altResult.valid) errors.alt = altResult.error;
    else values.alt = altResult.value;

    // Validate FOV altitude
    const fovResult = validateFOVAltitude(sensor.fovAltitude);
    if (!fovResult.valid) errors.fovAltitude = fovResult.error;
    else values.fovAltitude = fovResult.value;

    const valid = Object.keys(errors).length === 0;
    return { valid, errors, values };
}

/**
 * Validate satellite input (composite validation)
 * @param {Object} satellite - Satellite object with {name, tle1, tle2}
 * @returns {Object} {valid: boolean, errors: Object, values: Object}
 */
export function validateSatellite(satellite) {
    const errors = {};
    const values = {};

    // Validate name
    const nameResult = validateName(satellite.name, 30, 1);
    if (!nameResult.valid) errors.name = nameResult.error;
    else values.name = nameResult.value;

    // Validate TLE
    const tleResult = validateTLE(satellite.tle1, satellite.tle2);
    if (!tleResult.valid) errors.tle = tleResult.error;
    else {
        values.tle1 = satellite.tle1.trim();
        values.tle2 = satellite.tle2.trim();
    }

    const valid = Object.keys(errors).length === 0;
    return { valid, errors, values };
}
