import { useState } from 'react'
import ChatHeader from './ChatHeader'
import WelcomeScreen from './WelcomeScreen'
import ChatScreen from './ChatScreen'
import { brand } from '../lib/brand'

// Full-screen on mobile, centered card on larger screens — matches the
// reference layout. Two screens: the welcome cover and the live chat.
export default function ChatApp() {
  const [started, setStarted] = useState(false)

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black sm:p-4">
      <div className="relative flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-gradient-to-b from-[#f6f0e5] to-[#efe6d4] sm:h-[88vh] sm:max-h-[820px] sm:rounded-[28px] sm:shadow-2xl">
        <ChatHeader onClose={() => setStarted(false)} />

        {started ? <ChatScreen /> : <WelcomeScreen onStart={() => setStarted(true)} />}

        <footer className="px-4 py-3 text-center text-[11px] text-[#a99f7d]">
          {brand.footer}
        </footer>
      </div>
    </div>
  )
}
