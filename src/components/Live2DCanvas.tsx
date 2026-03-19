import { useEffect, useRef, useState } from 'react';
import { animationController } from '../lib/animation-controller';
import { expressionManager } from '../lib/expression-manager';
import { live2dManager } from '../lib/live2d-manager';
import { lipSyncController } from '../lib/lipsync-controller';

const MODEL_PATH = '/models/mao_pro/mao_pro.model3.json';

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
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
        setIsLoading(true);
        setError(null);

        await live2dManager.init(canvasRef.current);
        const model = await live2dManager.loadModel(MODEL_PATH);
        animationController.init(model);
        expressionManager.init(model);
        lipSyncController.init(model);

        setIsLoading(false);
        console.log('[Aira] All systems ready!');
      } catch (err) {
        console.error('[Aira] Init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsLoading(false);
      }
    };

    void initLive2D();

    return () => {
      // Keep the instance alive in dev to avoid React StrictMode double-init issues.
      // animationController.destroy();
      // expressionManager.destroy();
      // lipSyncController.destroy();
      // live2dManager.destroy();
    };
  }, []);

  return (
    <div className="live2d-container">
      <canvas ref={canvasRef} className="live2d-canvas" />

      {isLoading && (
        <div className="live2d-loading">
          <p>Loading Aira...</p>
        </div>
      )}

      {error && (
        <div className="live2d-error">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
