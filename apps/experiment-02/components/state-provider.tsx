import { createStore } from "zustand";
import { chatState, State, useChatState } from "./state";
import { createContext } from "react";
const zustandContext = createContext(useChatState);

export function StateProvider({
  value,
  children,
}: {
  value: State;
  children: React.ReactNode;
}) {
  if (!chatState.current) chatState.current = createStore<State>(() => value);
  return (
    <zustandContext.Provider value={useChatState}>
      {children}
    </zustandContext.Provider>
  );
}
