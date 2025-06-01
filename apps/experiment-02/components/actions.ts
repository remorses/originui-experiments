"use server";

import { openai } from "@ai-sdk/openai";
import { streamText, tool, type CoreMessage } from "ai";
import { z } from "zod";
import { Evt } from "evt";

export async function generateMessage({
  messages,
}: {
  messages: CoreMessage[];
}) {
  console.log(`generation`);

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  async function* generator() {
    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages,
      tools: {
        some: tool({
          description: "A sample tool",
          parameters: z.object({ hello: z.string() }),

          execute: async (args, {}) => {
            args.hello;
            return "Tool executed";
          },
        }),
      },
    });

    result.toDataStreamResponse();

    for await (const textPart of result.fullStream) {
      yield textPart;
    }
  }
  return generator();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
