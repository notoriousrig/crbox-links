import { createContext, useContext } from "react";

export interface UiLockState {
  locked: boolean;
  setLocked: (v: boolean) => void;
}

export const UiLockContext = createContext<UiLockState>({
  locked: false,
  setLocked: () => {},
});

export const useUiLock = () => useContext(UiLockContext);
