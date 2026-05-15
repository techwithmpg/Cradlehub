type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  return { message: String(error) };
}

function emit(level: string, message: string, context: LogContext) {
  const line = JSON.stringify({
    level,
    message,
    ...context,
    timestamp: new Date().toISOString(),
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(message: string, context: LogContext = {}) {
  emit("info", message, context);
}

export function logWarn(message: string, context: LogContext = {}) {
  emit("warn", message, context);
}

export function logError(
  message: string,
  context: LogContext & { error?: unknown } = {}
) {
  const { error, ...rest } = context;
  emit("error", message, {
    ...rest,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  });
}

/**
 * Structured business event log. Use for critical domain actions
 * (bookings created/updated, staff approved, settings changed).
 * Never include PII, tokens, or full payloads.
 */
export function logBusinessEvent(event: string, context: LogContext = {}) {
  emit("event", event, context);
}
