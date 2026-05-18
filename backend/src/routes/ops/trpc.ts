import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { OpsContext } from "./context";

const t = initTRPC.context<OpsContext>().create({ transformer: superjson });

export const opsRouter = t.router;
export const publicOpsProcedure = t.procedure;
export const protectedOpsProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);
