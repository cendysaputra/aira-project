import './App.css';
import { useEffect } from 'react';
import { Live2DCanvas } from './components/Live2DCanvas';
import { autoTalkController } from './lib/autotalk-controller';

function App() {
  useEffect(() => {
    autoTalkController.start();

    return () => {
      autoTalkController.stop();
    };
  }, []);

  return (
    <div className="app">
      <Live2DCanvas />
    </div>
  );
}

export default App;
