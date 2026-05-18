import { createTRPCReact } from "@trpc/react-query";
import type { AppOpsRouter } from "../../../api-server/src/routes/ops/routers";

export const trpc = createTRPCReact<AppOpsRouter>();
