import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appVersion } from '../../app-version';
import {
  buildErrorDescription,
  installGlobalErrorLogging,
  reportError,
  resetErrorLoggingForTests,
} from '../error-logging';
import { logFirebaseException, logFirestoreError } from '../firebase';

vi.mock('../firebase', () => ({
  logFirebaseException: vi.fn().mockResolvedValue(undefined),
  logFirestoreError: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Node.js 25+ ships a native `localStorage` global that shadows jsdom's.
 * The native version has no methods when `--localstorage-file` is absent.
 */
function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createMemoryStorage(),
  configurable: true,
  writable: true,
});

describe('error logging', () => {
  beforeEach(() => {
    resetErrorLoggingForTests();
    vi.mocked(logFirebaseException).mockClear();
    vi.mocked(logFirestoreError).mockClear();
    window.history.replaceState({}, '', '/diagram?tab=chat');
  });

  afterEach(() => {
    resetErrorLoggingForTests();
  });

  it('reports normalized exceptions to Firebase', async () => {
    await reportError(new Error('Boom'), {
      source: 'react.error_boundary',
      fatal: true,
      componentStack: '\n    at App',
    });

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        version: appVersion,
        source: 'react.error_boundary',
        fatal: true,
        severity: 'error',
        name: 'Error',
        message: 'Boom',
        route: '/diagram',
      }),
    );
  });

  it('logs ResizeObserver noise with severity "noise"', async () => {
    await reportError(
      new Error('ResizeObserver loop completed with undelivered notifications.'),
      { source: 'window.error', fatal: true },
    );

    expect(logFirestoreError).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'noise' }),
    );
  });

  it('logs HMR getSnapshot noise with severity "noise"', async () => {
    await reportError(
      new TypeError("Cannot read properties of null (reading 'getSnapshot')"),
      { source: 'react.error_boundary', fatal: true },
    );

    expect(logFirestoreError).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'noise' }),
    );
  });

  it('logs HMR hooks-count noise with severity "noise"', async () => {
    await reportError(
      new Error('Rendered more hooks than during the previous render.'),
      { source: 'react.error_boundary', fatal: true },
    );

    expect(logFirestoreError).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'noise' }),
    );
  });

  it('dedupes repeated errors in the same window', async () => {
    await reportError(new Error('Boom'), {
      source: 'window.error',
      fatal: true,
    });
    await reportError(new Error('Boom'), {
      source: 'window.error',
      fatal: true,
    });

    expect(logFirebaseException).toHaveBeenCalledTimes(1);
  });

  it('installs global listeners for browser errors', async () => {
    installGlobalErrorLogging();

    window.dispatchEvent(new ErrorEvent('error', { message: 'Window broke' }));

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        version: appVersion,
        source: 'window.error',
        message: 'Window broke',
      }),
    );
  });

  it('writes errors to Firestore alongside Analytics', async () => {
    await reportError(new Error('Firestore test'), {
      source: 'window.error',
      fatal: true,
    });

    expect(logFirestoreError).toHaveBeenCalledWith(
      expect.objectContaining({
        version: appVersion,
        source: 'window.error',
        fatal: true,
        name: 'Error',
        message: 'Firestore test',
        route: '/diagram',
      }),
    );
  });

  it('dedupes Firestore writes along with Analytics', async () => {
    await reportError(new Error('Boom'), {
      source: 'window.error',
      fatal: true,
    });
    await reportError(new Error('Boom'), {
      source: 'window.error',
      fatal: true,
    });

    expect(logFirestoreError).toHaveBeenCalledTimes(1);
  });

  it('builds a compact error description', () => {
    const description = buildErrorDescription(new Error('Boom'), {
      source: 'window.unhandledrejection',
      componentStack: '\n    at Toolbar',
      metadata: {
        provider: 'openai',
        resultTextLength: 0,
      },
    });

    expect(description).toContain('Error: Boom');
    expect(description).toContain(`version=${appVersion}`);
    expect(description).toContain('source=window.unhandledrejection');
    expect(description).toContain('route=/diagram');
    expect(description).toContain('componentStack=at Toolbar');
    expect(description).toContain('provider=openai');
    expect(description).toContain('resultTextLength=0');
  });

  it('builds description without optional fields', () => {
    const description = buildErrorDescription(new Error('Simple'), {
      source: 'window.error',
    });

    expect(description).toContain('Error: Simple');
    expect(description).toContain('source=window.error');
    expect(description).not.toContain('componentStack=');
  });

  it('skips undefined metadata values', () => {
    const description = buildErrorDescription(new Error('Test'), {
      source: 'chat.stream_error',
      metadata: { present: 'yes', missing: undefined },
    });

    expect(description).toContain('present=yes');
    expect(description).not.toContain('missing=');
  });

  it('truncates long descriptions', () => {
    const longMessage = 'x'.repeat(600);
    const description = buildErrorDescription(new Error(longMessage), {
      source: 'window.error',
    });

    expect(description.length).toBeLessThanOrEqual(500);
    expect(description).toContain('…');
  });
});

