/**
 * Beauty Cocktail Skincare — Martini chat widget loader.
 * Paste in GHL footer (or any site):
 *   <script src="https://beautycocktailskincare-client.vercel.app/widget.js" defer></script>
 */
;(function () {
  if (window.__bcsWidgetLoaded) return
  window.__bcsWidgetLoaded = true

  var script =
    document.currentScript || document.querySelector('script[src*="widget.js"]')
  var baseUrl =
    (script && script.src
      ? script.src.replace(/\/widget\.js(\?.*)?$/, '')
      : null) || 'https://beautycocktailskincare-client.vercel.app'

  function mount() {
    if (document.getElementById('bcs-chat-widget')) return

    var iframe = document.createElement('iframe')
    iframe.id = 'bcs-chat-widget'
    iframe.src = baseUrl + '/widget'
    iframe.title = 'Chat with Martini — Beauty Cocktail Skincare'
    iframe.setAttribute('allow', 'clipboard-write')
    iframe.setAttribute('loading', 'lazy')
    iframe.style.cssText = [
      'position:fixed',
      'bottom:0',
      'right:0',
      'width:100%',
      'height:100%',
      'border:none',
      'z-index:2147483646',
      'background:transparent',
      'pointer-events:none',
      'color-scheme:light',
    ].join(';')

    document.body.appendChild(iframe)
  }

  if (document.body) {
    mount()
  } else {
    document.addEventListener('DOMContentLoaded', mount)
  }
})()
