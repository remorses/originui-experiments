"use client";
import { useRef, useEffect } from "react";
import { useChatState } from "./state";

export function ScrollToEndOnLoad() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesLen = useChatState((x) => x.messages?.length);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messagesLen]);
  return <div ref={messagesEndRef} aria-hidden="true" />;
}
