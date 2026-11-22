import { Hono } from "hono";

/**
 * Enterprise routers are mounted onto the API app. Bun's isolated install can
 * load a second copy of Hono, and Hono only forwards a sub-app's errors when
 * that sub-app still uses the parent's default error handler. Rethrow so the
 * API onError can map AppError and missing rows to their status codes.
 */
export function enterpriseRouter() {
	const app = new Hono();
	app.onError((err) => {
		throw err;
	});
	return app;
}
