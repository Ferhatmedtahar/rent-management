/**
 * An error with an HTTP status, thrown by services and handlers and mapped to
 * `{ "error": message }` by `withErrorHandling`. The message reaches the client,
 * so keep it plain: never include SQL, stack traces or ids of other records.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
