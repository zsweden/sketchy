import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addDoc = vi.fn().mockResolvedValue(undefined);
const collection = vi.fn();
const serverTimestamp = vi.fn();
const getFirestore = vi.fn(() => ({} as object));

vi.mock('firebase/firestore', () => ({
  addDoc,
  collection,
  serverTimestamp,
  getFirestore,
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({} as object)),
  getApps: vi.fn(() => [{}]),
  initializeApp: vi.fn(() => ({} as object)),
}));

const payload = {
  version: '1.0.0',
  source: 'window.error',
  fatal: true,
  severity: 'error' as const,
  name: 'Error',
  message: 'Test',
  route: '/',
  description: 'Error: Test',
};

describe('logFirestoreError PROD gate', () => {
  beforeEach(() => {
    vi.resetModules();
    addDoc.mockClear();
    getFirestore.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips Firestore writes when not in production (e.g. dev/HMR)', async () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app');

    const { logFirestoreError } = await import('../firebase');
    await logFirestoreError(payload);

    expect(getFirestore).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('writes to Firestore when in production', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app');

    const { logFirestoreError } = await import('../firebase');
    await logFirestoreError(payload);

    expect(addDoc).toHaveBeenCalledTimes(1);
  });
});
