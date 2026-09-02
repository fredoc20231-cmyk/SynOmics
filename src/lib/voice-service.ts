/**
 * Voice Listening (Speech-to-Text) and Speaking (Text-to-Speech) Service
 * Provides bidirectional real-time audio interaction for SynOmics,
 * backed by Web Speech API and server-side neural speech integration.
 */

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender?: 'female' | 'male';
  isDefault?: boolean;
}

export interface VoiceSettings {
  enabled: boolean;
  autoSpeakResponses: boolean;
  voiceId: string;
  speed: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 1.5
  volume: number; // 0.0 to 1.0
  listeningLanguage: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  autoSpeakResponses: false,
  voiceId: 'default',
  speed: 1.05,
  pitch: 1.0,
  volume: 1.0,
  listeningLanguage: 'en-US'
};

// Global audio playback state
let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeakingInternal = false;
let speechListeners: Array<(isSpeaking: boolean) => void> = [];

// Global speech recognition state
let recognitionInstance: any = null;
let isListeningInternal = false;
let listeningListeners: Array<(isListening: boolean) => void> = [];

export function subscribeToSpeechState(listener: (isSpeaking: boolean) => void): () => void {
  speechListeners.push(listener);
  listener(isSpeakingInternal);
  return () => {
    speechListeners = speechListeners.filter(l => l !== listener);
  };
}

function notifySpeechState(speaking: boolean) {
  isSpeakingInternal = speaking;
  speechListeners.forEach(fn => fn(speaking));
}

export function subscribeToListeningState(listener: (isListening: boolean) => void): () => void {
  listeningListeners.push(listener);
  listener(isListeningInternal);
  return () => {
    listeningListeners = listeningListeners.filter(l => l !== listener);
  };
}

function notifyListeningState(listening: boolean) {
  isListeningInternal = listening;
  listeningListeners.forEach(fn => fn(listening));
}

/**
 * Strips raw code blocks, markdown symbols, and chemical notations for natural speaking
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, 'Code implementation omitted.')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/ΔΔG/g, 'delta delta G')
    .replace(/Δ/g, 'delta ')
    .replace(/α/g, 'alpha ')
    .replace(/β/g, 'beta ')
    .replace(/γ/g, 'gamma ')
    .replace(/p\s*<\s*([0-9.e-]+)/gi, 'p value less than $1')
    .replace(/log2FC/gi, 'log 2 fold change')
    .replace(/snRNA-seq/gi, 'single nucleus RNA sequencing')
    .replace(/scRNA-seq/gi, 'single cell RNA sequencing')
    .replace(/GWAS/g, 'G-WAS')
    .trim();
}

/**
 * Retrieves all available voice profiles from browser synthesis
 */
export function getBrowserVoices(): Promise<VoiceOption[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([
        { id: 'synomics-neuro-female', name: 'Dr. Synapse (Female)', lang: 'en-US', gender: 'female' },
        { id: 'synomics-sheen-male', name: 'Prof. Sheen (Male)', lang: 'en-US', gender: 'male' }
      ]);
      return;
    }

    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const options: VoiceOption[] = voices.map((v, i) => ({
        id: v.voiceURI || `voice-${i}`,
        name: `${v.name} (${v.lang})`,
        lang: v.lang,
        gender: v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha') ? 'female' : 'male',
        isDefault: v.default
      }));
      resolve(options);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      const options: VoiceOption[] = voices.map((v, i) => ({
        id: v.voiceURI || `voice-${i}`,
        name: `${v.name} (${v.lang})`,
        lang: v.lang,
        gender: v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha') ? 'female' : 'male',
        isDefault: v.default
      }));
      resolve(options);
    };

    setTimeout(() => {
      resolve([
        { id: 'default', name: 'System Default Voice (English)', lang: 'en-US', isDefault: true }
      ]);
    }, 1000);
  });
}

/**
 * Speaks text using Web Speech Synthesis and backend text sanitization
 */
export async function speakText(
  rawText: string,
  settings: Partial<VoiceSettings> = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Stop any existing speech
  stopSpeaking();

  const clean = cleanTextForSpeech(rawText);
  if (!clean) return;

  // Check if speech synthesis is available
  if ('speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = settings.speed ?? 1.05;
      utterance.pitch = settings.pitch ?? 1.0;
      utterance.volume = settings.volume ?? 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (settings.voiceId && settings.voiceId !== 'default') {
        const found = voices.find(v => v.voiceURI === settings.voiceId || v.name === settings.voiceId);
        if (found) utterance.voice = found;
      } else if (voices.length > 0) {
        // Prefer natural English voices if available
        const preferred = voices.find(v => 
          (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Jenny')))
        );
        if (preferred) utterance.voice = preferred;
      }

      utterance.onstart = () => {
        notifySpeechState(true);
      };

      utterance.onend = () => {
        notifySpeechState(false);
        currentUtterance = null;
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis notification:', e.error);
        notifySpeechState(false);
        currentUtterance = null;
      };

      currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Error starting speech synthesis:', err);
      notifySpeechState(false);
    }
  } else {
    console.warn('SpeechSynthesis not supported on this browser.');
  }
}

/**
 * Stops any active speech playback
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
  }
  notifySpeechState(false);
  currentUtterance = null;
}

/**
 * Speech-to-Text Listening setup
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startListening(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  language = 'en-US'
): boolean {
  if (typeof window === 'undefined') return false;

  stopListening();

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (onError) onError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    return false;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      notifyListeningState(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        if (onError) onError(`Microphone: ${event.error}`);
      }
      notifyListeningState(false);
    };

    recognition.onend = () => {
      notifyListeningState(false);
      recognitionInstance = null;
    };

    recognitionInstance = recognition;
    recognition.start();
    return true;
  } catch (err: any) {
    console.error('Failed to start speech recognition:', err);
    if (onError) onError(err.message || 'Microphone access failed');
    notifyListeningState(false);
    return false;
  }
}

export function stopListening(): void {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {
      // ignore
    }
    recognitionInstance = null;
  }
  notifyListeningState(false);
}
