// Single source of truth for branding + copy shown in the widget.
// Adjust text here to retune the bot's greeting, quick actions, etc.
export const brand = {
  name: 'Beauty Cocktail Skincare',
  short: 'Beauty Cocktail',
  letter: 'B',
  role: 'Skincare', // shown as "SKINCARE · ONLINE"
  botName: 'Martini',
  welcomeTitle: 'Welcome to Beauty Cocktail Skincare',
  welcomeText:
    "I'm Martini, your personal skincare assistant. Together we'll find the perfect facial for your skin — and get you booked in.",
  chatGreeting:
    "Hey! 👋 Welcome to Beauty Cocktail Skincare — I'm Martini, your skincare assistant. What can I help you with today? ✨",
  footer: 'Powered by Beauty Cocktail Skincare · Martini available 24/7',
}

// Quick-reply cards shown under the first message. Clicking one sends its
// label as the visitor's message, so the backend flow can pick it up.
export const quickOptions = [
  { icon: '💆‍♀️', label: 'Book a Facial (Free Consultation Included)' },
  { icon: '🔍', label: 'Tell Us Your Skin Concern' },
  { icon: '📍', label: 'See Prices & Location' },
]
