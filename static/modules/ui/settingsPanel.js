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
    initializeApexTickControls();
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
    const sizeSlider = document.getElementById('glow-size-slider');
    const sizeValue = document.getElementById('glow-size-value');
    const brightnessSlider = document.getElementById('glow-brightness-slider');
    const brightnessValue = document.getElementById('glow-brightness-value');

    if (!glowEnabledCheckbox) {
        logger.warning('Glow controls not found', logger.CATEGORY.UI);
        return;
    }

    // Set initial values
    glowEnabledCheckbox.checked = timeState.isGlowEnabled();

    if (fadeInInput) {
        fadeInInput.value = timeState.getGlowFadeInMinutes();
    }
    // Initialize size slider
    if (sizeSlider && sizeValue) {
        const initialSize = timeState.getGlowSize();
        sizeSlider.value = Math.round(initialSize * 100);
        sizeValue.textContent = initialSize.toFixed(1) + 'x';
    }
    // Initialize brightness slider
    if (brightnessSlider && brightnessValue) {
        const initialBrightness = timeState.getGlowIntensity();
        brightnessSlider.value = Math.round(initialBrightness * 100);
        brightnessValue.textContent = initialBrightness.toFixed(1) + 'x';
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

    // Size slider handler
    if (sizeSlider && sizeValue) {
        sizeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            sizeValue.textContent = value.toFixed(1) + 'x';
            timeState.setGlowSize(value);
        });
    }

    // Brightness slider handler
    if (brightnessSlider && brightnessValue) {
        brightnessSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            brightnessValue.textContent = value.toFixed(1) + 'x';
            timeState.setGlowIntensity(value);
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

/**
 * Initialize apex tick pulse controls
 */
function initializeApexTickControls() {
    const enabledCheckbox = document.getElementById('apex-tick-enabled-checkbox');
    const speedInput = document.getElementById('apex-tick-speed-input');
    const speedUp = document.getElementById('apex-tick-speed-up');
    const speedDown = document.getElementById('apex-tick-speed-down');
    const widthInput = document.getElementById('apex-tick-width-input');
    const widthUp = document.getElementById('apex-tick-width-up');
    const widthDown = document.getElementById('apex-tick-width-down');
    const colorInput = document.getElementById('apex-tick-color-input');
    const opacityInput = document.getElementById('apex-tick-opacity-input');
    const opacityValue = document.getElementById('apex-tick-opacity-value');

    if (!enabledCheckbox) {
        logger.warning('Apex tick controls not found', logger.CATEGORY.UI);
        return;
    }

    // Set initial values from state
    enabledCheckbox.checked = timeState.isApexTickEnabled();

    if (speedInput) {
        speedInput.value = timeState.getApexTickPulseSpeed();
    }
    if (widthInput) {
        widthInput.value = timeState.getApexTickPulseWidth();
    }
    if (colorInput) {
        colorInput.value = timeState.getApexTickColor();
    }
    if (opacityInput) {
        const opacity = timeState.getApexTickOpacity();
        opacityInput.value = Math.round(opacity * 100);
        if (opacityValue) {
            opacityValue.textContent = Math.round(opacity * 100) + '%';
        }
    }

    // Enabled checkbox handler
    enabledCheckbox.addEventListener('change', (e) => {
        timeState.setApexTickEnabled(e.target.checked);
    });

    // Pulse Speed controls
    if (speedInput && speedUp && speedDown) {
        speedInput.addEventListener('change', (e) => {
            let value = parseFloat(e.target.value) || 1.0;
            value = Math.max(0.5, Math.min(5.0, value));
            speedInput.value = value;
            timeState.setApexTickPulseSpeed(value);
        });

        speedUp.addEventListener('click', () => {
            let value = parseFloat(speedInput.value) + 0.5;
            value = Math.min(5.0, value);
            speedInput.value = value;
            timeState.setApexTickPulseSpeed(value);
        });

        speedDown.addEventListener('click', () => {
            let value = parseFloat(speedInput.value) - 0.5;
            value = Math.max(0.5, value);
            speedInput.value = value;
            timeState.setApexTickPulseSpeed(value);
        });
    }

    // Pulse Width controls
    if (widthInput && widthUp && widthDown) {
        widthInput.addEventListener('change', (e) => {
            let value = parseFloat(e.target.value) || 3.0;
            value = Math.max(1, Math.min(10, value));
            widthInput.value = value;
            timeState.setApexTickPulseWidth(value);
        });

        widthUp.addEventListener('click', () => {
            let value = parseFloat(widthInput.value) + 0.5;
            value = Math.min(10, value);
            widthInput.value = value;
            timeState.setApexTickPulseWidth(value);
        });

        widthDown.addEventListener('click', () => {
            let value = parseFloat(widthInput.value) - 0.5;
            value = Math.max(1, value);
            widthInput.value = value;
            timeState.setApexTickPulseWidth(value);
        });
    }

    // Color picker handler
    if (colorInput) {
        colorInput.addEventListener('change', (e) => {
            timeState.setApexTickColor(e.target.value);
        });
    }

    // Opacity slider handler
    if (opacityInput) {
        opacityInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const opacity = value / 100;
            timeState.setApexTickOpacity(opacity);
            if (opacityValue) {
                opacityValue.textContent = value + '%';
            }
        });
    }
}

// Auto-initialize when module loads
initializeSettingsPanel();

export default {
    initializeSettingsPanel
};
