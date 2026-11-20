/** A failure whose message is meant for the admin (shown in the web app as-is). */
export class UserFacingError extends Error {}

/**
 * Thrown by an update handler that can't proceed yet but likely can shortly,
 * e.g. a reaction to a message whose own update hasn't been processed. The
 * queue consumer puts the update back on the queue with a delay, so the update
 * it's waiting for runs first (sleeping in the handler would block it).
 */
export class RetryLater extends Error {}
