"use client";
import { createStore } from "zustand";
import { chatStateContainer, State, useChatState } from "./state";
import { createContext } from "react";
const zustandContext = createContext(useChatState);

export function StateProvider({
  value,
  children,
}: {
  value: State;
  children: React.ReactNode;
}) {
  if (!chatStateContainer.current) chatStateContainer.current = createStore<State>(() => value);
  return (
    <zustandContext.Provider value={useChatState}>
      {children}
    </zustandContext.Provider>
  );
}
