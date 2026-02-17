import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "../docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    category: z.string(),
  }),
});

export const collections = { docs };
