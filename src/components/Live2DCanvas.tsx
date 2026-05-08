import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { aiController } from '../lib/ai-controller';
import { animationController } from '../lib/animation-controller';
import { autoTalkController } from '../lib/autotalk-controller';
import { expressionManager } from '../lib/expression-manager';
import { gestureController } from '../lib/gesture-controller';
import { live2dManager } from '../lib/live2d-manager';
import { lipSyncController } from '../lib/lipsync-controller';

const MODEL_PATH = '/models/mao_pro/mao_pro.model3.json';

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const submittedTranscriptRef = useRef('');
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const initLive2D = async () => {
      if (!canvasRef.current) {
        return;
      }

      try {
        setIsModelLoading(true);
        setError(null);

        await live2dManager.init(canvasRef.current);
        const model = await live2dManager.loadModel(MODEL_PATH);
        animationController.init(model);
        expressionManager.init(model);
        lipSyncController.init(model);
        gestureController.init(model);

        setIsModelLoading(false);
        console.log('[Yuki] All systems ready!');
      } catch (err) {
        console.error('[Yuki] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsModelLoading(false);
      }
    };

    void initLive2D();

    return () => {
      // Biar aman di StrictMode dev, instance dibiarkan hidup.
    };
  }, []);

  const handleSend = useEffectEvent(async (text: string) => {
    const trimmedInput = text.trim();
    if (!trimmedInput || isModelLoading || isSending) {
      return;
    }

    setIsSending(true);

    try {
      await aiController.sendMessage(trimmedInput);
    } finally {
      setIsSending(false);
    }
  });

  const handleToggleListening = useEffectEvent(() => {
    if (isModelLoading || isSending) {
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    if (isListening) {
      recognition.stop();
      return;
    }

    finalTranscriptRef.current = '';
    recognition.start();
  });

  useEffect(() => {
    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'id-ID';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      finalTranscriptRef.current = '';
      submittedTranscriptRef.current = '';
      setIsListening(true);
      autoTalkController.onUserMessage();
    };

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? '';

        if (!result.isFinal) {
          continue;
        }

        finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();

        const finalTranscript = finalTranscriptRef.current.trim();
        if (
          finalTranscript &&
          finalTranscript !== submittedTranscriptRef.current
        ) {
          submittedTranscriptRef.current = finalTranscript;
          recognition.stop();
          void handleSend(finalTranscript);
          return;
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    (recognition as SpeechRecognition & { onnomatch?: () => void }).onnomatch = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      const transcript = finalTranscriptRef.current.trim();
      if (!transcript || transcript === submittedTranscriptRef.current) {
        return;
      }

      submittedTranscriptRef.current = transcript;
      void handleSend(transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'm' || event.key === 'M') {
        handleToggleListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="live2d-container">
      <canvas ref={canvasRef} className="live2d-canvas" />

      {isModelLoading && (
        <div className="live2d-loading">
          <p>Loading Yuki...</p>
        </div>
      )}

      {error && (
        <div className="live2d-error">
          <p>Error: {error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggleListening}
        disabled={isModelLoading || isSending}
        className={`voice-btn ${isListening ? 'is-listening' : ''}`}
        aria-label={isListening ? 'Stop talking to Yuki' : 'Talk to Yuki'}
        title={isListening ? 'Stop talking to Yuki' : 'Talk to Yuki'}
      >
        A
      </button>
    </div>
  );
}
