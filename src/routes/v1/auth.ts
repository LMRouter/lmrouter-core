import { Hono } from "hono";

import type { ContextEnv } from "../../types/hono.js";
import { getAuth } from "../../utils/auth.js";
import { getConfig } from "../../utils/config.js";

const authRouter = new Hono<ContextEnv>();

authRouter.on(["GET", "POST"], "/**", (c) => {
  const cfg = getConfig(c);
  if (!cfg.auth.enabled) {
    return c.json(
      {
        error: {
          message: "Auth is not enabled",
        },
      },
      400,
    );
  }
  return getAuth(c).handler(c.req.raw);
});

export default authRouter;
