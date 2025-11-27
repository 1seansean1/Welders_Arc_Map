/**
 * Settings Panel Module - Handles glow effect and ground track settings
 *
 * DEPENDENCIES:
 * - timeState: Glow and ground track settings state management
 * - logger: Diagnostic logging
 *
 * Features:
 * - Ground track tail/head controls (moved from TIME panel)
 * - Glow effect enable/disable toggle
 * - Glow fade in/out duration controls (separate before/after)
 */

import timeState from '../state/timeState.js';
import logger from '../utils/logger.js';

/**
 * Initialize settings panel controls
 */
export function initializeSettingsPanel() {
    initializeGroundTrackControls();
    initializeGlowControls();
    logger.diagnostic('Settings panel initialized', logger.CATEGORY.UI);
}

/**
 * Initialize ground track tail/head controls
 */
function initializeGroundTrackControls() {
    const tailSlider = document.getElementById('track-tail-slider');
    const tailInput = document.getElementById('track-tail-input');
    const headSlider = document.getElementById('track-head-slider');
    const headInput = document.getElementById('track-head-input');

    if (!tailSlider || !tailInput || !headSlider || !headInput) {
        logger.warning('Ground track controls not found', logger.CATEGORY.UI);
        return;
    }

    // Set initial values
    tailSlider.value = timeState.getTailMinutes();
    tailInput.value = timeState.getTailMinutes();
    headSlider.value = timeState.getHeadMinutes();
    headInput.value = timeState.getHeadMinutes();

    // Tail slider handlers
    tailSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        tailInput.value = value;
        timeState.setTailMinutes(value);
    });

    tailInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value) || 45;
        value = Math.max(0, Math.min(90, value));
        tailInput.value = value;
        tailSlider.value = value;
        timeState.setTailMinutes(value);
    });

    // Head slider handlers
    headSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        headInput.value = value;
        timeState.setHeadMinutes(value);
    });

    headInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value) || 0;
        value = Math.max(0, Math.min(90, value));
        headInput.value = value;
        headSlider.value = value;
        timeState.setHeadMinutes(value);
    });
}

/**
 * Initialize glow effect controls
 */
function initializeGlowControls() {
    const glowEnabledCheckbox = document.getElementById('glow-enabled-checkbox');
    const fadeInInput = document.getElementById('glow-fade-in-input');
    const fadeInUp = document.getElementById('glow-fade-in-up');
    const fadeInDown = document.getElementById('glow-fade-in-down');
    const fadeOutInput = document.getElementById('glow-fade-out-input');
    const fadeOutUp = document.getElementById('glow-fade-out-up');
    const fadeOutDown = document.getElementById('glow-fade-out-down');

    if (!glowEnabledCheckbox) {
        logger.warning('Glow controls not found', logger.CATEGORY.UI);
        return;
    }

    // Set initial values
    glowEnabledCheckbox.checked = timeState.isGlowEnabled();

    if (fadeInInput) {
        fadeInInput.value = timeState.getGlowFadeInMinutes();
    }
    if (fadeOutInput) {
        fadeOutInput.value = timeState.getGlowFadeOutMinutes();
    }

    // Glow enabled checkbox handler
    glowEnabledCheckbox.addEventListener('change', (e) => {
        timeState.setGlowEnabled(e.target.checked);
    });

    // Fade In controls
    if (fadeInInput && fadeInUp && fadeInDown) {
        fadeInInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value) || 5;
            value = Math.max(1, Math.min(30, value));
            fadeInInput.value = value;
            timeState.setGlowFadeInMinutes(value);
        });

        fadeInUp.addEventListener('click', () => {
            let value = parseInt(fadeInInput.value) + 1;
            value = Math.min(30, value);
            fadeInInput.value = value;
            timeState.setGlowFadeInMinutes(value);
        });

        fadeInDown.addEventListener('click', () => {
            let value = parseInt(fadeInInput.value) - 1;
            value = Math.max(1, value);
            fadeInInput.value = value;
            timeState.setGlowFadeInMinutes(value);
        });
    }

    // Fade Out controls
    if (fadeOutInput && fadeOutUp && fadeOutDown) {
        fadeOutInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value) || 5;
            value = Math.max(1, Math.min(30, value));
            fadeOutInput.value = value;
            timeState.setGlowFadeOutMinutes(value);
        });

        fadeOutUp.addEventListener('click', () => {
            let value = parseInt(fadeOutInput.value) + 1;
            value = Math.min(30, value);
            fadeOutInput.value = value;
            timeState.setGlowFadeOutMinutes(value);
        });

        fadeOutDown.addEventListener('click', () => {
            let value = parseInt(fadeOutInput.value) - 1;
            value = Math.max(1, value);
            fadeOutInput.value = value;
            timeState.setGlowFadeOutMinutes(value);
        });
    }
}

// Auto-initialize when module loads
initializeSettingsPanel();

export default {
    initializeSettingsPanel
};
