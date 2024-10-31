import MiniKitProvider from "./minikit-provider.tsx";
import ChatInterface from './components/ChatInterface'

function App() {
  return (
    <MiniKitProvider>
      <ChatInterface />
    </MiniKitProvider>
  )
}

export default App