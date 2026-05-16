import { z } from "zod";
import { publicProcedure, router } from "../trpc";

type Item = { id: number; name: string };
const items: Item[] = [];
let nextId = 1;

export const itemsRouter = router({
  list: publicProcedure.query(() => items),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      const item = items.find((i) => i.id === input.id);
      if (!item) throw new Error("not found");
      return item;
    }),

  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(({ input }) => {
      const item = { id: nextId++, name: input.name };
      items.push(item);
      return item;
    }),
});
