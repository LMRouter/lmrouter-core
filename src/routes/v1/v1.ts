import { Router } from "express";

import anthropicRouter from "./anthropic/anthropic.js";
import openaiRouter from "./openai/openai.js";

const v1Router = Router();

v1Router.use("/anthropic", anthropicRouter);
v1Router.use("/openai", openaiRouter);

export default v1Router;
