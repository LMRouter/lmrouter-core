// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { createHash, randomBytes } from "crypto";

export const generateApiKey = () => {
  return "sk-lmr-" + randomBytes(32).toString("base64url");
};

export const hashApiKey = (apiKey: string) => {
  return createHash("sha256").update(apiKey).digest("hex");
};

export const getApiKeyPrefix = (apiKey: string) => {
  return apiKey.slice(0, 15);
};
