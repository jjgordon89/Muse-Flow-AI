import { IService } from '../../architecture/interfaces/IServices';

export interface VoiceConfig {
  speechRecognition: {
    language: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
  };
  speechSynthesis: {
    voice?: SpeechSynthesisVoice;
    rate: number;
    pitch: number;
    volume: number;
    language: string;
  };
  noiseReduction: {
    enabled: boolean;
    threshold: number;
  };
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

export interface VoiceRecognitionOptions {
  onResult?: (result: VoiceRecognitionResult) => void;
  onError?: (error: VoiceError) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onNoMatch?: () => void;
}

export interface SpeechSynthesisOptions {
  text: string;
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
}

export class VoiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

export class VoiceService implements IService {
  readonly name = 'VoiceService';
  
  private config: VoiceConfig;
  private recognition: any | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isRecording = false;
  private isSpeaking = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private noiseReducer: AudioWorkletNode | null = null;

  constructor(config?: Partial<VoiceConfig>) {
    this.config = {
      speechRecognition: {
        language: 'en-US',
        continuous: true,
        interimResults: true,
        maxAlternatives: 3,
        ...config?.speechRecognition
      },
      speechSynthesis: {
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        language: 'en-US',
        ...config?.speechSynthesis
      },
      noiseReduction: {
        enabled: true,
        threshold: 0.1,
        ...config?.noiseReduction
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Check for browser support
      this.checkBrowserSupport();

      // Initialize Speech Recognition
      await this.initializeSpeechRecognition();

      // Initialize Speech Synthesis
      this.initializeSpeechSynthesis();

      // Initialize Audio Context for advanced features
      await this.initializeAudioContext();

      console.log('Voice service initialized successfully');
    } catch (error) {
      throw new VoiceError('Failed to initialize voice service', 'INIT_ERROR', error);
    }
  }

  async destroy(): Promise<void> {
    try {
      this.stopRecording();
      this.stopSpeaking();
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      console.log('Voice service destroyed');
    } catch (error) {
      console.error('Error destroying voice service:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.checkBrowserSupport();
  }

  // Speech Recognition
  async startRecording(options?: VoiceRecognitionOptions): Promise<void> {
    if (this.isRecording) {
      throw new VoiceError('Already recording', 'ALREADY_RECORDING');
    }

    if (!this.recognition) {
      throw new VoiceError('Speech recognition not available', 'NOT_SUPPORTED');
    }

    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup recognition event handlers
      this.setupRecognitionHandlers(options);

      // Apply noise reduction if enabled
      if (this.config.noiseReduction.enabled) {
        await this.applyNoiseReduction();
      }

      // Start recognition
      this.recognition.start();
      this.isRecording = true;
      
      options?.onStart?.();
    } catch (error) {
      throw new VoiceError('Failed to start recording', 'START_ERROR', error);
    }
  }

  stopRecording(): void {
    if (!this.isRecording || !this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
      this.isRecording = false;

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  // Speech Synthesis
  async speak(options: SpeechSynthesisOptions): Promise<void> {
    if (!this.synthesis) {
      throw new VoiceError('Speech synthesis not available', 'NOT_SUPPORTED');
    }

    if (this.isSpeaking) {
      this.stopSpeaking();
    }

    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(options.text);
        
        // Configure utterance
        utterance.voice = options.voice || this.config.speechSynthesis.voice || null;
        utterance.rate = options.rate || this.config.speechSynthesis.rate;
        utterance.pitch = options.pitch || this.config.speechSynthesis.pitch;
        utterance.volume = options.volume || this.config.speechSynthesis.volume;
        utterance.lang = this.config.speechSynthesis.language;

        // Setup event handlers
        utterance.onstart = () => {
          this.isSpeaking = true;
          options.onStart?.();
        };

        utterance.onend = () => {
          this.isSpeaking = false;
          options.onEnd?.();
          resolve();
        };

        utterance.onpause = () => {
          options.onPause?.();
        };

        utterance.onresume = () => {
          options.onResume?.();
        };

        utterance.onboundary = (event) => {
          options.onBoundary?.(event);
        };

        utterance.onerror = (event) => {
          this.isSpeaking = false;
          options.onError?.(event);
          reject(new VoiceError('Speech synthesis error', 'SYNTHESIS_ERROR', event));
        };

        // Start speaking
        this.synthesis!.speak(utterance);
      } catch (error) {
        reject(new VoiceError('Failed to start speech synthesis', 'SPEAK_ERROR', error));
      }
    });
  }

  stopSpeaking(): void {
    if (!this.synthesis || !this.isSpeaking) {
      return;
    }

    try {
      this.synthesis.cancel();
      this.isSpeaking = false;
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  pauseSpeaking(): void {
    if (!this.synthesis || !this.isSpeaking) {
      return;
    }

    try {
      this.synthesis.pause();
    } catch (error) {
      console.error('Error pausing speech:', error);
    }
  }

  resumeSpeaking(): void {
    if (!this.synthesis) {
      return;
    }

    try {
      this.synthesis.resume();
    } catch (error) {
      console.error('Error resuming speech:', error);
    }
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  // Voice Management
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) {
      return [];
    }

    return this.synthesis.getVoices();
  }

  async waitForVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const voices = this.getAvailableVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      // Voices might not be loaded yet
      const onVoicesChanged = () => {
        const voices = this.getAvailableVoices();
        if (voices.length > 0) {
          if (this.synthesis) {
            this.synthesis.removeEventListener('voiceschanged', onVoicesChanged);
          }
          resolve(voices);
        }
      };

      if (this.synthesis) {
        this.synthesis.addEventListener('voiceschanged', onVoicesChanged);
      }

      // Fallback timeout
      setTimeout(() => {
        if (this.synthesis) {
          this.synthesis.removeEventListener('voiceschanged', onVoicesChanged);
        }
        resolve(this.getAvailableVoices());
      }, 3000);
    });
  }

