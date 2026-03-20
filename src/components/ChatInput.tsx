import { useEffect, useRef, useState } from 'react';
import { aiController } from '../lib/ai-controller';
import { autoTalkController } from '../lib/autotalk-controller';

export function ChatInput() {
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const submittedTranscriptRef = useRef('');
  const isLoadingRef = useRef(false);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

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
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? '';

        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();

          const finalTranscript = finalTranscriptRef.current.trim();
          if (
            finalTranscript &&
            finalTranscript !== submittedTranscriptRef.current &&
            !isLoadingRef.current
          ) {
            submittedTranscriptRef.current = finalTranscript;
            recognition.stop();
            void handleSend(finalTranscript);
            return;
          }
        } else {
          interimTranscript = transcript;
        }
      }

      void interimTranscript;
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

  const handleSend = async (text: string) => {
    const trimmedInput = text.trim();
    if (!trimmedInput || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      await aiController.sendMessage(trimmedInput);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleListening = () => {
    if (isLoading) {
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
  };

  return (
    <div className="chat-container">
      <div className="chat-input-area voice-input-area">
        <button
          type="button"
          onClick={handleToggleListening}
          disabled={isLoading}
          className={`chat-send-btn voice-btn ${isListening ? 'is-listening' : ''}`}
          aria-label={isListening ? 'Stop talking to Aira' : 'Talk to Aira'}
          title={isListening ? 'Stop talking to Aira' : 'Talk to Aira'}
        >
          A
        </button>
      </div>
    </div>
  );
}
