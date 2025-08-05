import { Hono } from "hono";

import anthropicV1Router from "./anthropic/v1.js";
import type { Context } from "../../types/hono.js";

const anthropicRouter = new Hono<Context>();

anthropicRouter.route("/v1", anthropicV1Router);

export default anthropicRouter;