describe('normalizeUnknownError via reportError', () => {
  beforeEach(() => {
    resetErrorLoggingForTests();
    vi.mocked(logFirebaseException).mockClear();
    vi.mocked(logFirestoreError).mockClear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    resetErrorLoggingForTests();
  });

  it('normalizes string errors', async () => {
    await reportError('string error', {
      source: 'chat.stream_error',
      fatal: false,
    });

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error',
        message: 'string error',
      }),
    );
  });

  it('normalizes object errors with message property', async () => {
    await reportError({ message: 'object error', code: 42 }, {
      source: 'chat.stream_error',
      fatal: false,
    });

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error',
        message: 'object error',
      }),
    );
  });

  it('normalizes object errors without message (JSON.stringify)', async () => {
    await reportError({ code: 42 }, {
      source: 'chat.stream_error',
      fatal: false,
    });

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error',
        message: '{"code":42}',
      }),
    );
  });

  it('normalizes null/undefined errors', async () => {
    await reportError(null, {
      source: 'window.error',
      fatal: true,
    });

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Error',
        message: 'Unknown error',
      }),
    );
  });

  it('normalizes object errors with name and stack', async () => {
    await reportError({ name: 'CustomError', message: 'custom', stack: 'at foo.ts:1' }, {
      source: 'window.error',
      fatal: false,
    });

    expect(logFirebaseException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CustomError',
        message: 'custom',
      }),
    );
  });
});

describe('deduplication edge cases', () => {
  beforeEach(() => {
    resetErrorLoggingForTests();
    vi.mocked(logFirebaseException).mockClear();
    vi.mocked(logFirestoreError).mockClear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    resetErrorLoggingForTests();
  });

  it('allows different errors through (no false deduplication)', async () => {
    await reportError(new Error('Error A'), { source: 'window.error', fatal: true });
    await reportError(new Error('Error B'), { source: 'window.error', fatal: true });

    expect(logFirebaseException).toHaveBeenCalledTimes(2);
  });

  it('allows same error from different sources', async () => {
    await reportError(new Error('Boom'), { source: 'window.error', fatal: true });
    await reportError(new Error('Boom'), { source: 'chat.stream_error', fatal: false });

    expect(logFirebaseException).toHaveBeenCalledTimes(2);
  });
});

describe('localStorage fallback on Firestore failure', () => {
  const PENDING_KEY = 'sketchy_pending_errors';

  beforeEach(() => {
    resetErrorLoggingForTests();
    vi.mocked(logFirebaseException).mockClear();
    vi.mocked(logFirestoreError).mockClear();
    localStorage.removeItem(PENDING_KEY);
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    resetErrorLoggingForTests();
    localStorage.removeItem(PENDING_KEY);
  });

  it('queues to localStorage when Firestore write fails', async () => {
    vi.mocked(logFirestoreError).mockRejectedValueOnce(new Error('network'));

    await reportError(new Error('Offline boom'), {
      source: 'chat.stream_error',
      fatal: false,
    });

    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    expect(pending).toHaveLength(1);
    expect(pending[0].message).toBe('Offline boom');
    expect(pending[0].source).toBe('chat.stream_error');
  });

  it('flushes pending errors on next successful write', async () => {
    // Seed one pending error
    localStorage.setItem(PENDING_KEY, JSON.stringify([{
      version: '1.0.0',
      source: 'chat.stream_error',
      fatal: false,
      name: 'Error',
      message: 'Queued error',
      route: '/',
      description: 'Error: Queued error',
    }]));

    await reportError(new Error('Success write'), {
      source: 'window.error',
      fatal: true,
    });

    // Pending error should have been flushed
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    // logFirestoreError: 1 for the new error + 1 for the flushed error
    expect(logFirestoreError).toHaveBeenCalledTimes(2);
    expect(logFirestoreError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Queued error' }),
    );
  });

  it('caps pending errors to prevent localStorage bloat', async () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({
      version: '1.0.0', source: 'window.error', fatal: false,
      name: 'Error', message: `Error ${i}`, route: '/', description: `Error ${i}`,
    }));
    localStorage.setItem(PENDING_KEY, JSON.stringify(existing));

    vi.mocked(logFirestoreError).mockRejectedValueOnce(new Error('network'));

    await reportError(new Error('Error 50'), {
      source: 'window.error',
      fatal: false,
    });

    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    expect(pending).toHaveLength(50);
    // Oldest should be dropped, newest should be present
    expect(pending[pending.length - 1].message).toBe('Error 50');
    expect(pending[0].message).toBe('Error 1');
  });
});

describe('installGlobalErrorLogging edge cases', () => {
  beforeEach(() => {
    resetErrorLoggingForTests();
    vi.mocked(logFirebaseException).mockClear();
    vi.mocked(logFirestoreError).mockClear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    resetErrorLoggingForTests();
  });

  it('only installs handlers once (idempotent)', () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener');

    installGlobalErrorLogging();
    const firstCallCount = addEventSpy.mock.calls.length;

    installGlobalErrorLogging(); // second call — should be no-op
    expect(addEventSpy.mock.calls.length).toBe(firstCallCount);

    addEventSpy.mockRestore();
  });

  it('handles unhandledrejection events', async () => {
    installGlobalErrorLogging();

    const event = new PromiseRejectionEvent('unhandledrejection', {
      reason: new Error('Promise failed'),
      promise: Promise.reject(new Error('Promise failed')),
    });

    // Suppress the unhandled rejection from the test helper promise
    event.promise.catch(() => {});

    window.dispatchEvent(event);

    // Wait for async reportError
    await vi.waitFor(() => {
      expect(logFirebaseException).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'window.unhandledrejection',
          message: 'Promise failed',
        }),
      );
    });
  });
});
