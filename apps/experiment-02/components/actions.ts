"use server";
import fs from "fs";
import { openai } from "@ai-sdk/openai";
import {
  appendResponseMessages,
  Message,
  streamText,
  tool,
  type CoreMessage,
} from "ai";
import { z } from "zod";
import { Evt } from "evt";
import path from "path";
const CHAT_FILE = "chat-messages.json";

function saveChat(messages: Message[]): void {
  try {
    const filePath = path.join(process.cwd(), CHAT_FILE);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing chat file:", error);
  }
}

export async function generateMessage({ messages }: { messages: Message[] }) {
  console.log(`generation`);

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  async function* generator() {
    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages,
      async onFinish({ response }) {
        await saveChat(
          appendResponseMessages({
            messages,
            responseMessages: response.messages,
          }),
        );
      },
      // tools: {
      //   some: tool({
      //     description: "A sample tool",
      //     parameters: z.object({ hello: z.string() }),

      //     execute: async (args, {}) => {
      //       args.hello;
      //       return "Tool executed";
      //     },
      //   }),
      // },
    });

    for await (const part of result.fullStream) {
      if ("request" in part) {
        delete (part as any)["request"];
      }
      if ("response" in part) {
        delete (part as any)["response"];
      }
      console.log(part);
      yield part;
    }
  }
  return generator();
}
