import type { Analytics } from 'firebase/analytics';

export interface FirebaseExceptionPayload {
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

async function importAnalyticsModule() {
  return import('firebase/analytics');
}

async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !hasFirebaseConfig) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const [{ getApp, getApps, initializeApp }, analyticsModule] = await Promise.all([
        import('firebase/app'),
        importAnalyticsModule(),
      ]);

      if (!(await analyticsModule.isSupported())) {
        return null;
      }

      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      return analyticsModule.getAnalytics(app);
    })();
  }

  return analyticsPromise;
}

export function isFirebaseErrorLoggingEnabled(): boolean {
  return hasFirebaseConfig;
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
    source: payload.source,
    error_name: payload.name,
    route: payload.route,
  });
}
