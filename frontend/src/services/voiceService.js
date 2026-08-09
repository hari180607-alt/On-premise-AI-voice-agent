import api from './api';

export const voiceService = {
  // Transcribe microphone audio recording via local Whisper STT
  async transcribeAudio(audioBlob, filename = 'recording.webm') {
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    const response = await api.post('/voice/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    return response.data;
  },

  // Synthesize text response to audio WAV stream via local TTS
  async synthesizeSpeech(text) {
    const response = await api.post('/voice/synthesize', { text }, {
      responseType: 'blob',
      timeout: 30000,
    });
    return response.data;
  },
};
