// ===== OBS WebSocket Integration =====
// Connects to OBS Studio via obs-websocket (v5) to switch scenes
// based on Effexiq sound decisions.
//
// Requirements:
//   - OBS Studio with obs-websocket v5 plugin enabled
//   - User configures host/port/password in Settings
//
// Usage: The engine calls obsBridge.switchScene('Combat') when mood changes.

const OBS_DEFAULT_PORT = 4455;

class ObsBridge {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.password = '';
        this.host = 'localhost';
        this.port = OBS_DEFAULT_PORT;
        this.requestId = 0;
        this._pendingRequests = new Map();
        this._sceneMap = {}; // mood -> OBS scene name
        this._currentScene = null;
    }

    /**
     * Connect to OBS WebSocket.
     * @param {{ host?: string, port?: number, password?: string }} opts
     */
    async connect(opts = {}) {
        this.host = opts.host || this.host;
        this.port = opts.port || this.port;
        this.password = opts.password || this.password;

        if (this.ws) {
            try { this.ws.close(); } catch (_) {}
        }

        return new Promise((resolve, reject) => {
            const url = `ws://${this.host}:${this.port}`;
            this.ws = new WebSocket(url);

            const timeout = setTimeout(() => {
                reject(new Error('OBS WebSocket connection timed out'));
                try { this.ws.close(); } catch (_) {}
            }, 5000);

            this.ws.onopen = () => {
                clearTimeout(timeout);
                this.connected = true;
                console.log('[OBS] Connected to', url);
                resolve();
            };

            this.ws.onerror = (e) => {
                clearTimeout(timeout);
                this.connected = false;
                console.warn('[OBS] Connection error:', e);
                reject(new Error('OBS WebSocket connection failed'));
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('[OBS] Disconnected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this._handleMessage(msg);
                } catch (_) {}
            };
        });
    }

    disconnect() {
        if (this.ws) {
            try { this.ws.close(); } catch (_) {}
            this.ws = null;
        }
        this.connected = false;
    }

    _handleMessage(msg) {
        // Handle identified (auth success)
        if (msg.op === 2) {
            console.log('[OBS] Identified successfully');
        }
        // Handle request response
        if (msg.op === 7 && msg.d?.requestId) {
            const pending = this._pendingRequests.get(msg.d.requestId);
            if (pending) {
                this._pendingRequests.delete(msg.d.requestId);
                if (msg.d.requestStatus?.result) {
                    pending.resolve(msg.d.responseData);
                } else {
                    pending.reject(new Error(msg.d.requestStatus?.comment || 'Request failed'));
                }
            }
        }
        // Handle Hello (auth required)
        if (msg.op === 0) {
            // Send Identify
            const identify = { op: 1, d: { rpcVersion: 1 } };
            if (this.password && msg.d?.authentication) {
                // obs-websocket v5 uses SHA256 challenge-response
                this._authenticate(msg.d.authentication).then(auth => {
                    identify.d.authentication = auth;
                    this.ws.send(JSON.stringify(identify));
                });
            } else {
                this.ws.send(JSON.stringify(identify));
            }
        }
    }

    async _authenticate(authChallenge) {
        const { challenge, salt } = authChallenge;
        // SHA256(password + salt) -> base64 -> SHA256(result + challenge) -> base64
        const enc = new TextEncoder();
        const hash1 = await crypto.subtle.digest('SHA-256', enc.encode(this.password + salt));
        const b64_1 = btoa(String.fromCharCode(...new Uint8Array(hash1)));
        const hash2 = await crypto.subtle.digest('SHA-256', enc.encode(b64_1 + challenge));
        return btoa(String.fromCharCode(...new Uint8Array(hash2)));
    }

    async _sendRequest(requestType, requestData = {}) {
        if (!this.connected || !this.ws) {
            throw new Error('Not connected to OBS');
        }

        const requestId = String(++this.requestId);
        const msg = {
            op: 6,
            d: { requestType, requestId, requestData },
        };

        return new Promise((resolve, reject) => {
            this._pendingRequests.set(requestId, { resolve, reject });
            this.ws.send(JSON.stringify(msg));
            setTimeout(() => {
                if (this._pendingRequests.has(requestId)) {
                    this._pendingRequests.delete(requestId);
                    reject(new Error('OBS request timed out'));
                }
            }, 5000);
        });
    }

    /** Get list of available scenes */
    async getScenes() {
        const data = await this._sendRequest('GetSceneList');
        return (data?.scenes || []).map(s => s.sceneName);
    }

    /** Switch to a named OBS scene */
    async switchScene(sceneName) {
        if (!this.connected) return;
        if (this._currentScene === sceneName) return; // already on this scene
        try {
            await this._sendRequest('SetCurrentProgramScene', { sceneName });
            this._currentScene = sceneName;
            console.log(`[OBS] Switched to scene: ${sceneName}`);
        } catch (e) {
            console.warn(`[OBS] Failed to switch to "${sceneName}":`, e.message);
        }
    }

    /**
     * Configure mood-to-scene mapping.
     * @param {Object} map - e.g. { combat: 'Battle Scene', calm: 'Ambient Scene' }
     */
    setSceneMap(map) {
        this._sceneMap = { ...map };
    }

    /** Auto-switch scene based on mood string from AI analysis */
    switchByMood(mood) {
        if (!this.connected || !mood) return;
        const sceneName = this._sceneMap[mood.toLowerCase()];
        if (sceneName) {
            this.switchScene(sceneName);
        }
    }

    /** Save connection settings to localStorage */
    saveSettings() {
        const settings = {
            host: this.host,
            port: this.port,
            password: this.password,
            sceneMap: this._sceneMap,
        };
        try {
            localStorage.setItem('Effexiq_obs_settings', JSON.stringify(settings));
        } catch (_) {}
    }

    /** Load connection settings from localStorage */
    loadSettings() {
        try {
            const raw = localStorage.getItem('Effexiq_obs_settings');
            if (!raw) return null;
            const settings = JSON.parse(raw);
            if (settings.host) this.host = settings.host;
            if (settings.port) this.port = settings.port;
            if (settings.password) this.password = settings.password;
            if (settings.sceneMap) this._sceneMap = settings.sceneMap;
            return settings;
        } catch (_) { return null; }
    }
}

// Singleton
export const obsBridge = new ObsBridge();
