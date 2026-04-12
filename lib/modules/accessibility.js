// ===== ACCESSIBILITY MODULE - Keyboard shortcuts, ARIA, screen reader support =====

import { CONFIG } from '../config.js';

/**
 * Keyboard shortcut manager
 */
export class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = CONFIG.UI.ENABLE_KEYBOARD_SHORTCUTS;
        this.helpVisible = false;
    }
    
    /**
     * Register a keyboard shortcut
     * @param {string} key - Key combination (e.g., 'ctrl+m', 'shift+s')
     * @param {Function} handler - Handler function
     * @param {string} description - Description for help menu
     */
    register(key, handler, description) {
        this.shortcuts.set(key.toLowerCase(), {
            handler,
            description
        });
    }
    
    /**
     * Initialize keyboard event listeners
     */
    init() {
        if (!this.enabled) return;
        
        this._keydownHandler = (e) => this.handleKeyDown(e);
        document.addEventListener('keydown', this._keydownHandler);
        
        // Register default shortcuts
        this.registerDefaults();
        
        console.log('[KeyboardShortcuts] Initialized with', this.shortcuts.size, 'shortcuts');
    }
    
    destroy() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
        this.shortcuts.clear();
    }
    
    /**
     * Handle keydown event
     * @param {KeyboardEvent} e
     */
    handleKeyDown(e) {
        // Don't interfere with input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const key = this.getKeyString(e);
        const shortcut = this.shortcuts.get(key);
        
        if (shortcut) {
            e.preventDefault();
            shortcut.handler(e);
        }
    }
    
    /**
     * Get key string from event
     * @param {KeyboardEvent} e
     * @returns {string}
     */
    getKeyString(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        if (e.metaKey) parts.push('meta');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }
    
    /**
     * Register default application shortcuts
     */
    registerDefaults() {
        // Listening controls
        this.register('ctrl+l', () => {
            window.dispatchEvent(new CustomEvent('Effexiq:toggle-listening'));
        }, 'Toggle listening on/off');
        
        // Audio controls
        this.register('ctrl+m', () => {
            window.dispatchEvent(new CustomEvent('Effexiq:toggle-music'));
        }, 'Mute/unmute music');
        
        this.register('ctrl+s', () => {
            window.dispatchEvent(new CustomEvent('Effexiq:stop-all'));
        }, 'Stop all sounds');
        
        this.register('ctrl+shift+s', () => {
            window.dispatchEvent(new CustomEvent('Effexiq:toggle-sfx'));
        }, 'Mute/unmute sound effects');
        
        // Volume controls
        this.register('ctrl+arrowup', () => {
            window.dispatchEvent(new CustomEvent('Effexiq:volume-up'));
        }, 'Increase volume');
        
        this.register('ctrl+arrowdown', () => {
            window.dispatchEvent(new CustomEvent('Effexiq:volume-down'));
        }, 'Decrease volume');
        
        // Navigation
        this.register('?', () => {
            this.toggleHelp();
        }, 'Show keyboard shortcuts help');
        
        this.register('escape', () => {
            this.hideHelp();
            window.dispatchEvent(new CustomEvent('Effexiq:close-modal'));
        }, 'Close modal/help');
    }
    
    /**
     * Show keyboard shortcuts help
     */
    toggleHelp() {
        if (this.helpVisible) {
            this.hideHelp();
        } else {
            this.showHelp();
        }
    }
    
    /**
     * Show help modal
     */
    showHelp() {
        const modal = this.createHelpModal();
        document.body.appendChild(modal);
        this.helpVisible = true;
        
        // Announce to screen readers
        announceToScreenReader('Keyboard shortcuts help opened');
    }
    
    /**
     * Hide help modal
     */
    hideHelp() {
        const modal = document.getElementById('keyboardHelpModal');
        if (modal) {
            modal.remove();
            this.helpVisible = false;
        }
    }
    
    /**
     * Create help modal element
     * @returns {HTMLElement}
     */
    createHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'keyboardHelpModal';
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'helpModalTitle');
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        const title = document.createElement('h2');
        title.id = 'helpModalTitle';
        title.textContent = '⌨️ Keyboard Shortcuts';
        content.appendChild(title);
        
        const list = document.createElement('div');
        list.style.textAlign = 'left';
        list.style.marginTop = '20px';
        
        for (const [key, shortcut] of this.shortcuts) {
            const item = document.createElement('div');
            item.style.marginBottom = '10px';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.gap = '20px';
            
            const keySpan = document.createElement('kbd');
            keySpan.textContent = key.toUpperCase().replace(/\+/g, ' + ');
            keySpan.style.background = 'rgba(138, 43, 226, 0.2)';
            keySpan.style.padding = '4px 8px';
            keySpan.style.borderRadius = '4px';
            keySpan.style.fontFamily = 'monospace';
            
            const descSpan = document.createElement('span');
            descSpan.textContent = shortcut.description;
            descSpan.style.color = '#aaa';
            
            item.appendChild(keySpan);
            item.appendChild(descSpan);
            list.appendChild(item);
        }
        
        content.appendChild(list);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-primary';
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '20px';
        closeBtn.onclick = () => this.hideHelp();
        content.appendChild(closeBtn);
        
        modal.appendChild(content);
        modal.onclick = (e) => {
            if (e.target === modal) this.hideHelp();
        };
        
        return modal;
    }
    
    /**
     * Get all shortcuts for display
     * @returns {Array}
     */
    getAllShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([key, shortcut]) => ({
            key,
            description: shortcut.description
        }));
    }
}

