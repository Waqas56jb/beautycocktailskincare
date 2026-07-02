// Dashboard design tokens. Chrome is brand olive/cream; data marks use a
// CVD-validated categorical palette (validated with the dataviz palette script).
export const colors = {
  brand: '#6f6433', // olive — primary accent / single-series marks
  brandDark: '#39331a',
  ink: '#1c1a12',
  sub: '#6b6552',
  muted: '#98917a',
  good: '#0ca30c',
  bad: '#d03b3b',
  grid: '#ece7db',
  surface: '#ffffff',
}

// Fixed categorical order (never cycled). CVD-safe adjacency.
export const CATEGORICAL = ['#2a78d6', '#1baf7a', '#eda100', '#4a3aa7', '#e87ba4', '#eb6834']
