import React, { useState, useRef, useCallback, useEffect } from 'react';

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface VoiceCommandOptions {
  onTranscription: (text: string) => void;
  onCommand: (command: string, params?: any) => void;
  onError: (error: string) => void;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  noiseLevel: number;
}

export function useVoiceCommands({
  onTranscription,
  onCommand,
  onError,
  language = 'en-US',
  continuous = false,
  interimResults = true
}: VoiceCommandOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    confidence: 0,
    error: null,
    noiseLevel: 0
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const noiseThreshold = 30; // Adjustable noise threshold

  // Voice commands patterns
  const commandPatterns = {
    experiment: /^(analyze|run|create|test)\s+(experiment|test|ab test|a\/b test)/i,
    retention: /^(show|analyze|check)\s+(retention|cohort|churn)/i,
    conversion: /^(show|analyze|check)\s+(conversion|funnel|checkout)/i,
    engagement: /^(show|analyze|check)\s+(engagement|users|activity)/i,
    clear: /^(clear|reset|new)/i,
    submit: /^(submit|send|analyze|go)/i,
    navigate: /^(go to|navigate to|open)\s+(dashboard|snapshot|business)/i
  };

  // Define SpeechRecognition interface
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: any) => any) | null;
    onerror: ((this: SpeechRecognition, ev: any) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  }

  // Initialize audio context for noise detection
  const initializeAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      microphoneRef.current.connect(analyserRef.current);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      onError('Microphone access denied or not available');
      return false;
    }
  }, [onError]);

  // Monitor noise levels
  const monitorNoiseLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkNoise = () => {
      if (!analyserRef.current || !voiceState.isListening) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      setVoiceState(prev => ({ ...prev, noiseLevel: average }));
      
      if (voiceState.isListening) {
        requestAnimationFrame(checkNoise);
      }
    };
    
    checkNoise();
  }, [voiceState.isListening]);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onError('Speech recognition not supported in this browser');
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setVoiceState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null,
        transcript: ''
      }));
      monitorNoiseLevel();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0;

        if (result.isFinal) {
          finalTranscript += transcript;
          maxConfidence = Math.max(maxConfidence, confidence);
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      
      setVoiceState(prev => ({ 
        ...prev, 
        transcript: currentTranscript,
        confidence: maxConfidence
      }));

      // Process final results
      if (finalTranscript && voiceState.noiseLevel > noiseThreshold) {
        processVoiceCommand(finalTranscript.trim(), maxConfidence);
        onTranscription(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not accessible. Please check permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please enable microphone permissions.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setVoiceState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isListening: false 
      }));
      onError(errorMessage);
    };

    recognition.onend = () => {
      setVoiceState(prev => ({ 
        ...prev, 
        isListening: false,
        isProcessing: false
      }));
      
      // Clean up audio context
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    return recognition;
  }, [continuous, interimResults, language, onError, onTranscription, voiceState.noiseLevel, monitorNoiseLevel]);

  // Process voice commands
  const processVoiceCommand = useCallback((transcript: string, confidence: number) => {
    // Only process commands with sufficient confidence
    if (confidence < 0.7) {
      console.warn('Low confidence speech recognition:', confidence);
      return;
    }

    const lowercaseTranscript = transcript.toLowerCase().trim();

    // Check for command patterns
    for (const [commandType, pattern] of Object.entries(commandPatterns)) {
      if (pattern.test(lowercaseTranscript)) {
        let params = {};
        
        switch (commandType) {
          case 'experiment':
            params = { 
              action: 'create_experiment',
              text: transcript
            };
            break;
          case 'retention':
            params = { 
              action: 'analyze_retention',
              focus: 'retention'
            };
            break;
          case 'conversion':
            params = { 
              action: 'analyze_conversion',
              focus: 'monetization'
            };
            break;
          case 'engagement':
            params = { 
              action: 'analyze_engagement',
              focus: 'engagement'
            };
            break;
          case 'clear':
            params = { action: 'clear_form' };
            break;
          case 'submit':
            params = { action: 'submit_form' };
            break;
          case 'navigate':
            const destination = lowercaseTranscript.includes('dashboard') ? 'dashboard' : 'business-snapshot';
            params = { 
              action: 'navigate',
              destination 
            };
            break;
        }

        onCommand(commandType, params);
        return;
      }
    }

    // If no command pattern matches, treat as general question
    onCommand('general_question', { text: transcript });
  }, [onCommand]);

  // Start listening
  const startListening = useCallback(async () => {
    if (voiceState.isListening) return;

    // Initialize audio context for noise filtering
    const audioInitialized = await initializeAudioContext();
    if (!audioInitialized) return;

    // Initialize speech recognition
    const recognition = initializeSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
      setVoiceState(prev => ({ ...prev, isProcessing: true }));
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      onError('Failed to start voice recognition');
    }
  }, [voiceState.isListening, initializeAudioContext, initializeSpeechRecognition, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setVoiceState(prev => ({ 
      ...prev, 
      isListening: false,
      isProcessing: false,
      transcript: '',
      noiseLevel: 0
    }));
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (voiceState.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceState.isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    ...voiceState,
    startListening,
    stopListening,
    toggleListening,
    isNoiseFiltered: voiceState.noiseLevel < noiseThreshold
  };
}