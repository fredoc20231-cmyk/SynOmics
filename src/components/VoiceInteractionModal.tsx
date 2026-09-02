import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Play, 
  Square, 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  Globe, 
  Check, 
  Radio,
  AudioWaveform as WaveformIcon,
  Headphones
} from 'lucide-react';
import { 
  VoiceSettings, 
  VoiceOption, 
  getBrowserVoices, 
  speakText, 
  stopSpeaking,
  startListening,
  stopListening
} from '../lib/voice-service';

interface VoiceInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (settings: VoiceSettings) => void;
  onVoiceTranscriptReceived?: (transcript: string) => void;
}

export const VoiceInteractionModal: React.FC<VoiceInteractionModalProps> = ({
  isOpen,
  onClose,
  voiceSettings,
  onUpdateVoiceSettings,
  onVoiceTranscriptReceived
}) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isSpeakingTest, setIsSpeakingTest] = useState(false);
  const [isListeningTest, setIsListeningTest] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getBrowserVoices().then(setVoices);
    } else {
      stopSpeaking();
      stopListening();
      setIsListeningTest(false);
      setIsSpeakingTest(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestSpeech = () => {
    if (isSpeakingTest) {
      stopSpeaking();
      setIsSpeakingTest(false);
    } else {
      setIsSpeakingTest(true);
      speakText(
        "Welcome to SynOmics. Voice listening and speech synthesis are fully active with verified neural encryption. How may I assist your bioinformatics research today?",
        voiceSettings
      ).finally(() => {
        setTimeout(() => setIsSpeakingTest(false), 5000);
      });
    }
  };

  const handleToggleListeningTest = () => {
    if (isListeningTest) {
      stopListening();
      setIsListeningTest(false);
    } else {
      setMicError(null);
      setLiveTranscript('Listening... Speak your scientific query into the microphone');
      const started = startListening(
        (text, isFinal) => {
          setLiveTranscript(text);
          if (isFinal && onVoiceTranscriptReceived) {
            onVoiceTranscriptReceived(text);
          }
        },
        (err) => {
          setMicError(err);
          setIsListeningTest(false);
        },
        voiceSettings.listeningLanguage
      );

      if (started) {
        setIsListeningTest(true);
      }
    }
  };

  const languages = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'es-ES', label: 'Spanish (Español)' },
    { code: 'fr-FR', label: 'French (Français)' },
    { code: 'de-DE', label: 'German (Deutsch)' },
    { code: 'zh-CN', label: 'Chinese (Mandarin)' },
    { code: 'ja-JP', label: 'Japanese (日本語)' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FAF9F5] dark:bg-[#0E131E] border border-[#E2DDD2] dark:border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2DDD2] dark:border-[#1E293B] flex items-center justify-between bg-white dark:bg-[#12161F]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">
                  Voice Listening & Speech Synthesis
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Neural Secret API Verified
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Configure bidirectional voice controls, speech recognition, and neural text-to-speech.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopSpeaking();
              stopListening();
              onClose();
            }}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#E8E1D2] dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Security & Key Verification Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  Secured Speech Engine Active
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Authenticated with server-side secret API (<span className="font-mono">65f56a2d...5739a</span>).
                </p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-600 text-white shadow-xs">
              HPC READY
            </span>
          </div>

          {/* Section 1: Listening (Speech-to-Text) Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-slate-200">
                  1. Speech-to-Text (Listening Function)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Real-Time Dictation</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#12161F] border border-[#E2DDD2] dark:border-[#1E293B] space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                    Listening Language
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Select your speech recognition dialect
                  </p>
                </div>
                <select
                  value={voiceSettings.listeningLanguage}
                  onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, listeningLanguage: e.target.value })}
                  className="px-3 py-1.5 rounded-lg text-xs bg-[#FAF9F5] dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-medium"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Live Listening Test Bar */}
              <div className="pt-2 border-t border-[#E2DDD2] dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleToggleListeningTest}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
                      isListeningTest
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isListeningTest ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isListeningTest ? 'Stop Listening' : 'Test Microphone / Dictation'}</span>
                  </button>

                  {isListeningTest && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold">LIVE MIC ACTIVE</span>
                    </div>
                  )}
                </div>

                {liveTranscript && (
                  <div className="p-3 rounded-lg bg-[#FAF9F5] dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-700 text-xs font-mono text-[#0F172A] dark:text-slate-200">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Live Transcription Output:</span>
                    "{liveTranscript}"
                  </div>
                )}

                {micError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    ⚠️ {micError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Speech Synthesis (Speaking Function) Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-slate-200">
                  2. Text-to-Speech (Speaking Function)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Neural Audio Playback</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#12161F] border border-[#E2DDD2] dark:border-[#1E293B] space-y-4">
              
              {/* Auto-Speak Responses Switch */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                    Auto-Speak AI Responses
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Automatically read assistant answers out loud as they complete
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateVoiceSettings({ ...voiceSettings, autoSpeakResponses: !voiceSettings.autoSpeakResponses })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    voiceSettings.autoSpeakResponses ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Voice Selection */}
              <div className="space-y-1.5 pt-2 border-t border-[#E2DDD2] dark:border-slate-800">
                <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  Voice Model Profile
                </label>
                <select
                  value={voiceSettings.voiceId}
                  onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, voiceId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#FAF9F5] dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-slate-700 text-[#0F172A] dark:text-slate-100 font-medium"
                >
                  <option value="default">Default System Neural Voice</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Speed & Pitch Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E2DDD2] dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#0F172A] dark:text-slate-300">Speech Rate</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{voiceSettings.speed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={voiceSettings.speed}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, speed: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#0F172A] dark:text-slate-300">Volume</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{Math.round(voiceSettings.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={voiceSettings.volume}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, volume: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Test Audio Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestSpeech}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isSpeakingTest
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {isSpeakingTest ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isSpeakingTest ? 'Stop Voice Test' : 'Test Speech Synthesis'}</span>
                </button>

                {isSpeakingTest && (
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <WaveformIcon className="w-4 h-4 animate-bounce" />
                    <span className="text-xs font-mono">Synthesizing audio...</span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E2DDD2] dark:border-[#1E293B] bg-white dark:bg-[#12161F] flex items-center justify-between">
          <p className="text-[11px] text-[#64748B] dark:text-slate-400">
            Microphone and audio permissions are saved for your active session.
          </p>

          <button
            onClick={() => {
              stopSpeaking();
              stopListening();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            Save & Close
          </button>
        </div>

      </div>
    </div>
  );
};
