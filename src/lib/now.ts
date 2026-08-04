import "server-only";
import { cache } from "react";

/**
 * The current instant, pinned for the whole request.
 *
 * Reading the clock during render is impure, and not only as a lint concern:
 * a page that calls Date.now() in the layout and again in the body can land on
 * either side of a boundary, so the same response can show a trial as live in
 * the sidebar and expired below it. cache() gives every caller in one request
 * the same instant, which is also the only reading of "has this trial ended"
 * that a merchant can act on.
 *
 * Server only — a client component cannot share the request's clock and should
 * read time in an effect instead.
 */
export const requestNow = cache(() => Date.now());
