/**
 * The mascot as a plain SVG fragment (viewBox 0 0 200 200), shared by the
 * icon and promo-tile generators. Mirrors src/components/CatAvatar.tsx —
 * keep them in sync if the cat changes.
 *
 * `sw` is the body stroke width: 7 matches the app; pass more for tiny
 * raster sizes where thin strokes would dissolve.
 */
export const BODY = "#dccbea";
export const LINE = "#7d5878";

export const cat = (sw = 7) => `
  <g transform="rotate(4 100 100)">
    <g transform="rotate(22 78 100)">
      <rect x="24" y="87" width="58" height="26" rx="13" fill="${BODY}" stroke="${LINE}" stroke-width="${sw}"/>
      <circle cx="31" cy="94" r="2.6" fill="${LINE}"/>
      <circle cx="39" cy="91" r="2.6" fill="${LINE}"/>
      <circle cx="34" cy="103" r="4.2" fill="${LINE}"/>
    </g>
    <g transform="rotate(28 138 122)">
      <rect x="132" y="109" width="50" height="26" rx="13" fill="${BODY}" stroke="${LINE}" stroke-width="${sw}"/>
      <circle cx="172" cy="116" r="2.5" fill="${LINE}"/>
      <circle cx="177" cy="123" r="2.5" fill="${LINE}"/>
      <circle cx="168" cy="127" r="4" fill="${LINE}"/>
    </g>
    <path d="M 60 166 C 46 158 42 146 46 132 C 50 110 54 86 61 64 C 65 52 74 43 86 40 C 96 37 106 38 116 43 C 123 39 131 31 138 31 C 143 34 146 44 146 56 C 152 74 153 94 149 112 C 146 132 148 150 140 160 C 128 172 76 174 60 166 Z"
      fill="${BODY}" stroke="${LINE}" stroke-width="${sw}" stroke-linejoin="round"/>
    <circle cx="97" cy="76" r="4.5" fill="${LINE}"/>
    <circle cx="131" cy="86" r="4.5" fill="${LINE}"/>
    <path d="M 103 84 q 5 7 10.5 2 q 5.5 5 10.5 -2" stroke="${LINE}" stroke-width="${sw * 0.64}" stroke-linecap="round" fill="none"/>
  </g>`;
