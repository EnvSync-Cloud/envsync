import { Hono } from "hono";

import { AcmeController } from "../controllers/acme.controller";

const app = new Hono();

app.get("/:orgSlug/directory", AcmeController.directory);
app.on("HEAD", "/:orgSlug/new-nonce", AcmeController.newNonce);
app.get("/:orgSlug/new-nonce", AcmeController.newNonce);
app.post("/:orgSlug/new-account", AcmeController.newAccount);
app.post("/:orgSlug/new-order", AcmeController.newOrder);
app.post("/:orgSlug/order/:orderId/finalize", AcmeController.finalize);
app.get("/:orgSlug/order/:orderId/cert", AcmeController.certificate);

export { app as publicAcmeRouter };
