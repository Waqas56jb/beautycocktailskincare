import { useEffect, useState } from 'react'
import ChatHeader from './ChatHeader'
import WelcomeScreen from './WelcomeScreen'
import ChatScreen from './ChatScreen'
import Avatar from './Avatar'
import { ChatBubbleIcon, CloseIcon } from './icons'
import { useChat } from '../hooks/useChat'
import { brand } from '../lib/brand'

// Floating embed widget — transparent backdrop for iframe use on GHL / any site.
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const chat = useChat()

  useEffect(() => {
    document.documentElement.classList.add('widget-embed')
    document.body.classList.add('widget-embed')
    return () => {
      document.documentElement.classList.remove('widget-embed')
      document.body.classList.remove('widget-embed')
    }
  }, [])

  // Tell the embedding loader (parent page) to resize the iframe: tiny when
  // closed (so the host page scrolls freely), expanded when open.
  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'bcs-widget', state: open ? 'open' : 'closed' }, '*')
    }
  }, [open])

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const handleStart = () => setStarted(true)

  return (
    <div className="widget-root" aria-live="polite">
      <div
        className={`widget-panel ${open ? 'widget-panel--open' : 'widget-panel--closed'}`}
        role="dialog"
        aria-label={`Chat with ${brand.botName}`}
        aria-hidden={!open}
      >
        <div className="widget-panel__inner">
          <ChatHeader onClose={handleClose} />

          {started ? (
            <ChatScreen chat={chat} />
          ) : (
            <WelcomeScreen onStart={handleStart} compact />
          )}

          <footer className="widget-panel__footer">{brand.footer}</footer>
        </div>
      </div>

      <div className="widget-launcher-wrap">
        {!open && (
          <button
            type="button"
            className="widget-tooltip"
            onClick={handleOpen}
            aria-label={`Open chat with ${brand.botName}`}
          >
            <span className="widget-tooltip__dot" aria-hidden="true" />
            Chat with {brand.botName}
          </button>
        )}

        <button
          type="button"
          className={`widget-launcher ${open ? 'widget-launcher--open' : ''}`}
          onClick={open ? handleClose : handleOpen}
          aria-label={open ? 'Close chat' : `Open chat with ${brand.botName}`}
          aria-expanded={open}
        >
          <span className="widget-launcher__ring" aria-hidden="true" />
          <span className="widget-launcher__ring widget-launcher__ring--delay" aria-hidden="true" />

          <span className="widget-launcher__face">
            {open ? (
              <CloseIcon className="h-6 w-6 text-white" />
            ) : (
              <>
                <Avatar size={56} online />
                <span className="widget-launcher__badge" aria-hidden="true">
                  <ChatBubbleIcon className="h-3.5 w-3.5" />
                </span>
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
