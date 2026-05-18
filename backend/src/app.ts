import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appOpsRouter } from "./routes/ops/routers";
import { createOpsContext } from "./routes/ops/context";
import { registerOpsWebAuthnRoutes } from "./routes/ops/webauthn";


const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use(
  "/api/ops/trpc",
  createExpressMiddleware({
    router: appOpsRouter,
    createContext: createOpsContext,
  })
);

registerOpsWebAuthnRoutes(app);

export default app;
