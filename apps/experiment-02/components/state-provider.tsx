import { createStore } from "zustand";
import { State, useChatState } from "./state";
import { createContext } from "react";
const zustandContext = createContext(useChatState);

export function StateProvider({
  value,
  children,
}: {
  value: State;
  children: React.ReactNode;
}) {
  let state = useChatState || createStore<State>(() => value);
  return (
    <zustandContext.Provider value={state}>{children}</zustandContext.Provider>
  );
}
