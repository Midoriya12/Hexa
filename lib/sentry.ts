// Sentry — crash + error reporting. Acceptance criterion: "all errors logged to
// Sentry". Sentry.init installs a global handler that captures unhandled JS
// exceptions and native crashes; Sentry.wrap(RootLayout) adds routing/error-boundary
// instrumentation; caught errors call captureException explicitly.
import * as Sentry from '@sentry/react-native';

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // no-op if unconfigured (e.g. some local runs)
  Sentry.init({
    dsn,
    // Tune in beta; modest tracing for now.
    tracesSampleRate: 0.2,
  });
}

export { Sentry };
