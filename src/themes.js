// Design themes. Each theme emulates a set of saved references (see
// data/design-references.json). The generator picks the theme that best fits
// the creator's archetype/concept, and the store is styled to match it.
//
// A theme = CSS variable overrides (applied on <body> at render time) + a
// `sans` flag (serif vs bold-sans headlines) + the references it emulates.

export const THEMES = {
  // insight / analysis → sharp editorial (Linear · Vercel · Bento · Godly)
  editorial: {
    key: 'editorial', name: 'Editorial', sans: false,
    refs: ['Bento', 'Godly', 'Linear'],
    vars: {
      '--brand': '#5b3df5', '--brand-2': '#7c3aed', '--brand-soft': '#f1ecff',
      '--accent': '#ff5a36', '--bg': '#ffffff', '--cream': '#faf9f7', '--surface': '#f4f4f2',
      '--line': '#e9e9e6', '--ink': '#0e0f13', '--ink-2': '#545a66',
      '--grad': 'linear-gradient(115deg,#5b3df5,#7c3aed 55%,#b14bf0)', '--radius-lg': '24px',
    },
  },
  // education / how-to → clean academy (인프런 · Class101 · Podia · Refero)
  academy: {
    key: 'academy', name: 'Academy', sans: true,
    refs: ['인프런', 'Class101', 'Podia'],
    vars: {
      '--brand': '#2563eb', '--brand-2': '#1d4ed8', '--brand-soft': '#eaf1ff',
      '--accent': '#06b6d4', '--bg': '#ffffff', '--cream': '#f7f9fc', '--surface': '#eef2f8',
      '--line': '#e3e9f2', '--ink': '#0f172a', '--ink-2': '#475569',
      '--grad': 'linear-gradient(115deg,#2563eb,#0ea5e9)', '--radius-lg': '18px',
    },
  },
  // review / commerce → bold boutique (Gumroad · Bento · 크몽 · 클래스101)
  boutique: {
    key: 'boutique', name: 'Boutique', sans: false,
    refs: ['Gumroad', 'Fourthwall', '크몽'],
    vars: {
      '--brand': '#e21f6e', '--brand-2': '#c81d62', '--brand-soft': '#ffe9f2',
      '--accent': '#f59e0b', '--bg': '#fffdfa', '--cream': '#fff5ec', '--surface': '#fdeede',
      '--line': '#f0e3d4', '--ink': '#1a1208', '--ink-2': '#6b5d4d',
      '--grad': 'linear-gradient(115deg,#e21f6e,#f59e0b)', '--radius-lg': '22px',
    },
  },
  // asmr / music / healing → calm serene (Godly minimal · Land-book)
  serene: {
    key: 'serene', name: 'Serene', sans: false,
    refs: ['Godly', 'Land-book'],
    vars: {
      '--brand': '#0d9488', '--brand-2': '#0f766e', '--brand-soft': '#e6f4f1',
      '--accent': '#84cc16', '--bg': '#fdfdfb', '--cream': '#f4f7f4', '--surface': '#eaefea',
      '--line': '#e3eae5', '--ink': '#19241f', '--ink-2': '#5b6b62',
      '--grad': 'linear-gradient(115deg,#0d9488,#5eead4)', '--radius-lg': '26px',
    },
  },
  // coaching / fitness → energetic coach (Stan · 탈잉)
  coach: {
    key: 'coach', name: 'Coach', sans: true,
    refs: ['Stan Store', '탈잉'],
    vars: {
      '--brand': '#f97316', '--brand-2': '#ea580c', '--brand-soft': '#fff0e6',
      '--accent': '#ef4444', '--bg': '#ffffff', '--cream': '#fff7f1', '--surface': '#ffeee2',
      '--line': '#f3e2d5', '--ink': '#1a1206', '--ink-2': '#6b5847',
      '--grad': 'linear-gradient(115deg,#f97316,#ef4444)', '--radius-lg': '20px',
    },
  },
  // finance / investing → premium capital (Kajabi · Patreon premium)
  capital: {
    key: 'capital', name: 'Capital', sans: false,
    refs: ['Kajabi', 'Patreon'],
    vars: {
      '--brand': '#0f766e', '--brand-2': '#115e59', '--brand-soft': '#e7f0ee',
      '--accent': '#c2922b', '--bg': '#ffffff', '--cream': '#f8f7f3', '--surface': '#efeee8',
      '--line': '#e7e5dc', '--ink': '#0c1411', '--ink-2': '#4d574f',
      '--grad': 'linear-gradient(115deg,#115e59,#0f766e 60%,#c2922b)', '--radius-lg': '14px',
    },
  },
  // default / all-rounder → vibrant creator (Stan · Linktree · Beacons · Bento)
  creator: {
    key: 'creator', name: 'Creator', sans: true,
    refs: ['Stan Store', 'Linktree', 'Beacons'],
    vars: {
      '--brand': '#7c3aed', '--brand-2': '#db2777', '--brand-soft': '#f6ecff',
      '--accent': '#f59e0b', '--bg': '#ffffff', '--cream': '#faf7fd', '--surface': '#f3edf9',
      '--line': '#ece5f3', '--ink': '#15101c', '--ink-2': '#5b5266',
      '--grad': 'linear-gradient(115deg,#7c3aed,#db2777)', '--radius-lg': '24px',
    },
  },
};

// archetype → best-fit theme
const MAP = {
  insight: 'editorial',
  educator: 'academy',
  commerce: 'boutique',
  relax: 'serene',
  coach: 'coach',
  finance: 'capital',
  creator: 'creator',
};

/** Pick the theme that best fits the creator's archetype. */
export function pickTheme(archetype) {
  const t = THEMES[MAP[archetype]] || THEMES.creator;
  return { key: t.key, name: t.name, sans: t.sans, refs: t.refs, vars: t.vars };
}
