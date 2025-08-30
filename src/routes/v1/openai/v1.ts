// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";

import type { ContextEnv } from "../../../types/hono.js";
import audioRouter from "./v1/audio.js";
import chatRouter from "./v1/chat.js";
import embeddingsRouter from "./v1/embeddings.js";
import imagesRouter from "./v1/images.js";
import modelsRouter from "./v1/models.js";
import responsesRouter from "./v1/responses.js";

const openaiV1Router = new Hono<ContextEnv>();

openaiV1Router.route("/audio", audioRouter);
openaiV1Router.route("/chat", chatRouter);
openaiV1Router.route("/embeddings", embeddingsRouter);
openaiV1Router.route("/images", imagesRouter);
openaiV1Router.route("/models", modelsRouter);
openaiV1Router.route("/responses", responsesRouter);

export default openaiV1Router;
