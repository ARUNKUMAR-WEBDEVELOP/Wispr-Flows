import { useCallback } from 'react';
import voiceAgentService from '../services/voice-agent.service';

/**
 * Hook for managing voice agent transcription processing
 * Handles converting spoken text to LLM responses
 */
export const useVoiceAgent = () => {
  const processVoiceTranscript = useCallback(async (
    sessionId,
    transcript,
    onChunkReceived,
    onResponceComplete,
    onError
  ) => {
    try {
      await voiceAgentService.processTranscript(
        sessionId,
        transcript,
        (chunk, isFinal) => {
          if (onChunkReceived) {
            onChunkReceived(chunk, isFinal);
          }
        },
        (fullResponse) => {
          if (onResponceComplete) {
            onResponceComplete(fullResponse);
          }
        },
        (error) => {
          if (onError) {
            onError(error);
          }
        }
      );
    } catch (error) {
      console.error('[useVoiceAgent] Error processing transcript:', error);
      if (onError) {
        onError(error);
      }
    }
  }, []);

  return {
    processVoiceTranscript
  };
};
