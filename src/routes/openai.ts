// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";

import openaiRouter from "./v1/openai.js";
import type { Context } from "../types/hono.js";

const rootOpenaiRouter = new Hono<Context>();

rootOpenaiRouter.route("/", openaiRouter);

export default rootOpenaiRouter;
