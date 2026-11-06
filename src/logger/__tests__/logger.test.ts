import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Logger', () => {
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
    let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;
    let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;
    
    // Store original values
    const originalWindow = global.window;
    const originalLocalStorage = global.localStorage;

    beforeEach(() => {
        // Setup console spies
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

        // Mock localStorage
        const localStorageMock = (() => {
            let store: Record<string, string> = {};
            return {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => {
                    store[key] = value.toString();
                },
                removeItem: (key: string) => {
                    delete store[key];
                },
                clear: () => {
                    store = {};
                }
            };
        })();

        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        // Mock window
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    hostname: 'localhost'
                }
            },
            writable: true
        });

        // Clear module cache to reset logger
        jest.resetModules();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleDebugSpy.mockRestore();

        // Restore original values
        Object.defineProperty(global, 'window', {
            value: originalWindow,
            writable: true
        });
        Object.defineProperty(global, 'localStorage', {
            value: originalLocalStorage,
            writable: true
        });
    });

    it('logs in development mode (localhost)', async () => {
        const { logger } = await import('../logger');

        logger.log('test log');
        logger.info('test info');
        logger.warn('test warn');
        logger.debug('test debug');

        expect(consoleLogSpy).toHaveBeenCalledWith('test log');
        expect(consoleInfoSpy).toHaveBeenCalledWith('test info');
        expect(consoleWarnSpy).toHaveBeenCalledWith('test warn');
        expect(consoleDebugSpy).toHaveBeenCalledWith('test debug');
    });

    it('always logs errors even in production', async () => {
        // Mock production environment
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    hostname: 'example.com'
                }
            },
            writable: true
        });

        jest.resetModules();
        const { logger } = await import('../logger');

        logger.error('test error');

        expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });

    it('does not log in production mode', async () => {
        // Mock production environment
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    hostname: 'example.com'
                }
            },
            writable: true
        });

        jest.resetModules();
        const { logger } = await import('../logger');

        logger.log('test log');
        logger.info('test info');
        logger.warn('test warn');
        logger.debug('test debug');

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleInfoSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('enables dev mode via localStorage', async () => {
        // Mock production environment
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    hostname: 'example.com'
                }
            },
            writable: true
        });

        // Set devtools in localStorage
        localStorage.setItem('devtools', 'true');

        jest.resetModules();
        const { logger } = await import('../logger');

        logger.log('test log');

        expect(consoleLogSpy).toHaveBeenCalledWith('test log');
        expect(logger.isDevMode()).toBe(true);
    });

    it('enables dev mode via __DCP_DEV_MODE__', async () => {
        // Mock production environment with dev mode flag
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    hostname: 'example.com'
                },
                __DCP_DEV_MODE__: true
            },
            writable: true
        });

        jest.resetModules();
        const { logger } = await import('../logger');

        logger.log('test log');

        expect(consoleLogSpy).toHaveBeenCalledWith('test log');
        expect(logger.isDevMode()).toBe(true);
    });

    it('setDevMode enables logging', async () => {
        // Mock production environment
        Object.defineProperty(global, 'window', {
            value: {
                location: {
                    hostname: 'example.com'
                }
            },
            writable: true
        });

        jest.resetModules();
        const { logger } = await import('../logger');

        // Should not log initially
        logger.log('before enable');
        expect(consoleLogSpy).not.toHaveBeenCalledWith('before enable');

        // Enable dev mode
        logger.setDevMode(true);

        // Should log after enabling
        logger.log('after enable');
        expect(consoleLogSpy).toHaveBeenCalledWith('after enable');
        expect(localStorage.getItem('devtools')).toBe('true');
    });

    it('setDevMode disables logging', async () => {
        const { logger } = await import('../logger');

        // Should log initially (localhost)
        logger.log('before disable');
        expect(consoleLogSpy).toHaveBeenCalledWith('before disable');

        // Disable dev mode
        logger.setDevMode(false);

        // Should not log after disabling
        consoleLogSpy.mockClear();
        logger.log('after disable');
        expect(consoleLogSpy).not.toHaveBeenCalledWith('after disable');
        expect(localStorage.getItem('devtools')).toBeNull();
    });

    it('isDevMode returns correct state', async () => {
        const { logger } = await import('../logger');

        // Initially true (localhost)
        expect(logger.isDevMode()).toBe(true);

        // After disabling
        logger.setDevMode(false);
        expect(logger.isDevMode()).toBe(false);

        // After enabling
        logger.setDevMode(true);
        expect(logger.isDevMode()).toBe(true);
    });

    it('detects localhost variations', async () => {
        const hostnames = ['localhost', '127.0.0.1', 'app.local', 'test.local.domain'];

        for (const hostname of hostnames) {
            Object.defineProperty(global, 'window', {
                value: {
                    location: { hostname }
                },
                writable: true
            });

            jest.resetModules();
            const { logger } = await import('../logger');

            expect(logger.isDevMode()).toBe(true);
        }
    });

    it('exposes logger globally', async () => {
        const { logger } = await import('../logger');

        expect((global.window as any).__DCP_LOGGER__).toBe(logger);
    });
});