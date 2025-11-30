/**
 * Settings Panel Module - Handles glow effect, ground track, and theme settings
 *
 * DEPENDENCIES:
 * - timeState: Glow and ground track settings state management
 * - themeState: Light/dark theme state management
 * - logger: Diagnostic logging
 *
 * Features:
 * - Theme toggle (light/dark mode)
 * - Ground track tail/head controls (moved from TIME panel)
 * - Glow effect enable/disable toggle
 * - Glow fade in/out duration controls (separate before/after)
 */

import timeState from '../state/timeState.js';
import themeState from '../state/themeState.js';
import profileState from '../state/profileState.js';
import logger from '../utils/logger.js';
import { showProfileDefaultsModal } from './modals.js';

/**
 * Initialize settings panel controls
 */
export function initializeSettingsPanel() {
    initializeThemeControls();
    initializeGroundTrackControls();
    initializeGlowControls();
    initializeApexTickControls();
    initializeProfileDefaultsButton();
    initializeLogControls();
    logger.diagnostic('Settings panel initialized', logger.CATEGORY.UI);
}

/**
 * Initialize profile defaults button
 */
function initializeProfileDefaultsButton() {
    const btn = document.getElementById('profile-defaults-btn');
    if (!btn) {
        logger.warning('Profile defaults button not found', logger.CATEGORY.UI);
        return;
    }

    btn.addEventListener('click', () => {
        const currentSettings = profileState.getSettings();
        showProfileDefaultsModal(currentSettings, async (newSettings) => {
            // Save to profile
            await profileState.saveSettings(newSettings);
            
            // Apply settings to current session
            if (newSettings.theme) themeState.setTheme(newSettings.theme);
            if (newSettings.tailMinutes !== undefined) timeState.setTailMinutes(newSettings.tailMinutes);
            if (newSettings.headMinutes !== undefined) timeState.setHeadMinutes(newSettings.headMinutes);
            if (newSettings.glowEnabled !== undefined) timeState.setGlowEnabled(newSettings.glowEnabled);
            if (newSettings.glowSize !== undefined) timeState.setGlowSize(newSettings.glowSize);
            if (newSettings.glowIntensity !== undefined) timeState.setGlowIntensity(newSettings.glowIntensity);
            if (newSettings.glowFadeInMinutes !== undefined) timeState.setGlowFadeInMinutes(newSettings.glowFadeInMinutes);
            if (newSettings.glowFadeOutMinutes !== undefined) timeState.setGlowFadeOutMinutes(newSettings.glowFadeOutMinutes);
            if (newSettings.apexTickEnabled !== undefined) timeState.setApexTickEnabled(newSettings.apexTickEnabled);
            if (newSettings.apexTickPulseSpeed !== undefined) timeState.setApexTickPulseSpeed(newSettings.apexTickPulseSpeed);
            if (newSettings.apexTickPulseWidth !== undefined) timeState.setApexTickPulseWidth(newSettings.apexTickPulseWidth);
            if (newSettings.apexTickColor !== undefined) timeState.setApexTickColor(newSettings.apexTickColor);
            if (newSettings.apexTickOpacity !== undefined) timeState.setApexTickOpacity(newSettings.apexTickOpacity);
            
            // Update UI controls to reflect new values
            updateSettingsUI();
        });
    });
}

/**
 * Update settings UI controls to reflect current state
 */
