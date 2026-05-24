import { RawEndpoint, APIError } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";

// Lazy-load the Express app from the backend directory so that
// Encore can boot it inside its own runtime.  CommonJS require is
// used intentionally — the backend is plain CJS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const expressApp = require("../backend/app");

/**
 * Raw catch-all endpoint that delegates every request to the Express app.
 * Encore routes all HTTP traffic through this handler.
 */
export const catchAll = new RawEndpoint({
  expose: true,
  path: "/!rest",
  method: "*",
  handler: async (req: IncomingMessage, resp: ServerResponse) => {
    // expressApp is an Express Application, which is also a valid
    // Node.js (req, res, next) handler.
    await new Promise<void>((resolve, reject) => {
      expressApp(req, resp, (err: unknown) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      });
    });
  },
});