/**
 * Screen reader announcer
 */
export class ScreenReaderAnnouncer {
    constructor() {
        this.liveRegion = null;
        this.enabled = CONFIG.UI.ENABLE_SCREEN_READER;
    }
    
    /**
     * Initialize live region for announcements
     */
    init() {
        if (!this.enabled) return;
        
        // Create ARIA live region
        this.liveRegion = document.createElement('div');
        this.liveRegion.id = 'screenReaderAnnouncements';
        this.liveRegion.setAttribute('role', 'status');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        
        document.body.appendChild(this.liveRegion);
        console.log('[ScreenReader] Announcer initialized');
    }
    
    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     * @param {string} priority - 'polite' or 'assertive'
     */
    announce(message, priority = 'polite') {
        if (!this.enabled || !this.liveRegion) return;
        
        this.liveRegion.setAttribute('aria-live', priority);
        this.liveRegion.textContent = message;
        
        // Clear after announcement to allow repeat messages
        setTimeout(() => {
            if (this.liveRegion) {
                this.liveRegion.textContent = '';
            }
        }, 1000);
    }
}

/**
 * ARIA label manager
 */
export class ARIAManager {
    /**
     * Add ARIA labels to UI elements
     */
    static enhanceUI() {
        // Enhance buttons
        const buttons = document.querySelectorAll('button:not([aria-label])');
        buttons.forEach(btn => {
            if (!btn.getAttribute('aria-label') && btn.textContent) {
                btn.setAttribute('aria-label', btn.textContent.trim());
            }
        });
        
        // Enhance sliders (only add listener once)
        const sliders = document.querySelectorAll('input[type="range"]:not([data-aria-enhanced])');
        sliders.forEach(slider => {
            slider.setAttribute('data-aria-enhanced', '1');
            if (!slider.getAttribute('aria-label')) {
                const label = slider.closest('.slider-container')?.querySelector('label');
                if (label) {
                    slider.setAttribute('aria-label', label.textContent.trim());
                }
            }
            slider.addEventListener('input', function() {
                this.setAttribute('aria-valuenow', this.value);
                announceToScreenReader(`${this.getAttribute('aria-label')}: ${this.value}%`);
            });
        });
        
        // Enhance toggles (only add listener once)
        const toggles = document.querySelectorAll('input[type="checkbox"]:not([data-aria-enhanced])');
        toggles.forEach(toggle => {
            toggle.setAttribute('data-aria-enhanced', '1');
            toggle.addEventListener('change', function() {
                const label = document.querySelector(`label[for="${this.id}"]`);
                if (label) {
                    const state = this.checked ? 'enabled' : 'disabled';
                    announceToScreenReader(`${label.textContent.trim()} ${state}`);
                }
            });
        });
        
        const total = buttons.length + sliders.length + toggles.length;
        if (total > 0) console.log('[ARIA] Enhanced', total, 'elements');
    }
    
    /**
     * Add skip navigation link
     */
    static addSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#mainContent';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'skip-link';
        skipLink.style.cssText = `
            position: absolute;
            left: -10000px;
            top: auto;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        skipLink.addEventListener('focus', function() {
            this.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 10000;
                background: var(--primary);
                color: white;
                padding: 10px;
                text-decoration: none;
                border-radius: 5px;
            `;
        });
        skipLink.addEventListener('blur', function() {
            this.style.cssText = `
                position: absolute;
                left: -10000px;
                top: auto;
                width: 1px;
                height: 1px;
                overflow: hidden;
            `;
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Add ID to main content if missing
        const appContainer = document.getElementById('appContainer');
        if (appContainer && !appContainer.id.includes('mainContent')) {
            appContainer.setAttribute('id', 'mainContent');
        }
    }
}

/**
 * Global screen reader announce function
 */
let screenReaderInstance = null;

export function announceToScreenReader(message, priority = 'polite') {
    if (!screenReaderInstance) {
        screenReaderInstance = new ScreenReaderAnnouncer();
        screenReaderInstance.init();
    }
    screenReaderInstance.announce(message, priority);
}

/**
 * Initialize all accessibility features
 */
export function initAccessibility() {
    // Keyboard shortcuts
    const keyboard = new KeyboardShortcuts();
    keyboard.init();
    
    // Screen reader
    const screenReader = new ScreenReaderAnnouncer();
    screenReader.init();
    screenReaderInstance = screenReader;
    
    // ARIA enhancements
    ARIAManager.enhanceUI();
    ARIAManager.addSkipLink();
    
    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        document.body.classList.add('reduced-motion');
        console.log('[Accessibility] Reduced motion enabled');
    }
    
    // Re-enhance UI when DOM changes (debounced)
    let ariaTimer = null;
    const observer = new MutationObserver(() => {
        if (ariaTimer) return;
        ariaTimer = setTimeout(() => { ariaTimer = null; ARIAManager.enhanceUI(); }, 3000);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    console.log('[Accessibility] Initialized');
    
    return {
        keyboard,
        screenReader,
        announceToScreenReader
    };
}

export default {
    KeyboardShortcuts,
    ScreenReaderAnnouncer,
    ARIAManager,
    announceToScreenReader,
    initAccessibility
};
