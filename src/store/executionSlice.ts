import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ExecutionState {
  activeExecutionId: string | null;
  statusData: any;
  isPolling: boolean;
  batchRows: any[];
  isBatchModalOpen: boolean;
  activeBatchId: string | null;
  activeBatchStatus: any;
  isSummaryModalOpen: boolean;
  summaryModalTitle: string;
  summaryModalText: string;
}

const initialState: ExecutionState = {
  activeExecutionId: null,
  statusData: null,
  isPolling: false,
  batchRows: [],
  isBatchModalOpen: false,
  activeBatchId: null,
  activeBatchStatus: null,
  isSummaryModalOpen: false,
  summaryModalTitle: "",
  summaryModalText: "",
};

export const executionSlice = createSlice({
  name: "execution",
  initialState,
  reducers: {
    setActiveExecution: (state, action: PayloadAction<string>) => {
      state.activeExecutionId = action.payload;
      state.isPolling = true;
    },

    setStatusData: (state, action: PayloadAction<any>) => {
      state.statusData = action.payload;
    },

    setBatchRows: (state, action: PayloadAction<any[]>) => {
      state.batchRows = Array.isArray(action.payload) ? action.payload : [];
    },

    // Upsert single table row from /executions/:id status payload
    upsertBatchRow: (state, action: PayloadAction<any>) => {
      const incoming = action.payload;
      const incomingId = String(incoming?.executionId || "").trim();
      if (!incomingId) return;

      const idx = state.batchRows.findIndex(
        (r) => String(r?.executionId || "").trim() === incomingId,
      );

      if (idx >= 0) {
        state.batchRows[idx] = { ...state.batchRows[idx], ...incoming };
      } else {
        state.batchRows.unshift(incoming);
      }
    },

    setIsPolling: (state, action: PayloadAction<boolean>) => {
      state.isPolling = action.payload;
    },

    clearActiveExecution: (state) => {
      state.activeExecutionId = null;
      state.statusData = null;
      state.isPolling = false;
    },

    openBatchModal: (state, action: PayloadAction<string>) => {
      state.isBatchModalOpen = true;
      state.activeBatchId = action.payload;
    },

    closeBatchModal: (state) => {
      state.isBatchModalOpen = false;
      state.activeBatchId = null;
      state.activeBatchStatus = null;
    },

    setActiveBatchStatus: (state, action: PayloadAction<any>) => {
      const incoming = action.payload || {};
      const current = state.activeBatchStatus || {};
      const inTs = Date.parse(String(incoming?._capturedAt || "")) || 0;
      const curTs = Date.parse(String(current?._capturedAt || "")) || 0;

      if (!state.activeBatchStatus || inTs >= curTs) {
        state.activeBatchStatus = incoming;
      }
    },

    openSummaryModal: (
      state,
      action: PayloadAction<{ title: string; text: string }>,
    ) => {
      state.isSummaryModalOpen = true;
      state.summaryModalTitle = action.payload.title;
      state.summaryModalText = action.payload.text;
    },

    closeSummaryModal: (state) => {
      state.isSummaryModalOpen = false;
      state.summaryModalTitle = "";
      state.summaryModalText = "";
    },

    restoreFromStorage: (
      state,
      action: PayloadAction<Partial<ExecutionState>>,
    ) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setActiveExecution,
  setStatusData,
  setBatchRows,
  upsertBatchRow,
  setIsPolling,
  clearActiveExecution,
  openBatchModal,
  closeBatchModal,
  setActiveBatchStatus,
  openSummaryModal,
  closeSummaryModal,
  restoreFromStorage,
} = executionSlice.actions;

export default executionSlice.reducer;
