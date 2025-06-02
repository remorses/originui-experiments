"use client";
import { Markdown } from "@/components/ui/markdown";
import { ChatMessage } from "@/components/chat-message";
import { SettingsPanelTrigger } from "@/components/settings-panel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RiAttachment2,
  RiCodeSSlashLine,
  RiLeafLine,
  RiMicLine,
  RiShareCircleLine,
  RiShareLine,
  RiShining2Line,
} from "@remixicon/react";
import { ScrollToEndOnLoad } from "./scroll-to-end";
import { Message, useChat } from "ai/react";
import { useState, useTransition } from "react";
import { createIdGenerator, UIMessage } from "ai";
import { chatStateContainer, useChatState } from "./state";
import { generateMessage } from "./actions";
import { fullStreamToUIMessages } from "./process-chat";

export default function Chat({}) {
  return (
    <ScrollArea className="grow  [&>div>div]:h-full flex-1 h-full flex flex-col w-full shadow-md md:rounded-s-[inherit] min-[1024px]:rounded-e-3xl bg-background">
      <div className="flex-1 flex flex-col h-full  px-4 md:px-5 ">
        {/* Header */}
        <div className="py-5 bg-background  sticky top-0 z-10 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-gradient-to-r before:from-black/[0.06] before:via-black/10 before:to-black/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <Breadcrumb>
              <BreadcrumbList className="sm:gap-1.5">
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Playground</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Chat</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex items-center gap-1 -my-2 -me-2">
              <Button variant="ghost" className="px-2">
                <RiCodeSSlashLine
                  className="text-muted-foreground sm:text-muted-foreground/70 size-5"
                  size={20}
                  aria-hidden="true"
                />
                <span className="max-sm:sr-only">Code</span>
              </Button>
              <Button variant="ghost" className="px-2">
                <RiShareLine
                  className="text-muted-foreground sm:text-muted-foreground/70 size-5"
                  size={20}
                  aria-hidden="true"
                />
                <span className="max-sm:sr-only">Share</span>
              </Button>
              <Button variant="ghost" className="px-2">
                <RiShareCircleLine
                  className="text-muted-foreground sm:text-muted-foreground/70 size-5"
                  size={20}
                  aria-hidden="true"
                />
                <span className="max-sm:sr-only">Export</span>
              </Button>
              <SettingsPanelTrigger />
            </div>
          </div>
        </div>
        {/* Chat */}
        <Messages />
        <Footer />
      </div>
    </ScrollArea>
  );
}

function Messages() {
  const messages = useChatState((x) => x?.messages);

  return (
    <div className="relative flex h-full flex-col grow">
      <div className="max-w-3xl w-full grow flex h-full flex-col mx-auto mt-6 space-y-6">
        <div className="text-center my-8">
          <div className="inline-flex items-center bg-white rounded-full border border-black/[0.08] shadow-xs text-xs font-medium py-1 px-3 text-foreground/80">
            <RiShining2Line
              className="me-1.5 text-muted-foreground/70 -ms-1"
              size={14}
              aria-hidden="true"
            />
            Today
          </div>
        </div>
        {messages.map((x) => {
          return <ChatMessage key={x.id} message={x} />;
        })}
        <ScrollToEndOnLoad />
      </div>
    </div>
  );
}

function Footer() {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const messages = useChatState((x) => x?.messages || []);

  const handleSubmit = () => {
    startTransition(async () => {
      console.log("Submitting:", text);

      // Create user message
      const userMessage: UIMessage = {
        id: Date.now().toString(),
        content: "",
        role: "user" as const,
        parts: [{ type: "text", text }],
      };

      // Call generateMessage with current messages plus user message
      const allMessages = [...messages, userMessage];
      chatStateContainer?.current?.setState({ messages: allMessages });
      const generator = await generateMessage({ messages: allMessages });
      const generateId = createIdGenerator();
      for await (let newMessages of fullStreamToUIMessages({
        fullStream: generator,
        messages: allMessages,
        generateId,
      })) {
        console.log(newMessages);
        chatStateContainer?.current?.setState({ messages: newMessages });
      }

      // Clear the input
      setText("");
    });
  };

  return (
    <div className="sticky bottom-0 pt-4 md:pt-8 z-50">
      <div className="max-w-3xl mx-auto bg-background rounded-[20px] pb-4 md:pb-8">
        <div className="relative rounded-[20px] border border-transparent bg-muted transition-colors focus-within:bg-muted/50 focus-within:border-input has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 [&:has(input:is(:disabled))_*]:pointer-events-none">
          <textarea
            className="flex sm:min-h-[84px] w-full bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none [resize:none]"
            placeholder="Ask me anything..."
            aria-label="Enter your prompt"
            value={text}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (!isPending && text.trim()) {
                  handleSubmit();
                }
              }
            }}
            onChange={(e) => setText(e.target.value)}
          />
          {/* Textarea buttons */}
          <div className="flex items-center justify-between gap-2 p-3">
            {/* Left buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]"
              >
                <RiAttachment2
                  className="text-muted-foreground/70 size-5"
                  size={20}
                  aria-hidden="true"
                />
                <span className="sr-only">Attach</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]"
              >
                <RiMicLine
                  className="text-muted-foreground/70 size-5"
                  size={20}
                  aria-hidden="true"
                />
                <span className="sr-only">Audio</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]"
              >
                <RiLeafLine
                  className="text-muted-foreground/70 size-5"
                  size={20}
                  aria-hidden="true"
                />
                <span className="sr-only">Action</span>
              </Button>
            </div>
            {/* Right buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                >
                  <g clipPath="url(#icon-a)">
                    <path
                      fill="url(#icon-b)"
                      d="m8 .333 2.667 5 5 2.667-5 2.667-2.667 5-2.667-5L.333 8l5-2.667L8 .333Z"
                    />
                    <path
                      stroke="#451A03"
                      strokeOpacity=".04"
                      d="m8 1.396 2.225 4.173.072.134.134.071L14.604 8l-4.173 2.226-.134.071-.072.134L8 14.604l-2.226-4.173-.071-.134-.134-.072L1.396 8l4.173-2.226.134-.071.071-.134L8 1.396Z"
                    />
                  </g>
                  <defs>
                    <linearGradient
                      id="icon-b"
                      x1="8"
                      x2="8"
                      y1=".333"
                      y2="15.667"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop stopColor="#FDE68A" />
                      <stop offset="1" stopColor="#F59E0B" />
                    </linearGradient>
                    <clipPath id="icon-a">
                      <path fill="#fff" d="M0 0h16v16H0z" />
                    </clipPath>
                  </defs>
                </svg>
                <span className="sr-only">Generate</span>
              </Button>
              <Button
                className="rounded-full h-8"
                onClick={handleSubmit}
                disabled={isPending || !text.trim()}
              >
                {isPending ? "Loading..." : "Ask Bart"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
