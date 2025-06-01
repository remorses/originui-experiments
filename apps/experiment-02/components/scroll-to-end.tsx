"use client"
import { useRef, useEffect } from "react";

export function ScrollToEndOnLoad() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, []);
  return <div ref={messagesEndRef} aria-hidden="true" />;
}
