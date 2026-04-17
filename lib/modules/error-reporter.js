/**
 * Lightweight error reporter.
 *
 * We deliberately do NOT pull in @sentry/nextjs — it's 70kb gz and
 * injects a worker script. This module speaks Sentry's public envelope
 * protocol directly when NEXT_PUBLIC_SENTRY_DSN is set, and otherwise
 * drops events into a ring buffer the Debug Perf Panel can read.
 *
 * On the client, global `error` and `unhandledrejection` handlers are
 * wired up by `installErrorReporter()`.
 *
 * Opt-in: set NEXT_PUBLIC_SENTRY_DSN in .env.local or similar. Without
 * it, this module is a pure in-memory logger.
 */

const BUFFER_CAP = 50;
const buffer = [];

function parseDsn(dsn) {
    try {
        const u = new URL(dsn);
        const publicKey = u.username;
        const projectId = u.pathname.replace(/^\//, '');
        const host = u.host;
        return {
            endpoint: `${u.protocol}//${host}/api/${projectId}/envelope/`,
            publicKey,
            projectId,
        };
    } catch { return null; }
}

function getDsn() {
    if (typeof process !== 'undefined' && process.env) {
        return process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || null;
    }
    return null;
}

function buildEnvelope(event, dsn) {
    const eventId = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '');
    const header = {
        event_id: eventId,
        sent_at: new Date().toISOString(),
        dsn,
    };
    const itemHeader = { type: 'event' };
    return [JSON.stringify(header), JSON.stringify(itemHeader), JSON.stringify(event)].join('\n');
}

function send(event) {
    const dsn = getDsn();
    if (!dsn) return;
    const parsed = parseDsn(dsn);
    if (!parsed) return;

    const body = buildEnvelope(event, dsn);
    const auth = [
        'sentry_version=7',
        `sentry_key=${parsed.publicKey}`,
        `sentry_client=effexiq/1.0`,
    ].join(',');

    try {
        if (typeof fetch === 'undefined') return;
        fetch(parsed.endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-sentry-envelope',
                'x-sentry-auth': `Sentry ${auth}`,
            },
            body,
            keepalive: true,
        }).catch(() => {});
    } catch {}
}

export function captureException(err, context = {}) {
    const event = {
        timestamp: Date.now() / 1000,
        platform: 'javascript',
        level: 'error',
        environment: typeof process !== 'undefined' ? (process.env.NODE_ENV || 'production') : 'production',
        exception: {
            values: [
                {
                    type: err?.name || 'Error',
                    value: String(err?.message || err || 'unknown error'),
                    stacktrace: err?.stack ? { frames: parseStack(err.stack) } : undefined,
                },
            ],
        },
        extra: context,
    };
    buffer.push(event);
    if (buffer.length > BUFFER_CAP) buffer.splice(0, buffer.length - BUFFER_CAP);
    send(event);
    return event;
}

export function captureMessage(message, level = 'info', context = {}) {
    const event = {
        timestamp: Date.now() / 1000,
        platform: 'javascript',
        level,
        message: { formatted: String(message) },
        extra: context,
    };
    buffer.push(event);
    if (buffer.length > BUFFER_CAP) buffer.splice(0, buffer.length - BUFFER_CAP);
    send(event);
    return event;
}

function parseStack(stack) {
    return String(stack || '')
        .split('\n')
        .slice(0, 30)
        .map(line => ({ filename: line.trim() }));
}

let _installed = false;
export function installErrorReporter() {
    if (_installed || typeof window === 'undefined') return;
    _installed = true;
    window.addEventListener('error', (e) => {
        captureException(e.error || new Error(e.message || 'window.error'), { filename: e.filename, lineno: e.lineno });
    });
    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason;
        captureException(reason instanceof Error ? reason : new Error(String(reason)), { source: 'unhandledrejection' });
    });
}

export function getBufferedEvents() { return buffer.slice(); }
export function clearBufferedEvents() { buffer.length = 0; }