  findVoiceByName(name: string): SpeechSynthesisVoice | null {
    const voices = this.getAvailableVoices();
    return voices.find(voice => voice.name === name) || null;
  }

  findVoicesByLanguage(language: string): SpeechSynthesisVoice[] {
    const voices = this.getAvailableVoices();
    return voices.filter(voice => voice.lang.startsWith(language));
  }

  // Configuration
  updateConfig(newConfig: Partial<VoiceConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      speechRecognition: {
        ...this.config.speechRecognition,
        ...newConfig.speechRecognition
      },
      speechSynthesis: {
        ...this.config.speechSynthesis,
        ...newConfig.speechSynthesis
      },
      noiseReduction: {
        ...this.config.noiseReduction,
        ...newConfig.noiseReduction
      }
    };

    // Update recognition settings if available
    if (this.recognition) {
      this.recognition.lang = this.config.speechRecognition.language;
      this.recognition.continuous = this.config.speechRecognition.continuous;
      this.recognition.interimResults = this.config.speechRecognition.interimResults;
      this.recognition.maxAlternatives = this.config.speechRecognition.maxAlternatives;
    }
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  // Private methods
  private checkBrowserSupport(): boolean {
    const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasSynthesis = 'speechSynthesis' in window;
    const hasMediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

    if (!hasRecognition) {
      console.warn('Speech recognition not supported in this browser');
    }

    if (!hasSynthesis) {
      console.warn('Speech synthesis not supported in this browser');
    }

    if (!hasMediaDevices) {
      console.warn('Media devices not supported in this browser');
    }

    return hasRecognition && hasSynthesis && hasMediaDevices;
  }

  private async initializeSpeechRecognition(): Promise<void> {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new VoiceError('Speech recognition not supported', 'NOT_SUPPORTED');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.config.speechRecognition.language;
    this.recognition.continuous = this.config.speechRecognition.continuous;
    this.recognition.interimResults = this.config.speechRecognition.interimResults;
    this.recognition.maxAlternatives = this.config.speechRecognition.maxAlternatives;
  }

  private initializeSpeechSynthesis(): void {
    if (!('speechSynthesis' in window)) {
      throw new VoiceError('Speech synthesis not supported', 'NOT_SUPPORTED');
    }

    this.synthesis = window.speechSynthesis;
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
    }
  }

  private setupRecognitionHandlers(options?: VoiceRecognitionOptions): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: any) => {
      const results = Array.from(event.results);
      const lastResult = results[results.length - 1] as any;
      
      if (lastResult) {
        const result: VoiceRecognitionResult = {
          transcript: lastResult[0]?.transcript || '',
          confidence: lastResult[0]?.confidence || 0,
          isFinal: lastResult.isFinal || false,
          alternatives: Array.from(lastResult).slice(1).map((alt: any) => ({
            transcript: alt.transcript || '',
            confidence: alt.confidence || 0
          }))
        };

        options?.onResult?.(result);
      }
    };

    this.recognition.onerror = (event: any) => {
      const error = new VoiceError(
        `Speech recognition error: ${event.error}`,
        'RECOGNITION_ERROR',
        event
      );
      options?.onError?.(error);
    };

    this.recognition.onstart = () => {
      options?.onStart?.();
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      options?.onEnd?.();
    };

    this.recognition.onspeechstart = () => {
      options?.onSpeechStart?.();
    };

    this.recognition.onspeechend = () => {
      options?.onSpeechEnd?.();
    };

    this.recognition.onnomatch = () => {
      options?.onNoMatch?.();
    };
  }

  private async applyNoiseReduction(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) {
      return;
    }

    try {
      // Load audio worklet for noise reduction
      await this.audioContext.audioWorklet.addModule('/audio-worklets/noise-reducer.js');
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.noiseReducer = new AudioWorkletNode(this.audioContext, 'noise-reducer', {
        parameterData: {
          threshold: this.config.noiseReduction.threshold
        }
      });

      source.connect(this.noiseReducer);
      // Note: For speech recognition, we typically don't connect to destination
      // as the recognition API handles the audio processing
    } catch (error) {
      console.warn('Failed to apply noise reduction:', error);
    }
  }

  // Utility methods
  async testMicrophone(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async getMicrophoneLevel(): Promise<number> {
    if (!this.audioContext || !this.mediaStream) {
      return 0;
    }

    return new Promise((resolve) => {
      const source = this.audioContext!.createMediaStreamSource(this.mediaStream!);
      const analyser = this.audioContext!.createAnalyser();
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      source.connect(analyser);
      
      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        resolve(average / 255); // Normalize to 0-1
      };

      requestAnimationFrame(checkLevel);
    });
  }

  supportedLanguages(): string[] {
    // Common supported languages - this could be made more dynamic
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
      'es-ES', 'es-MX', 'es-AR',
      'fr-FR', 'fr-CA',
      'de-DE',
      'it-IT',
      'pt-BR', 'pt-PT',
      'ru-RU',
      'ja-JP',
      'ko-KR',
      'zh-CN', 'zh-TW'
    ];
  }
}