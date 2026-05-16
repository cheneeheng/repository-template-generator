import { router } from "../trpc";
import { itemsRouter } from "./items";

export const appRouter = router({
  items: itemsRouter,
});

export type AppRouter = typeof appRouter;
