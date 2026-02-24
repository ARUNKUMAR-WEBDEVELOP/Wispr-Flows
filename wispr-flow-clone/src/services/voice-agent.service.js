/**
 * Voice Agent Service
 * Handles communication with backend voice agent API
 * Manages conversation sessions, transcripts, and LLM responses
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

const voiceAgentService = {
  /**
   * Create a new chat session
   */
  createSession: async () => {
    try {
      const response = await axios.post(`${API_BASE}/chat/session/create/`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('[VoiceAgent] Failed to create session:', error);
      throw error;
    }
  },

  /**
   * Get conversation history for user
   */
  getChatHistory: async () => {
    try {
      const response = await axios.get(`${API_BASE}/chat/history/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      return response.data.sessions || [];
    } catch (error) {
      console.error('[VoiceAgent] Failed to get history:', error);
      throw error;
    }
  },

  /**
   * Get messages for a specific session
   */
  getSessionMessages: async (sessionId) => {
    try {
      const response = await axios.get(`${API_BASE}/chat/session/${sessionId}/messages/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('[VoiceAgent] Failed to get session messages:', error);
      throw error;
    }
  },

  /**
   * Process voice transcript and stream LLM response
   * 
   * @param {number} sessionId - Chat session ID
   * @param {string} transcript - User's spoken text
   * @param {function} onChunk - Callback for each response chunk
   * @param {function} onComplete - Callback when response is complete
   * @param {function} onError - Callback for errors
   */
  processTranscript: async (sessionId, transcript, onChunk, onComplete, onError) => {
    try {
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(
        `${API_BASE}/chat/session/${sessionId}/transcript/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            transcript: transcript,
            is_final: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'llm_chunk') {
                const text = data.text || '';
                fullResponse += text;
                
                if (onChunk) {
                  onChunk(text, data.is_final);
                }
                
                if (data.is_final && onComplete) {
                  onComplete(fullResponse);
                }
              }
            } catch (e) {
              console.error('[VoiceAgent] Failed to parse chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('[VoiceAgent] Transcript processing error:', error);
      if (onError) {
        onError(error);
      }
      throw error;
    }
  },

  /**
   * Delete a chat session
   */
  deleteSession: async (sessionId) => {
    try {
      await axios.delete(`${API_BASE}/chat/session/${sessionId}/delete/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
    } catch (error) {
      console.error('[VoiceAgent] Failed to delete session:', error);
      throw error;
    }
  }
};

export default voiceAgentService;
