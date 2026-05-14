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

export function logError(
  message: string,
  context: LogContext & { error?: unknown } = {}
) {
  const { error, ...safeContext } = context;
  console.error(
    JSON.stringify({
      level: "error",
      message,
      context: safeContext,
      error: error ? serializeError(error) : undefined,
      timestamp: new Date().toISOString(),
    })
  );
}

export function logWarn(message: string, context: Record<string, unknown> = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      message,
      context,
      timestamp: new Date().toISOString(),
    })
  );
}
