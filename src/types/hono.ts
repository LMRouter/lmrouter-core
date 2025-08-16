// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { LMRouterCoreConfigModel } from "../utils/config.js";

export type ContextEnv = {
  Variables: {
    byok?: string;
    model?: LMRouterCoreConfigModel;
  };
};
