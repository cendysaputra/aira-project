import './App.css';
import { useEffect } from 'react';
import { ChatInput } from './components/ChatInput';
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
      <ChatInput />
      {/* <DebugPanel /> */}
    </div>
  );
}

export default App;
