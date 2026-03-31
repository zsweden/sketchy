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
        name: 'Error',
        message: 'Boom',
        route: '/diagram?tab=chat',
      }),
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
        route: '/diagram?tab=chat',
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
    });

    expect(description).toContain('Error: Boom');
    expect(description).toContain(`version=${appVersion}`);
    expect(description).toContain('source=window.unhandledrejection');
    expect(description).toContain('route=/diagram?tab=chat');
    expect(description).toContain('componentStack=at Toolbar');
  });
});
