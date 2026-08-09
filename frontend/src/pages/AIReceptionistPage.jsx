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
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Unique session ID
  const [conversationId, setConversationId] = useState(() => generateSessionId());
  
  // AI Engine Status States
  const [backendStatus, setBackendStatus] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordingLoading(true);
        try {
          const res = await voiceService.transcribeAudio(audioBlob);
          if (res && res.text) {
            handleSendMessage(res.text);
          }
        } catch (err) {
          console.error("STT transcription error:", err);
        } finally {
          setRecordingLoading(false);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone permission error:", err);
      setErrorMsg("Microphone access is required for voice input.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Poll server and Ollama status
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const health = await healthService.getHealthStatus();
        if (isMounted) {
          setBackendStatus(health.status === 'healthy');
          setOllamaStatus(health.ollama ? health.ollama.connected : false);
        }
      } catch (err) {
        if (isMounted) {
          setBackendStatus(false);
          setOllamaStatus(false);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">AI Receptionist</h1>
            {ollamaStatus === true ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Local AI Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                AI Offline
              </span>
            )}
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

          {/* Form Message Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder={isRecording ? "Listening to your voice..." : "Type your message to the AI receptionist... (Press Enter to send)"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || isRecording}
              className="flex-1 px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100 disabled:text-slate-400 placeholder:text-slate-400"
            />
            
            {/* Microphone Voice Input Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || recordingLoading}
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
              disabled={loading || !inputText.trim() || isRecording}
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