function updateSettingsUI() {
    // Theme
    const themeCheckbox = document.getElementById('theme-toggle-checkbox');
    if (themeCheckbox) themeCheckbox.checked = themeState.isDarkTheme();
    
    // Ground track
    const tailSlider = document.getElementById('track-tail-slider');
    const tailInput = document.getElementById('track-tail-input');
    const headSlider = document.getElementById('track-head-slider');
    const headInput = document.getElementById('track-head-input');
    if (tailSlider) tailSlider.value = timeState.getTailMinutes();
    if (tailInput) tailInput.value = timeState.getTailMinutes();
    if (headSlider) headSlider.value = timeState.getHeadMinutes();
    if (headInput) headInput.value = timeState.getHeadMinutes();
    
    // Glow
    const glowEnabledCheckbox = document.getElementById('glow-enabled-checkbox');
    const sizeSlider = document.getElementById('glow-size-slider');
    const sizeValue = document.getElementById('glow-size-value');
    const brightnessSlider = document.getElementById('glow-brightness-slider');
    const brightnessValue = document.getElementById('glow-brightness-value');
    if (glowEnabledCheckbox) glowEnabledCheckbox.checked = timeState.isGlowEnabled();
    if (sizeSlider) sizeSlider.value = Math.round(timeState.getGlowSize() * 100);
    if (sizeValue) sizeValue.textContent = timeState.getGlowSize().toFixed(1) + 'x';
    if (brightnessSlider) brightnessSlider.value = Math.round(timeState.getGlowIntensity() * 100);
    if (brightnessValue) brightnessValue.textContent = timeState.getGlowIntensity().toFixed(1) + 'x';
    
    // Apex tick
    const apexEnabledCheckbox = document.getElementById('apex-tick-enabled-checkbox');
    const speedInput = document.getElementById('apex-tick-speed-input');
    const widthInput = document.getElementById('apex-tick-width-input');
    const colorInput = document.getElementById('apex-tick-color-input');
    const opacityInput = document.getElementById('apex-tick-opacity-input');
    const opacityValue = document.getElementById('apex-tick-opacity-value');
    if (apexEnabledCheckbox) apexEnabledCheckbox.checked = timeState.isApexTickEnabled();
    if (speedInput) speedInput.value = timeState.getApexTickPulseSpeed();
    if (widthInput) widthInput.value = timeState.getApexTickPulseWidth();
    if (colorInput) colorInput.value = timeState.getApexTickColor();
    if (opacityInput) opacityInput.value = Math.round(timeState.getApexTickOpacity() * 100);
    if (opacityValue) opacityValue.textContent = Math.round(timeState.getApexTickOpacity() * 100) + '%';
}

/**
 * Initialize theme toggle controls
 */
function initializeThemeControls() {
    const themeCheckbox = document.getElementById('theme-toggle-checkbox');

    if (!themeCheckbox) {
        logger.warning('Theme toggle checkbox not found', logger.CATEGORY.UI);
        return;
    }

    // Set initial checkbox state (checked = dark mode)
    themeCheckbox.checked = themeState.isDarkTheme();

    // Handle toggle change
    themeCheckbox.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        themeState.setTheme(newTheme);
    });

    logger.diagnostic('Theme controls initialized', logger.CATEGORY.UI);
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


/**
 * Initialize log controls in Settings panel
 * - Toggle show/hide
 * - Log level filter
 * - Throttle interval slider
 * - Clear all button
 */
function initializeLogControls() {
    const toggleBtn = document.getElementById('logs-toggle-btn');
    const logsContent = document.getElementById('logs-content-inline');
    const levelSelect = document.getElementById('log-level-select');
    const throttleSlider = document.getElementById('log-throttle-slider');
    const throttleValue = document.getElementById('log-throttle-value');
    const clearAllBtn = document.getElementById('log-clear-all-btn');

    // Toggle show/hide
    if (toggleBtn && logsContent) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = logsContent.style.display === 'none';
            logsContent.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
        });
    }

    // Log level filter
    if (levelSelect) {
        // Set initial value from logger
        levelSelect.value = logger.getUIMinLevel();

        levelSelect.addEventListener('change', (e) => {
            logger.setUIMinLevel(e.target.value);
        });
    }

    // Throttle interval slider
    if (throttleSlider && throttleValue) {
        // Set initial value from logger
        throttleSlider.value = logger.getThrottleMs();
        throttleValue.textContent = (logger.getThrottleMs() / 1000).toFixed(1) + 's';

        throttleSlider.addEventListener('input', (e) => {
            const ms = parseInt(e.target.value);
            throttleValue.textContent = (ms / 1000).toFixed(1) + 's';
            logger.setThrottleMs(ms);
        });
    }

    // Clear all button
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            logger.clearAll();
        });
    }

    logger.diagnostic('Log controls initialized', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeSettingsPanel();

export default {
    initializeSettingsPanel
};
