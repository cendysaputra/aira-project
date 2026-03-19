import { type EmotionType } from '../config/expressions';
import { expressionManager } from '../lib/expression-manager';
import { lipSyncController } from '../lib/lipsync-controller';

const emotions: EmotionType[] = [
  'neutral',
  'happy',
  'sleepy',
  'excited',
  'sad',
  'embarrassed',
  'surprised',
  'angry',
];

const testTexts = [
  'Hai! Aku Aira, senang bertemu denganmu!',
  'Wah, itu keren banget! Aku excited!',
  'Hmm, aku agak sedih mendengar itu...',
];

export function DebugPanel() {
  return (
    <div className="debug-panel">
      <p className="debug-title">Expression Debug</p>
      <div className="debug-buttons">
        {emotions.map((emotion) => (
          <button
            key={emotion}
            type="button"
            onClick={() => {
              void expressionManager.setEmotion(emotion);
            }}
            className="debug-btn"
          >
            {emotion}
          </button>
        ))}
      </div>

      <p className="debug-title debug-subtitle">Lip Sync Test</p>
      <div className="debug-buttons">
        {testTexts.map((text, index) => (
          <button
            key={text}
            type="button"
            onClick={() => {
              void lipSyncController.speakWithText(text, 70);
            }}
            className="debug-btn"
          >
            Test {index + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            lipSyncController.stopSpeaking();
          }}
          className="debug-btn debug-btn-stop"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
