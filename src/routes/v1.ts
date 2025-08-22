// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";

import anthropicRouter from "./v1/anthropic.js";
import authRouter from "./v1/auth.js";
import openaiRouter from "./v1/openai.js";
import type { ContextEnv } from "../types/hono.js";

const v1Router = new Hono<ContextEnv>();

v1Router.route("/anthropic", anthropicRouter);
v1Router.route("/auth", authRouter);
v1Router.route("/openai", openaiRouter);

export default v1Router;
