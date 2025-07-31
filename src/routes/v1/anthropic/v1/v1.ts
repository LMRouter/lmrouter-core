import { Router } from "express";

import { createMessage } from "../../../../controllers/v1/anthropic/v1/messages.js";
import {
  getModel,
  listModels,
} from "../../../../controllers/v1/anthropic/v1/models.js";
import { auth } from "../../../../middlewares/auth.js";

const anthropicV1Router = Router();

anthropicV1Router.get("/models", listModels);
anthropicV1Router.get("/models/*model", getModel);

anthropicV1Router.post("/messages", auth, createMessage);

export default anthropicV1Router;
