import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  codes: z.array(z.string().min(2).max(5)).min(1).max(4),
  days: z.number().int().min(14).max(200).optional(),
});

export const getPerformance = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { buildPerformance } = await import("./performance.server");
    try {
      return await buildPerformance(data.codes, data.days ?? 120);
    } catch (error) {
      return {
        matches: 0,
        markets: [],
        confidence: [],
        recent: [],
        goalsError: 0,
        error: (error as Error).message,
      };
    }
  });