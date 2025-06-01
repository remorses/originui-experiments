import {
  FinishReason,
  JSONValue,
  LanguageModelUsage,
  TextStreamPart,
  ToolInvocation,
  ToolSet,
  UIMessage,
} from "ai";

import { parsePartialJson } from "@ai-sdk/ui-utils";
import { UseChatOptions } from "ai/react";

type UiMessagePart = UIMessage["parts"][number];

type TextUIPart = Extract<UiMessagePart, { type: "text" }>;
type ReasoningUIPart = Extract<UiMessagePart, { type: "reasoning" }>;
type ToolInvocationUIPart = Extract<UiMessagePart, { type: "tool-invocation" }>;

export async function* fullStreamToUIMessages<
  TOOLS extends ToolSet,
  T extends TextStreamPart<TOOLS>,
>({
  fullStream,
  messages,
  onToolCall,
  generateId,
  getCurrentDate = () => new Date(),
}: {
  fullStream: AsyncIterable<T>;
  messages: UIMessage[];
  onToolCall?: UseChatOptions["onToolCall"];
  generateId: () => string;
  getCurrentDate?: () => Date;
}) {
  const lastMessage = messages[messages.length - 1];
  const replaceLastMessage = lastMessage?.role === "assistant";
  let step = replaceLastMessage
    ? 1 +
      // find max step in existing tool invocations:
      (lastMessage.toolInvocations?.reduce((max, toolInvocation) => {
        return Math.max(max, toolInvocation.step ?? 0);
      }, 0) ?? 0)
    : 0;

  const message: UIMessage = replaceLastMessage
    ? structuredClone(lastMessage)
    : {
        id: generateId(),
        createdAt: getCurrentDate(),
        role: "assistant",
        content: "",
        parts: [],
      };

  let currentMessages = [...messages];
  if (!replaceLastMessage) {
    currentMessages.push(message);
  } else {
    currentMessages[currentMessages.length - 1] = message;
  }

  let currentTextPart: TextUIPart | undefined = undefined;
  let currentReasoningPart: ReasoningUIPart | undefined = undefined;
  let currentReasoningTextDetail:
    | { type: "text"; text: string; signature?: string }
    | undefined = undefined;

  function updateToolInvocationPart(
    toolCallId: string,
    invocation: ToolInvocation,
  ) {
    const part = message.parts.find(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.toolCallId === toolCallId,
    ) as ToolInvocationUIPart | undefined;

    if (part != null) {
      part.toolInvocation = invocation;
    } else {
      message.parts.push({
        type: "tool-invocation",
        toolInvocation: invocation,
      });
    }
  }

  const data: JSONValue[] = [];

  // keep list of current message annotations for message
  let messageAnnotations: JSONValue[] | undefined = replaceLastMessage
    ? lastMessage?.annotations
    : undefined;

  // keep track of partial tool calls
  const partialToolCalls: Record<
    string,
    { text: string; step: number; index: number; toolName: string }
  > = {};

  let usage: LanguageModelUsage = {
    completionTokens: NaN,
    promptTokens: NaN,
    totalTokens: NaN,
  };

  function execUpdate() {
    // keeps the currentMessage up to date with the latest annotations,
    // even if annotations preceded the message creation
    if (messageAnnotations?.length) {
      message.annotations = messageAnnotations;
    }

    const copiedMessage = {
      // deep copy the message to ensure that deep changes (msg attachments) are updated
      ...structuredClone(message),
      // add a revision id to ensure that the message is updated
      revisionId: generateId(),
    } as UIMessage;

    // Update the current messages array
    currentMessages[currentMessages.length - 1] = copiedMessage;
    
    return [...currentMessages];
  }
  // implementation note: this slightly more complex algorithm is required
  // to pass the tests in the edge environment.

  let finishReason: FinishReason;
  for await (const value of fullStream) {
    const type = value.type;
    switch (type) {
      case "text-delta": {
        if (currentTextPart == null) {
          currentTextPart = {
            type: "text",
            text: value.textDelta,
          };
          message.parts.push(currentTextPart);
        } else {
          currentTextPart.text += value.textDelta;
        }

        message.content += value.textDelta;
        yield execUpdate();
        break;
      }
      case "reasoning": {
        if (currentReasoningTextDetail == null) {
          currentReasoningTextDetail = { type: "text", text: value.textDelta };
          if (currentReasoningPart != null) {
            currentReasoningPart.details.push(currentReasoningTextDetail);
          }
        } else {
          currentReasoningTextDetail.text += value;
        }

        if (currentReasoningPart == null) {
          currentReasoningPart = {
            type: "reasoning",
            reasoning: value.textDelta,
            details: [currentReasoningTextDetail],
          };
          message.parts.push(currentReasoningPart);
        } else {
          currentReasoningPart.reasoning += value;
        }

        message.reasoning = (message.reasoning ?? "") + value.textDelta;

        yield execUpdate();
        break;
      }
      case "reasoning-signature": {
        if (currentReasoningTextDetail != null) {
          currentReasoningTextDetail.signature = value.signature;
        }
        break;
      }
      case "redacted-reasoning": {
        if (currentReasoningPart == null) {
          currentReasoningPart = {
            type: "reasoning",
            reasoning: "",
            details: [],
          };
          message.parts.push(currentReasoningPart);
        }

        currentReasoningPart.details.push({
          type: "redacted",
          data: value.data,
        });

        currentReasoningTextDetail = undefined;

        yield execUpdate();
        break;
      }
      case "file": {
        message.parts.push({
          type: "file",
          mimeType: value.mimeType,
          data: value.base64,
        });

        yield execUpdate();
        break;
      }
      case "source": {
        message.parts.push({
          type: "source",
          source: value.source,
        });

        yield execUpdate();
        break;
      }
      // case "data": {
      //   data.push(...value);
      //   execUpdate();
      //   break;
      // }
      case "error": {
        const err = value?.error as any;
        throw new Error(err?.message || err);
        break;
      }
      // case "message_annotations": {
      //   if (messageAnnotations == null) {
      //     messageAnnotations = [...value];
      //   } else {
      //     messageAnnotations.push(...value);
      //   }

      //   execUpdate();
      //   break;
      // }
      case "tool-call-streaming-start": {
        if (message.toolInvocations == null) {
          message.toolInvocations = [];
        }

        // add the partial tool call to the map
        partialToolCalls[value.toolCallId] = {
          text: "",
          step,
          toolName: value.toolName,
          index: message.toolInvocations.length,
        };

        const invocation = {
          state: "partial-call",
          step,
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          args: undefined,
        } as const;

        message.toolInvocations.push(invocation);

        updateToolInvocationPart(value.toolCallId, invocation);

        yield execUpdate();
        break;
      }
      case "tool-call-delta": {
        const partialToolCall = partialToolCalls[value.toolCallId];
        if (!partialToolCall) {
          throw new Error(`missing partialToolCall for ${value.toolCallId}`);
        }

        partialToolCall.text += value.argsTextDelta;

        const { value: partialArgs } = parsePartialJson(partialToolCall.text);

        const invocationDelta = {
          state: "partial-call",
          step: partialToolCall.step,
          toolCallId: value.toolCallId,
          toolName: partialToolCall.toolName,
          args: partialArgs,
        } as const;

        message.toolInvocations![partialToolCall.index] = invocationDelta;

        updateToolInvocationPart(value.toolCallId, invocationDelta);

        yield execUpdate();
        break;
      }
      case "tool-call": {
        const invocationCall: ToolInvocation = {
          state: "call",
          step,
          ...value,
        } as const;

        if (partialToolCalls[value.toolCallId] != null) {
          // change the partial tool call to a full tool call
          message.toolInvocations![partialToolCalls[value.toolCallId]?.index!] =
            invocationCall;
        } else {
          if (message.toolInvocations == null) {
            message.toolInvocations = [];
          }

          message.toolInvocations.push(invocationCall);
        }

        updateToolInvocationPart(value.toolCallId, invocationCall);

        yield execUpdate();

        // invoke the onToolCall callback if it exists. This is blocking.
        // In the future we should make this non-blocking, which
        // requires additional state management for error handling etc.
        if (onToolCall) {
          const result = await onToolCall({ toolCall: value });
          if (result != null) {
            const invocationResult: ToolInvocation = {
              state: "result",
              step,
              ...value,
              result,
            } as const;

            // store the result in the tool invocation
            message.toolInvocations![message.toolInvocations!.length - 1] =
              invocationResult;

            updateToolInvocationPart(value.toolCallId, invocationResult);

            yield execUpdate();
          }
        }
        break;
      }
      case "tool-result": {
        const toolInvocations = message.toolInvocations;

        if (toolInvocations == null) {
          throw new Error("tool_result must be preceded by a tool_call");
        }

        // find if there is any tool invocation with the same toolCallId
        // and replace it with the result
        const toolInvocationIndex = toolInvocations.findIndex(
          (invocation) => invocation.toolCallId === value.toolCallId,
        );

        if (toolInvocationIndex === -1) {
          throw new Error(
            "tool_result must be preceded by a tool_call with the same toolCallId",
          );
        }

        const invocationWithResult: ToolInvocation = {
          ...toolInvocations[toolInvocationIndex],
          state: "result" as const,
          ...value,
        } as const;

        toolInvocations[toolInvocationIndex] = invocationWithResult;

        updateToolInvocationPart(value.toolCallId, invocationWithResult);

        yield execUpdate();
        break;
      }
      case "finish": {
        finishReason = value.finishReason;
        if (value.usage != null) {
          usage = value.usage;
        }
        break;
      }
      case "step-finish": {
        step += 1;

        // reset the current text and reasoning parts
        currentTextPart = value.isContinued ? currentTextPart : undefined;
        currentReasoningPart = undefined;
        currentReasoningTextDetail = undefined;
        break;
      }
      case "step-start": {
        // keep message id stable when we are updating an existing message:
        if (!replaceLastMessage) {
          message.id = value.messageId;
        }

        // add a step boundary part to the message
        message.parts.push({ type: "step-start" });
        yield execUpdate();
        break;
      }
      default: {
        const exhaustiveCheck: never = type;
        throw new Error(`Unknown stream part type: ${exhaustiveCheck}`);
      }
    }
  }
}
