import './App.css';
import { ChatInput } from './components/ChatInput';
import { Live2DCanvas } from './components/Live2DCanvas';

function App() {
  return (
    <div className="app">
      <Live2DCanvas />
      <ChatInput />
      {/* <DebugPanel /> */}
    </div>
  );
}

export default App;
