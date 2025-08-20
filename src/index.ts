// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { serve } from "@hono/node-server";

import app from "./app.js";
import { getConfig } from "./utils/config.js";

const main = () => {
  const config = getConfig();
  serve(
    {
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
    },
    (info) => {
      console.log(
        `LMRouter listening on http://${info.family === "IPv4" ? info.address : `[${info.address}]`}:${info.port}/`,
      );
    },
  );
};

main();
