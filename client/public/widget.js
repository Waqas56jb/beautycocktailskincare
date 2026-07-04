/**
 * Beauty Cocktail Skincare — Martini chat widget loader.
 * Paste ONCE in the site/GHL footer:
 *   <script src="https://beautycocktailskincare-client.vercel.app/widget.js" defer></script>
 *
 * The iframe only occupies the bottom-right corner when closed (so the page
 * scrolls & clicks normally) and expands only while the chat is open. Sizing is
 * driven by postMessage from the widget.
 */
;(function () {
  if (window.__bcsWidgetLoaded) return
  window.__bcsWidgetLoaded = true

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]')
  var baseUrl =
    (script && script.src ? script.src.replace(/\/widget\.js(\?.*)?$/, '') : null) ||
    'https://beautycocktailskincare-client.vercel.app'
  var origin
  try {
    origin = new URL(baseUrl).origin
  } catch (e) {
    origin = '*'
  }

  var iframe
  var isOpen = false

  function applySize() {
    if (!iframe) return
    var mobile = window.innerWidth < 480
    if (isOpen) {
      // Expanded — the chat panel is visible.
      iframe.style.width = mobile ? '100%' : '420px'
      iframe.style.height = mobile ? '100%' : 'min(760px, 100vh)'
    } else {
      // Collapsed — only the launcher bubble (+ tooltip) needs room, so the rest
      // of the page stays fully scrollable / clickable.
      iframe.style.width = mobile ? '150px' : '320px'
      iframe.style.height = mobile ? '150px' : '160px'
    }
  }

  function mount() {
    if (document.getElementById('bcs-chat-widget')) return

    iframe = document.createElement('iframe')
    iframe.id = 'bcs-chat-widget'
    iframe.src = baseUrl + '/widget'
    iframe.title = 'Chat with Martini — Beauty Cocktail Skincare'
    iframe.setAttribute('allow', 'clipboard-write')
    iframe.setAttribute('loading', 'lazy')
    iframe.style.cssText = [
      'position:fixed',
      'bottom:0',
      'right:0',
      'border:none',
      'z-index:2147483646',
      'background:transparent',
      'color-scheme:light',
      'transition:width .25s ease, height .25s ease',
    ].join(';')

    document.body.appendChild(iframe)
    applySize()
  }

  // The widget (inside the iframe) tells us when it opens/closes so we can resize.
  window.addEventListener('message', function (e) {
    if (origin !== '*' && e.origin !== origin) return
    var d = e.data
    if (!d || d.type !== 'bcs-widget') return
    isOpen = d.state === 'open'
    applySize()
  })

  window.addEventListener('resize', applySize)

  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
