import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../services/chatService';
import { healthService } from '../services/healthService';
import { voiceService } from '../services/voiceService';
import {
  IoSend,
  IoHardwareChipOutline,
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircleSharp,
  IoAlertCircleSharp,
  IoTrashOutline,
  IoRefreshOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoTimeOutline,
  IoSparklesOutline,
  IoCloseCircleOutline,
  IoMicOutline,
  IoMicOffOutline,
  IoVolumeHighOutline,
} from 'react-icons/io5';

// Helper to generate unique conversation session id
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'sess-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
};

const INITIAL_MESSAGE = {
  id: 'init',
  sender: 'ai',
  text: "Hello! I'm your AI receptionist. How can I assist you with your appointment or customer inquiry today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  actionPerformed: false,
};

export default function AIReceptionistPage() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState(null);
  
  // Unique session ID
  const [conversationId, setConversationId] = useState(() => generateSessionId());
  
  // AI Engine Status States
  const [healthState, setHealthState] = useState('checking'); // 'checking' | 'healthy' | 'unhealthy'
  const [backendOnline, setBackendOnline] = useState(null);
  const [databaseConnected, setDatabaseConnected] = useState(null);
  const [aiOnline, setAiOnline] = useState(null);
  const [voiceReady, setVoiceReady] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [checkingLoading, setCheckingLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Voice Recording & Pipeline State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [voiceStage, setVoiceStage] = useState('idle'); // 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error'
  const [voiceStatusText, setVoiceStatusText] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const getSupportedMimeType = () => {
    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/wav"
    ];
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      const match = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (match) return match;
    }
    return "";
  };

  const startRecording = async () => {
    if (loading || recordingLoading) return;

    try {
      console.log('[VOICE] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      const selectedMime = getSupportedMimeType();
      console.log('[VOICE] Supported MIME type:', selectedMime || 'default browser MIME');

      const recorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log('[VOICE] Recording stopped.');
        setIsRecording(false);
        
        // Stop audio tracks
        try {
          stream.getTracks().forEach(track => track.stop());
        } catch (e) {
          // ignore
        }

        const mimeType = recorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('[VOICE] Blob type:', audioBlob.type, '| size:', audioBlob.size, 'bytes, chunks:', audioChunksRef.current.length);

        if (!audioBlob || audioBlob.size < 900) {
          console.warn('[VOICE] Empty or too short audio recording received:', audioBlob?.size, 'bytes.');
          setVoiceStage('error');
          setVoiceStatusText("❌ No speech detected. Please speak into your microphone.");
          setTimeout(() => { setVoiceStage('idle'); setVoiceStatusText(''); }, 4000);
          return;
        }

        await processVoiceRecording(audioBlob, mimeType);
      };

      // Pass timeslice 250ms to collect audio chunks continuously
      recorder.start(250);
      setIsRecording(true);
      setVoiceStage('recording');
      setVoiceStatusText("🎙️ Listening... (click to stop)");
      console.log('[VOICE] Recording started with 250ms timeslice');
    } catch (err) {
      console.error("[VOICE] Microphone access error:", err);
      setVoiceStage('error');
      setVoiceStatusText("❌ Microphone access denied or unsupported.");
      setErrorMsg("Microphone access is required for voice input.");
      setTimeout(() => { setVoiceStage('idle'); setVoiceStatusText(''); }, 4000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch (e) {
        console.warn('[VOICE] requestData failed:', e);
      }
      mediaRecorderRef.current.stop();
    }
  };

  const processVoiceRecording = async (audioBlob, mimeType) => {
    setRecordingLoading(true);
    setVoiceStage('transcribing');
    setVoiceStatusText("⏳ Transcribing...");
    console.log('[VOICE] Sending audio to Whisper...');

    let transcript = "";
    try {
      const filename = mimeType.includes("mp4") ? "recording.mp4" : mimeType.includes("ogg") ? "recording.ogg" : "recording.webm";
      const res = await voiceService.transcribeAudio(audioBlob, filename);
      transcript = res?.text?.trim() || "";
      console.log('[VOICE] Transcript:', `'${transcript}'`);
    } catch (err) {
      console.error('[VOICE] STT Transcription API error:', err);
      setVoiceStage('error');
      setVoiceStatusText("❌ Could not understand the audio.");
      setRecordingLoading(false);
      setTimeout(() => { setVoiceStage('idle'); setVoiceStatusText(''); }, 4000);
      return;
    }

    if (!transcript) {
      console.warn('[VOICE] Empty transcript received from Whisper.');
      setVoiceStage('error');
      setVoiceStatusText("❌ Could not understand the audio.");
      setRecordingLoading(false);
      setTimeout(() => { setVoiceStage('idle'); setVoiceStatusText(''); }, 4000);
      return;
    }

    // Auto-send transcript to chat API
    setVoiceStage('thinking');
    setVoiceStatusText("🤖 AI thinking...");
    console.log('[VOICE] Sending transcript to chat:', transcript);

    let aiTextResponse = "";
    let ttsPromise = null;

    try {
      const userMsgId = `user-${Date.now()}`;
      const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userMsg = {
        id: userMsgId,
        sender: 'user',
        text: transcript,
        timestamp: userTime,
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      const t0_chat = performance.now();
      const chatRes = await chatService.sendMessage(transcript, conversationId);
      const t1_chat = performance.now();
      aiTextResponse = chatRes?.response || "";
      console.log(`[VOICE] LLM response received in ${(t1_chat - t0_chat).toFixed(0)}ms:`, aiTextResponse);

      // PARALLEL TTS: Dispatch TTS request immediately when text arrives, before React render delays
      if (aiTextResponse) {
        console.log('[VOICE] Parallel TTS synthesis dispatched at T=0ms relative to LLM response');
        ttsPromise = voiceService.synthesizeSpeech(aiTextResponse);
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiTextResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPerformed: chatRes?.action_performed,
        intent: chatRes?.intent,
      };

      // Render text message in React UI immediately
      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
    } catch (err) {
      console.error('[VOICE] Chat API failure:', err);
      setVoiceStage('error');
      setVoiceStatusText("❌ AI response failed.");
      setLoading(false);
      setRecordingLoading(false);
      setTimeout(() => { setVoiceStage('idle'); setVoiceStatusText(''); }, 4000);
      return;
    } finally {
      setLoading(false);
    }

    // Await parallel TTS synthesis and play audio
    if (aiTextResponse && ttsPromise) {
      setVoiceStage('speaking');
      setVoiceStatusText("🔊 AI speaking...");

      try {
        const t0_render = performance.now();
        const audioBytes = await ttsPromise;
        const t1_audio = performance.now();
        console.log(`[VOICE] TTS audio ready in ${(t1_audio - t0_render).toFixed(0)}ms after text rendered`);

        if (audioBytes && audioBytes.size > 100) {
          const audioUrl = URL.createObjectURL(audioBytes);
          const audio = new Audio();
          audio.src = audioUrl;
          audio.preload = 'auto';

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setVoiceStage('idle');
            setVoiceStatusText('');
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setVoiceStage('idle');
            setVoiceStatusText('⚠️ Voice playback failed.');
            setTimeout(() => setVoiceStatusText(''), 3000);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              console.warn('[VOICE] Autoplay error:', e);
              setVoiceStage('idle');
              setVoiceStatusText('⚠️ Click play to hear response.');
              setTimeout(() => setVoiceStatusText(''), 3000);
            });
          }
        } else {
          setVoiceStage('idle');
          setVoiceStatusText('⚠️ AI text response received, but voice playback failed.');
          setTimeout(() => setVoiceStatusText(''), 4000);
        }
      } catch (err) {
        console.error('[VOICE] TTS API error:', err);
        setVoiceStage('idle');
        setVoiceStatusText('⚠️ AI text response received, but voice playback failed.');
        setTimeout(() => setVoiceStatusText(''), 4000);
      }
    } else {
      setVoiceStage('idle');
      setVoiceStatusText('');
    }

    setRecordingLoading(false);
  };

  const consecutiveFailuresRef = useRef(0);

  const checkHealthStatus = async () => {
    setCheckingLoading(true);
    try {
      const health = await healthService.getHealthStatus();
      setHealthData(health);

      const isBackendUp = health && (health.status === 'healthy' || health.backend?.connected === true);
      const isDbUp = health?.database?.connected === true;
      const isAiUp = health?.ollama?.connected === true && health?.ollama?.model_available === true;
      const isVoiceUp = health?.voice?.whisper_stt === true || health?.voice?.tts === true;

      if (isBackendUp) {
        consecutiveFailuresRef.current = 0;
        setBackendOnline(true);
        setDatabaseConnected(isDbUp);
        setAiOnline(isAiUp);
        setVoiceReady(isVoiceUp);
        setHealthState('healthy');
      } else {
        consecutiveFailuresRef.current += 1;
        console.warn(`[Health] Non-healthy response received (${consecutiveFailuresRef.current} consecutive failure(s))`);
        if (consecutiveFailuresRef.current >= 2) {
          setBackendOnline(false);
          setDatabaseConnected(isDbUp);
          setAiOnline(isAiUp);
          setVoiceReady(isVoiceUp);
          setHealthState('unhealthy');
        }
      }

      // Console debug logging
      console.log('[Health] Backend:', isBackendUp ? 'ONLINE' : 'OFFLINE', '| Consecutive failures:', consecutiveFailuresRef.current);
    } catch (err) {
      consecutiveFailuresRef.current += 1;
      console.error(`[Health] System health check failed (${consecutiveFailuresRef.current} consecutive failure(s)):`, err);
      if (consecutiveFailuresRef.current >= 2) {
        setBackendOnline(false);
        setDatabaseConnected(false);
        setAiOnline(false);
        setVoiceReady(false);
        setHealthState('unhealthy');
      }
    } finally {
      setCheckingLoading(false);
    }
  };

  // Poll server status every 10 seconds & immediately on tab visibility change
  useEffect(() => {
    checkHealthStatus();
    const interval = setInterval(checkHealthStatus, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Health] Tab became visible — running immediate health check');
        checkHealthStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-scroll to latest message inside conversation box
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Focus input on initial mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async (textToSend = null, actionOverride = null) => {
    const rawText = textToSend || inputText;
    const trimmedText = rawText.trim();
    if (!trimmedText || loading) return;

    // Append user message
    const userMsgId = `user-${Date.now()}`;
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: trimmedText,
      timestamp: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setErrorMsg(null);
    setLastFailedMessage(null);

    try {
      const response = await chatService.sendMessage(trimmedText, conversationId, actionOverride);
      
      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPerformed: response.action_performed,
        intent: response.intent,
      };
      
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Failed to communicate with AI Agent:', err);
      setLastFailedMessage(trimmedText);
      setErrorMsg("Sorry, I couldn't process that request. Please try again.");
    } finally {
      setLoading(false);
      // Restore input focus immediately after response
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearConversation = async () => {
    setMessages([INITIAL_MESSAGE]);
    setErrorMsg(null);
    setLastFailedMessage(null);
    setConversationId(generateSessionId());
    
    // Explicitly reset backend session state
    try {
      await chatService.sendMessage('reset', conversationId, 'reset');
    } catch (e) {
      // ignore
    }
    
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleQuickAction = (actionText, actionType) => {
    handleSendMessage(actionText, actionType);
  };

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Top Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mr-1">AI Receptionist</h1>
            
            {/* Backend Status Pill */}
            {healthState === 'checking' && backendOnline === null ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Checking system...
              </span>
            ) : backendOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Backend Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Backend Offline
              </span>
            )}

            {/* Local AI Status Pill */}
            {backendOnline && (
              aiOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Local AI Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  AI Offline
                </span>
              )
            )}

            {/* Database Status Pill */}
            {backendOnline && (
              databaseConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Database Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Database Offline
                </span>
              )
            )}

            {/* Voice Status Pill */}
            {backendOnline && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                voiceReady ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${voiceReady ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {voiceReady ? 'Voice Ready' : 'Voice Offline'}
              </span>
            )}

            {/* Manual Retry Button */}
            <button
              onClick={checkHealthStatus}
              disabled={checkingLoading}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors shadow-xs ml-1"
              title="Re-check system status"
            >
              <IoRefreshOutline className={`w-3.5 h-3.5 ${checkingLoading ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Autonomous customer service & appointment management workspace
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 hidden md:inline-block">
            Session: {conversationId.substring(0, 13)}
          </span>

          <button
            onClick={handleClearConversation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-xs"
            title="Clear Conversation & Reset Session"
          >
            <IoTrashOutline className="w-3.5 h-3.5 text-slate-500" />
            <span>Clear Conversation</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Inbox Workspace */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1 flex flex-col overflow-hidden min-h-[400px]">
        
        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Welcome Card if only initial message exists */}
          {messages.length <= 1 && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/60 to-slate-50 border border-blue-100/80 max-w-xl mx-auto text-center space-y-3 mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                <IoSparklesOutline className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Welcome to your AI Receptionist Workspace</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                Your AI receptionist can book appointments, check customer schedules, and manage customer records using local on-premise AI.
              </p>
            </div>
          )}

          {/* Messages Stream */}
          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            return (
              <div key={msg.id} className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
                {/* AI Avatar */}
                {isAi && (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs mt-0.5">
                    🤖
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${isAi ? 'text-left' : 'text-right'}`}>
                  {/* Sender Header */}
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 px-1">
                    <span>{isAi ? 'AI Receptionist' : 'You'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-3 text-sm shadow-xs leading-relaxed ${
                    isAi
                      ? 'bg-slate-100/90 text-slate-800 border border-slate-200/60 rounded-tl-xs'
                      : 'bg-blue-600 text-white rounded-tr-xs font-normal'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Interactive Confirmation Buttons for Cancel Flow */}
                    {isAi && msg.text.includes("Are you sure you want to cancel this appointment?") && (
                      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-200/80">
                        <button
                          onClick={() => handleSendMessage("Confirm Cancellation", "cancel_appointment")}
                          disabled={loading}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
                        >
                          Confirm Cancellation
                        </button>
                        <button
                          onClick={() => handleSendMessage("Keep Appointment", "cancel_appointment")}
                          disabled={loading}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
                        >
                          Keep Appointment
                        </button>
                      </div>
                    )}
                    
                    {/* Action Completed Indicator */}
                    {isAi && msg.actionPerformed && (
                      <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/80">
                        <IoCheckmarkCircleSharp className="w-3.5 h-3.5 text-emerald-500" />
                        <span>✓ Action completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Processing / Thinking State */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs mt-0.5 animate-pulse">
                🤖
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-400 px-1">AI Receptionist</div>
                <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-2 text-xs font-medium border border-slate-200/60">
                  <span>AI Receptionist is thinking</span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error State with Retry Button */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-sm text-rose-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-medium">
              <div className="flex items-center gap-2">
                <IoAlertCircleSharp className="w-5 h-5 text-rose-500 shrink-0" />
                <p>{errorMsg}</p>
              </div>
              {lastFailedMessage && (
                <button
                  onClick={() => handleSendMessage(lastFailedMessage)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-100/50 transition-colors shrink-0 shadow-xs"
                >
                  <IoRefreshOutline className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Chips & Input Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3 shrink-0">
          {/* Quick Action Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => handleQuickAction("I want to book an appointment.", "book_appointment")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0 shadow-xs disabled:opacity-50"
            >
              <IoCalendarOutline className="w-3.5 h-3.5 text-blue-500" />
              <span>Book Appointment</span>
            </button>

            <button
              onClick={() => handleQuickAction("Show my appointments.", "view_appointments")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0 shadow-xs disabled:opacity-50"
            >
              <IoTimeOutline className="w-3.5 h-3.5 text-indigo-500" />
              <span>View Appointments</span>
            </button>

            <button
              onClick={() => handleQuickAction("Show customer details.", "customer_information")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0 shadow-xs disabled:opacity-50"
            >
              <IoPeopleOutline className="w-3.5 h-3.5 text-emerald-500" />
              <span>Customer Information</span>
            </button>

            <button
              onClick={() => handleQuickAction("Cancel my appointment.", "cancel_appointment")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shrink-0 shadow-xs disabled:opacity-50"
            >
              <IoCloseCircleOutline className="w-3.5 h-3.5 text-rose-500" />
              <span>Cancel Appointment</span>
            </button>

            <button
              onClick={() => handleQuickAction("What are your business hours?", "general_question")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0 shadow-xs disabled:opacity-50"
            >
              <IoChatbubbleEllipsesOutline className="w-3.5 h-3.5 text-amber-500" />
              <span>Ask a Question</span>
            </button>
          </div>

          {/* Status Alert Banners */}
          {backendOnline === false && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center justify-between shadow-xs">
              <span className="flex items-center gap-2">
                <IoAlertCircleSharp className="w-4 h-4 text-rose-600 shrink-0" />
                Backend is unavailable. Please start the FastAPI server on port 8000.
              </span>
              <button onClick={checkHealthStatus} className="underline font-bold hover:text-rose-900 shrink-0">
                Retry Connection
              </button>
            </div>
          )}

          {backendOnline && aiOnline === false && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-between shadow-xs">
              <span className="flex items-center gap-2">
                <IoAlertCircleSharp className="w-4 h-4 text-amber-600 shrink-0" />
                Local AI engine is unavailable. Please start Ollama with model qwen3:4b.
              </span>
              <button onClick={checkHealthStatus} className="underline font-bold hover:text-amber-900 shrink-0">
                Retry
              </button>
            </div>
          )}

          {/* Voice Pipeline Stage Indicator */}
          {voiceStatusText && (
            <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
              voiceStage === 'recording'
                ? 'bg-rose-50 border border-rose-200 text-rose-700 animate-pulse'
                : voiceStage === 'transcribing' || voiceStage === 'thinking'
                ? 'bg-blue-50 border border-blue-200 text-blue-700'
                : voiceStage === 'speaking'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}>
              <span className="flex items-center gap-2">
                <span>{voiceStatusText}</span>
              </span>
              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-md shadow-xs transition-colors"
                >
                  Stop Recording
                </button>
              )}
            </div>
          )}

          {/* Form Message Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder={
                backendOnline === false
                  ? "Backend is unavailable. Please start the FastAPI server..."
                  : isRecording
                  ? "Listening to your voice..."
                  : "Type your message to the AI receptionist... (Press Enter to send)"
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || isRecording || backendOnline === false}
              className="flex-1 px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100 disabled:text-slate-400 placeholder:text-slate-400"
            />
            
            {/* Microphone Voice Input Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || recordingLoading || backendOnline === false}
              title={isRecording ? "Stop Voice Recording" : "Speak to AI Receptionist"}
              className={`p-3 rounded-xl font-semibold transition-all shadow-xs flex items-center justify-center shrink-0 disabled:opacity-50 ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
              }`}
            >
              {isRecording ? <IoMicOffOutline className="w-5 h-5" /> : <IoMicOutline className="w-5 h-5 text-blue-600" />}
            </button>

            <button
              type="submit"
              disabled={loading || !inputText.trim() || isRecording || backendOnline === false}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:hover:bg-blue-600 text-sm"
            >
              <span>Send</span>
              <IoSend className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
