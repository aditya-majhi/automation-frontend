import { configureStore } from "@reduxjs/toolkit";
import executionReducer from "./executionSlice";

export const store = configureStore({
  reducer: {
    execution: executionReducer,
  },
});

// Persist execution state to localStorage whenever it changes
store.subscribe(() => {
  const state = store.getState();
  localStorage.setItem("executionState", JSON.stringify(state.execution));
});

// Restore execution state from localStorage on app init
const savedExecutionState = localStorage.getItem("executionState");
if (savedExecutionState) {
  try {
    const parsed = JSON.parse(savedExecutionState);
    store.dispatch({
      type: "execution/restoreFromStorage",
      payload: parsed,
    });
  } catch (e) {
    console.error("Failed to restore execution state from localStorage", e);
  }
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
