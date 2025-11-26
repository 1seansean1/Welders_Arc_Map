/**
 * Settings Panel Module - Handles glow effect and other visualization settings
 *
 * DEPENDENCIES:
 * - timeState: Glow settings state management
 * - logger: Diagnostic logging
 *
 * Features:
 * - Glow effect enable/disable toggle
 * - Glow intensity slider control
 * - Glow fade duration control (minutes before/after equator crossing)
 */

import timeState from '../state/timeState.js';
import logger from '../utils/logger.js';

// DOM Elements
const glowEnabledCheckbox = document.getElementById('glow-enabled-checkbox');
const glowIntensitySlider = document.getElementById('glow-intensity-slider');
const glowIntensityDisplay = document.getElementById('glow-intensity-display');
const glowFadeSlider = document.getElementById('glow-fade-slider');
const glowFadeInput = document.getElementById('glow-fade-input');

/**
 * Initialize settings panel controls
 */
export function initializeSettingsPanel() {
    if (!glowEnabledCheckbox || !glowIntensitySlider || !glowIntensityDisplay) {
        logger.warning('Settings panel controls not found', logger.CATEGORY.UI);
        return;
    }

    // Set initial values from state
    glowEnabledCheckbox.checked = timeState.isGlowEnabled();
    glowIntensitySlider.value = timeState.getGlowIntensity() * 100;
    glowIntensityDisplay.textContent = timeState.getGlowIntensity().toFixed(1);

    // Glow enabled checkbox handler
    glowEnabledCheckbox.addEventListener('change', (e) => {
        timeState.setGlowEnabled(e.target.checked);
    });

    // Glow intensity slider handler
    glowIntensitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 100; // Convert from 10-200 to 0.1-2.0
        glowIntensityDisplay.textContent = value.toFixed(1);
        timeState.setGlowIntensity(value);
    });

    // Glow fade duration controls
    if (glowFadeSlider && glowFadeInput) {
        // Set initial values
        glowFadeSlider.value = timeState.getGlowFadeMinutes();
        glowFadeInput.value = timeState.getGlowFadeMinutes();

        // Slider → input sync
        glowFadeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            glowFadeInput.value = value;
            timeState.setGlowFadeMinutes(value);
        });

        // Input → slider sync
        glowFadeInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value) || 5;
            value = Math.max(1, Math.min(30, value));
            glowFadeInput.value = value;
            glowFadeSlider.value = value;
            timeState.setGlowFadeMinutes(value);
        });
    }

    logger.diagnostic('Settings panel initialized', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeSettingsPanel();

export default {
    initializeSettingsPanel
};
