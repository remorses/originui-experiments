"use client";
import { UIMessage } from "ai";
import { StoreApi, Mutate } from "zustand";

export let useChatState: StoreApi<State>;

export type State = {
  messages: UIMessage[];
};
