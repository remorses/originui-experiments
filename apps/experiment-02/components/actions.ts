"use server";
import fs from "fs";
import { openai, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import {
  appendResponseMessages,
  Message,
  UIMessage,
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
      model: openai.responses("o4-mini"),
      messages,
      maxSteps: 100,
      experimental_providerMetadata: {
        openai: {
          reasoningSummary: "detailed",
        } satisfies OpenAIResponsesProviderOptions,
      },
      tools: {
        getWeather: tool({
          description: "Get current weather information for a location",
          parameters: z.object({
            location: z
              .string()
              .describe("The city and state/country to get weather for"),
          }),
          execute: async ({ location }) => {
            // Mock weather data - in a real app you'd call a weather API
            const weatherData = {
              location,
              temperature: Math.floor(Math.random() * 30) + 10,
              condition: ["sunny", "cloudy", "rainy", "snowy"][
                Math.floor(Math.random() * 4)
              ],
              humidity: Math.floor(Math.random() * 50) + 30,
            };
            return `Weather in ${location}: ${weatherData.temperature}°C, ${weatherData.condition}, ${weatherData.humidity}% humidity`;
          },
        }),
      },
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
        part.request = null as any;
      }
      if ("response" in part) {
        part.response = null as any;
      }
      console.log(part);
      yield part;
    }
  }
  return generator();
}
