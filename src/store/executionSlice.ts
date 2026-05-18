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
    // Set active execution (when user starts a batch)
    setActiveExecution: (state, action: PayloadAction<string>) => {
      state.activeExecutionId = action.payload;
      state.isPolling = true;
    },

    // Update status data from polling
    setStatusData: (state, action: PayloadAction<any>) => {
      state.statusData = action.payload;
    },

    // Update batch rows list
    setBatchRows: (state, action: PayloadAction<any[]>) => {
      state.batchRows = Array.isArray(action.payload) ? action.payload : [];
    },

    // Update polling state
    setIsPolling: (state, action: PayloadAction<boolean>) => {
      state.isPolling = action.payload;
    },

    // Clear active execution (when polling stops)
    clearActiveExecution: (state) => {
      state.activeExecutionId = null;
      state.statusData = null;
      state.isPolling = false;
    },

    // Batch modal actions
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

    // Summary modal actions
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

    // Restore from localStorage on app boot
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
