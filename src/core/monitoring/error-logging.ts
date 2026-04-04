import { appVersion } from '../app-version';
import { logFirebaseException, logFirestoreError } from './firebase';

type ErrorSource =
  | 'react.error_boundary'
  | 'window.error'
  | 'window.unhandledrejection'
  | 'chat.empty_response'
  | 'chat.malformed_mention'
  | 'chat.stream_error'
  | 'layout.elk_error';

interface ReportErrorOptions {
  source: ErrorSource;
  fatal: boolean;
  componentStack?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
}

const MAX_DESCRIPTION_LENGTH = 500;
const DEDUPE_WINDOW_MS = 5_000;

const recentFingerprints = new Map<string, number>();

let globalHandlersInstalled = false;

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function normalizeUnknownError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return 'Unknown error';
            }
          })();

    const name =
      'name' in error && typeof error.name === 'string'
        ? error.name
        : 'Error';

    const stack =
      'stack' in error && typeof error.stack === 'string'
        ? error.stack
        : undefined;

    return { name, message, stack };
  }

  return {
    name: 'Error',
    message: 'Unknown error',
  };
}

function getCurrentRoute(): string {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  return window.location.pathname || '/';
}

function shouldSkipFingerprint(fingerprint: string): boolean {
  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint);

  recentFingerprints.set(fingerprint, now);

  for (const [key, timestamp] of recentFingerprints) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      recentFingerprints.delete(key);
    }
  }

  return lastSeen !== undefined && now - lastSeen < DEDUPE_WINDOW_MS;
}

export function buildErrorDescription(
  error: unknown,
  { source, componentStack, metadata }: Pick<ReportErrorOptions, 'source' | 'componentStack' | 'metadata'>,
): string {
  const normalized = normalizeUnknownError(error);
  const details = [
    `${normalized.name}: ${normalized.message}`,
    `version=${appVersion}`,
    `source=${source}`,
    `route=${getCurrentRoute()}`,
  ];

  if (componentStack) {
    details.push(`componentStack=${componentStack.replace(/\s+/g, ' ').trim()}`);
  }

  if (normalized.stack) {
    const firstStackLine = normalized.stack.split('\n').slice(0, 2).join(' | ');
    details.push(`stack=${firstStackLine}`);
  }

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) continue;
      details.push(`${key}=${String(value)}`);
    }
  }

  return truncate(details.join(' | '), MAX_DESCRIPTION_LENGTH);
}

export async function reportError(error: unknown, options: ReportErrorOptions): Promise<void> {
  const normalized = normalizeUnknownError(error);
  const route = getCurrentRoute();
  const fingerprint = `${options.source}|${normalized.name}|${normalized.message}|${route}`;

  if (shouldSkipFingerprint(fingerprint)) {
    return;
  }

  const payload = {
    version: appVersion,
    source: options.source,
    fatal: options.fatal,
    name: normalized.name,
    message: normalized.message,
    route,
    description: buildErrorDescription(error, options),
  };

  await Promise.all([
    logFirebaseException(payload),
    logFirestoreError(payload),
  ]);
}

export function installGlobalErrorLogging(): void {
  if (globalHandlersInstalled || typeof window === 'undefined') {
    return;
  }

  globalHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message || 'Unknown window error');
    void reportError(error, { source: 'window.error', fatal: true });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason ?? new Error('Unhandled promise rejection'), {
      source: 'window.unhandledrejection',
      fatal: false,
    });
  });
}

export function resetErrorLoggingForTests(): void {
  recentFingerprints.clear();
  globalHandlersInstalled = false;
}
