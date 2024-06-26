// services/audioService.ts
import Highlight from "@highlight-ai/app-runtime";
import { HighlightContext } from "@highlight-ai/app-runtime";
import api from "@highlight-ai/app-runtime";

export const fetchTranscript = async (): Promise<string | null> => {
  let transcript = await Highlight.user.getAudio(false);
  return transcript;
};

export const fetchMicActivity = async (): Promise<number> => {
  return await Highlight.user.getMicActivity(300);
};

export const setAsrRealtime = async (isRealtime: boolean): Promise<void> => {
  Highlight.user.setAsrRealtime(isRealtime);
};

export const setTranscriptionCallback = (callback: (text: string, startTime: number, endTime: number) => void) => {
  try {
    Highlight.user.setTranscriptionCallback(callback);
  } catch (error) {
    console.error("Failed to set transcription callback:", error);
  }
};

export const setSegmentStatusCallback = (callback: (current: number, total: number) => void) => {
  try {
    console.log("Setting segment status callback");

    api.addEventListener("onContext", (context: HighlightContext) => {
      const focusedAppTitle = context.application.focusedWindow.title;
      console.log("Context update:", context);
    });

    api.addEventListener("segmentStatusUpdate", (event) => {
      console.log("Segment status update:", event);
      if (event && typeof event.current === 'number' && typeof event.total === 'number') {
        callback(event.current, event.total);
      }
    });
  } catch (error) {
    console.error("Failed to set segment status callback:", error);
  }
};