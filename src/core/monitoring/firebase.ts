import type { Analytics } from 'firebase/analytics';
import type { Firestore } from 'firebase/firestore';

interface FirebaseExceptionPayload {
  version: string;
  source: string;
  fatal: boolean;
  name: string;
  message: string;
  route: string;
  description: string;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let analyticsPromise: Promise<Analytics | null> | null = null;
let firestorePromise: Promise<Firestore | null> | null = null;

async function importAnalyticsModule() {
  return import('firebase/analytics');
}

async function getOrInitApp() {
  const { getApp, getApps, initializeApp } = await import('firebase/app');
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !hasFirebaseConfig) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const [app, analyticsModule] = await Promise.all([
        getOrInitApp(),
        importAnalyticsModule(),
      ]);

      if (!(await analyticsModule.isSupported())) {
        return null;
      }

      return analyticsModule.getAnalytics(app);
    })();
  }

  return analyticsPromise;
}

async function getFirebaseFirestore(): Promise<Firestore | null> {
  if (typeof window === 'undefined' || !hasFirebaseConfig) {
    return null;
  }

  if (!firestorePromise) {
    firestorePromise = (async () => {
      const [app, { getFirestore }] = await Promise.all([
        getOrInitApp(),
        import('firebase/firestore'),
      ]);
      return getFirestore(app);
    })();
  }

  return firestorePromise;
}

export async function logFirebaseException(payload: FirebaseExceptionPayload): Promise<void> {
  const analytics = await getFirebaseAnalytics();

  if (!analytics) {
    return;
  }

  const { logEvent } = await importAnalyticsModule();

  logEvent(analytics, 'exception', {
    description: payload.description,
    fatal: payload.fatal,
    app_version: payload.version,
    source: payload.source,
    error_name: payload.name,
    route: payload.route,
  });
}

export async function logFirestoreError(payload: FirebaseExceptionPayload): Promise<void> {
  const db = await getFirebaseFirestore();

  if (!db) {
    return;
  }

  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

  await addDoc(collection(db, 'errors'), {
    version: payload.version,
    source: payload.source,
    fatal: payload.fatal,
    name: payload.name,
    message: payload.message,
    route: payload.route,
    description: payload.description,
    timestamp: serverTimestamp(),
  });
}
