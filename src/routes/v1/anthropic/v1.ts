import { Hono } from "hono";

import type { Context } from "../../../types/hono.js";
import messagesRouter from "./v1/messages.js";
import modelsRouter from "./v1/models.js";

const anthropicV1Router = new Hono<Context>();

anthropicV1Router.route("/messages", messagesRouter);
anthropicV1Router.route("/models", modelsRouter);

export default anthropicV1Router;
