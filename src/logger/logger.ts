import type { Logger } from '../types/logger';

const createLogger = (): Logger => {
    let isDevelopment = (() => {
        // Check if running in development mode via environment variable
        try {
            // @ts-ignore - process.env is replaced at build time
            if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
                return false;
            }
        } catch (e) {
            // process is not defined in browser
        }

        // Check for dev mode flag in localStorage
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            try {
                const devTools = localStorage.getItem('devtools');
                if (devTools === 'true' || devTools === '1') {
                    return true;
                }
            } catch (e) {
                // localStorage might not be available
            }
        }

        // Check for dev mode flag in window
        if (typeof window !== 'undefined' && (window as any).__DCP_DEV_MODE__ === true) {
            return true;
        }

        // Check for localhost or common dev patterns
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname.includes('local.') ||
                hostname.endsWith('.local')) {
                return true;
            }
        }

        // Default to production (no logs)
        return false;
    })();

    return {
        log: (...args: any[]) => {
            if (isDevelopment) {
                console.log(...args);
            }
        },
        warn: (...args: any[]) => {
            if (isDevelopment) {
                console.warn(...args);
            }
        },
        error: (...args: any[]) => {
            // Always log errors, even in production
            console.error(...args);
        },
        info: (...args: any[]) => {
            if (isDevelopment) {
                console.info(...args);
            }
        },
        debug: (...args: any[]) => {
            if (isDevelopment) {
                console.debug(...args);
            }
        },
        setDevMode: (enabled: boolean) => {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                try {
                    if (enabled) {
                        localStorage.setItem('devtools', 'true');
                        (window as any).__DCP_DEV_MODE__ = true;
                        console.log('✅ Dev mode enabled. Reload the page for full effect.');
                    } else {
                        localStorage.removeItem('devtools');
                        (window as any).__DCP_DEV_MODE__ = false;
                        console.log('⏭️  Dev mode disabled. Reload the page for full effect.');
                    }
                    isDevelopment = enabled;
                } catch (e) {
                    console.warn('Failed to update localStorage for devTools');
                }
            }
        },
        isDevMode: () => isDevelopment
    };
};

export const logger = createLogger();

// Expose logger globally for debugging
if (typeof window !== 'undefined') {
    (window as any).__DCP_LOGGER__ = logger;
}