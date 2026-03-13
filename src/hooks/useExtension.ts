import { useState, useEffect, useCallback } from "react";

const EXTENSION_ID = "hoeajgldipmhbjhkppdhfnipbbdcenaf"; // replace with real ID

type ExtensionStatus = "checking" | "installed" | "not_installed";

interface RecordingState {
    isRecording: boolean;
    stepCount: number;
}

export const useExtension = () => {
    const [status, setStatus] = useState<ExtensionStatus>("checking");
    const [recordingState, setRecordingState] = useState<RecordingState>({
        isRecording: false,
        stepCount: 0,
    });

    const checkExtension = useCallback(() => {
        if (!window.chrome?.runtime) {
            setStatus("not_installed");
            return;
        }

        chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: "PING" },
            (response) => {
                if (chrome.runtime.lastError || !response?.installed) {
                    setStatus("not_installed");
                } else {
                    setStatus("installed");
                }
            },
        );
    }, []);

    const getRecordingState = useCallback(async (): Promise<RecordingState> => {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                EXTENSION_ID,
                { action: "GET_RECORDING_STATE" },
                (response) => {
                    if (chrome.runtime.lastError || !response?.success) {
                        resolve({ isRecording: false, stepCount: 0 });
                    } else {
                        resolve({
                            isRecording: response.isRecording,
                            stepCount: response.stepCount,
                        });
                    }
                },
            );
        });
    }, []);

    const startRecording = useCallback(
        (
            url: string,
            testCaseId: string,
        ): Promise<{ success: boolean; error?: string }> => {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    EXTENSION_ID,
                    { action: "START_RECORDING", url, testCaseId },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({
                                success: false,
                                error: chrome.runtime.lastError.message,
                            });
                        } else {
                            if (response?.success) {
                                setRecordingState({ isRecording: true, stepCount: 0 });
                            }
                            resolve(response);
                        }
                    },
                );
            });
        },
        [],
    );

    const stopRecording = useCallback(
        (
            testCaseId: string,
        ): Promise<{ success: boolean; error?: string; recording?: unknown }> => {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    EXTENSION_ID,
                    { action: "STOP_RECORDING", testCaseId },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({
                                success: false,
                                error: chrome.runtime.lastError.message,
                            });
                        } else {
                            setRecordingState({ isRecording: false, stepCount: 0 });
                            resolve(response);
                        }
                    },
                );
            });
        },
        [],
    );

    // NEW: push JWT into the extension so it can call the backend without 401
    const setToken = useCallback((token: string | null) => {
        if (!token) return;
        if (!window.chrome?.runtime) return;

        console.log({ token });


        chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: "SET_TOKEN", token },
            () => {
                // ignore errors if extension not installed
            },
        );
    }, []);

    useEffect(() => {
        checkExtension();
    }, [checkExtension]);

    useEffect(() => {
        if (!recordingState.isRecording) return;

        const interval = setInterval(async () => {
            const state = await getRecordingState();
            setRecordingState(state);
        }, 2000);

        return () => clearInterval(interval);
    }, [recordingState.isRecording, getRecordingState]);

    return {
        status,
        recordingState,
        startRecording,
        stopRecording,
        checkExtension,
        setToken,
    };
};