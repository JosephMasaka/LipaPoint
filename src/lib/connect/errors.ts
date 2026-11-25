/**
 * Error type for Connect. `status` is what src/lib/api-guards.ts `routeError`
 * maps to an HTTP status, and `code` is a stable machine string the UI can
 * branch on without parsing prose.
 */
export class ConnectError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status = 400, code = "CONNECT_ERROR") {
    super(message);
    this.name = "ConnectError";
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code = "CONNECT_INVALID_INPUT"): ConnectError {
  return new ConnectError(message, 400, code);
}

export function notFound(message = "Connection not found"): ConnectError {
  return new ConnectError(message, 404, "CONNECT_NOT_FOUND");
}

export function forbidden(message: string, code = "CONNECT_FORBIDDEN"): ConnectError {
  return new ConnectError(message, 403, code);
}

export function conflict(message: string, code = "CONNECT_CONFLICT"): ConnectError {
  return new ConnectError(message, 409, code);
}

/**
 * Removes credential-looking values from text that will be persisted or
 * shown (provider bodies, fetch errors). Connector code never prints a
 * decrypted secret, but a provider may echo one back in an error body.
 */
const SECRET_KEYS = /("?(?:authorization|api[_-]?key|token|secret|password|access[_-]?token|refresh[_-]?token)"?\s*[:=]\s*"?)([^",}\s]+)/gi;

export function redact(text: string, extraSecrets: string[] = []): string {
  let safe = text.replace(SECRET_KEYS, "$1[redacted]");
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 4) {
      safe = safe.split(secret).join("[redacted]");
    }
  }
  // Cap what goes into an error column: a 2 MB HTML error page is not useful.
  return safe.length > 1000 ? `${safe.slice(0, 1000)}…` : safe;
}
