type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

/**
 * Structured JSON logger for API calls, DB mutations, and errors.
 *
 * @param level - Log level: "info", "warn", or "error"
 * @param message - Human-readable message describing the event
 * @param context - Optional key-value pairs for additional context
 *
 * @example
 * log("info", "Post created", { postId: "abc123" });
 * log("error", "Failed to create post", { error: err.message, userId: "123" });
 */
export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}
