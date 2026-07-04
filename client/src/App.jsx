import ChatApp from './components/ChatApp'
import ChatWidget from './components/ChatWidget'

const isWidgetEmbed =
  typeof window !== 'undefined' &&
  (window.location.pathname === '/widget' || window.location.pathname === '/widget/')

// Standalone chat page at / — floating embed widget at /widget (for GHL iframe).
export default function App() {
  return isWidgetEmbed ? <ChatWidget /> : <ChatApp />
}
