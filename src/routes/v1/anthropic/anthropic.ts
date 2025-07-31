import { Router } from "express";

import anthropicV1Router from "./v1/v1.js";

const anthropicRouter = Router();

anthropicRouter.use("/v1", anthropicV1Router);

export default anthropicRouter;
