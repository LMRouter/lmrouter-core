import { Hono } from "hono";

import anthropicRouter from "./v1/anthropic.js";
import openaiRouter from "./v1/openai.js";
import type { Context } from "../types/hono.js";

const v1Router = new Hono<Context>();

v1Router.route("/anthropic", anthropicRouter);
v1Router.route("/openai", openaiRouter);

export default v1Router;
