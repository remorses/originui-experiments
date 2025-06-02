"use client";
import { UIMessage } from "ai";
import { ExtractState, StoreApi, useStore } from "zustand";

export const chatState: { current: StoreApi<State> | null } = { current: null };

export function useChatState<U>(
  selector: (state: ExtractState<StoreApi<State>>) => U,
) {
  if (!chatState.current) {
    throw new Error(
      `chatState.current is undefined, call it under the state provider`,
    );
  }
  return useStore<StoreApi<State>, U>(chatState.current, selector);
}

export type State = {
  messages: UIMessage[];
};
