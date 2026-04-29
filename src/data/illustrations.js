import React from "react";

/* ══════════════════════════════════════════════════════════════
   HAND-DRAWN LINE-ART SVG ILLUSTRATION LIBRARY
   ──────────────────────────────────────────────────────────────
   Style: Thin strokes (1.2–1.8px), no fills (or minimal vermillion),
   "stamped" vintage feel matching the Nori ramen reference.
   Stroke weight matches typography border weights for cohesion.
   ══════════════════════════════════════════════════════════════ */

const S = 1.5; // Base stroke width — matches border/font weight

// ═══════════════════════════════════════════
// CITY HERO ILLUSTRATIONS — Large decorative SVGs
// ═══════════════════════════════════════════

export const CityIllustrations = {
  Tokyo: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Tokyo Tower */}
      <line x1="80" y1="110" x2="90" y2="20" stroke={accent} strokeWidth={S} strokeLinecap="round"/>
      <line x1="100" y1="110" x2="90" y2="20" stroke={accent} strokeWidth={S} strokeLinecap="round"/>
      <line x1="83" y1="65" x2="97" y2="65" stroke={accent} strokeWidth={S}/>
      <line x1="85" y1="80" x2="95" y2="80" stroke={accent} strokeWidth={S}/>
      {/* Skyscrapers */}
      <rect x="20" y="50" width="12" height="60" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <rect x="36" y="35" width="10" height="75" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <rect x="50" y="55" width="14" height="55" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <rect x="120" y="40" width="11" height="70" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <rect x="135" y="60" width="15" height="50" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <rect x="155" y="45" width="9" height="65" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      {/* Windows */}
      {[22,24,26,28].map(y => <line key={y} x1="23" y1={y+35} x2="29" y2={y+35} stroke={color} strokeWidth="0.5" opacity="0.3"/>)}
      {/* Neon sign */}
      <text x="140" y="75" fontSize="4" fill={accent} fontFamily="sans-serif" opacity="0.6">ネオン</text>
      {/* Ground line */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
      {/* Cherry blossom petals */}
      <circle cx="170" cy="25" r="2" fill={accent} opacity="0.3"/>
      <circle cx="178" cy="18" r="1.5" fill={accent} opacity="0.2"/>
      <circle cx="165" cy="15" r="1.8" fill={accent} opacity="0.25"/>
      <circle cx="30" cy="20" r="2" fill={accent} opacity="0.2"/>
      <circle cx="22" cy="28" r="1.5" fill={accent} opacity="0.15"/>
    </svg>
  ),

  Kyoto: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Torii gate */}
      <line x1="30" y1="30" x2="70" y2="30" stroke={accent} strokeWidth={S * 1.2} strokeLinecap="round"/>
      <line x1="33" y1="36" x2="67" y2="36" stroke={accent} strokeWidth={S}/>
      <line x1="38" y1="36" x2="38" y2="110" stroke={accent} strokeWidth={S}/>
      <line x1="62" y1="36" x2="62" y2="110" stroke={accent} strokeWidth={S}/>
      {/* Second torii (smaller, behind) */}
      <line x1="42" y1="45" x2="58" y2="45" stroke={accent} strokeWidth={S * 0.7} opacity="0.4"/>
      <line x1="45" y1="45" x2="45" y2="110" stroke={accent} strokeWidth={S * 0.5} opacity="0.4"/>
      <line x1="55" y1="45" x2="55" y2="110" stroke={accent} strokeWidth={S * 0.5} opacity="0.4"/>
      {/* Pagoda */}
      <line x1="130" y1="25" x2="130" y2="110" stroke={color} strokeWidth={S * 0.6}/>
      {[30, 45, 60, 75, 90].map((y, i) => (
        <path key={i} d={`M${118+i*1.5} ${y} Q130 ${y-6} ${142-i*1.5} ${y}`} stroke={color} strokeWidth={S * 0.8}/>
      ))}
      {/* Bamboo */}
      <line x1="170" y1="10" x2="170" y2="110" stroke={color} strokeWidth={S * 0.5} opacity="0.5"/>
      <line x1="177" y1="15" x2="177" y2="110" stroke={color} strokeWidth={S * 0.5} opacity="0.4"/>
      <line x1="183" y1="20" x2="183" y2="110" stroke={color} strokeWidth={S * 0.5} opacity="0.3"/>
      {/* Bamboo leaves */}
      <path d="M170 30 Q165 25 160 28" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <path d="M170 50 Q175 45 180 48" stroke={color} strokeWidth="0.8" opacity="0.35"/>
      <path d="M177 35 Q182 30 187 33" stroke={color} strokeWidth="0.8" opacity="0.3"/>
      {/* Path stones */}
      {[85, 92, 100, 108].map(x => <ellipse key={x} cx={x} cy="108" rx="3" ry="1.5" stroke={color} strokeWidth="0.6" opacity="0.3"/>)}
      {/* Ground */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
      {/* Petals */}
      <circle cx="95" cy="18" r="2" fill={accent} opacity="0.25"/>
      <circle cx="102" cy="12" r="1.5" fill={accent} opacity="0.2"/>
      <circle cx="88" cy="22" r="1.8" fill={accent} opacity="0.15"/>
    </svg>
  ),

  Osaka: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Osaka Castle */}
      <rect x="70" y="60" width="60" height="50" rx="1" stroke={color} strokeWidth={S}/>
      <path d="M65 60 L100 30 L135 60" stroke={color} strokeWidth={S} strokeLinecap="round"/>
      <path d="M72 45 L100 22 L128 45" stroke={color} strokeWidth={S * 0.8} opacity="0.7"/>
      {/* Castle details */}
      <line x1="100" y1="30" x2="100" y2="22" stroke={accent} strokeWidth={S * 0.8}/>
      <rect x="90" y="75" width="20" height="25" rx="1" stroke={color} strokeWidth={S * 0.7}/>
      {[78,85,108,115].map(x => <rect key={x} x={x} y="68" width="4" height="6" stroke={color} strokeWidth="0.6" opacity="0.4"/>)}
      {/* Dotonbori sign (neon) */}
      <rect x="15" y="55" width="35" height="18" rx="2" stroke={accent} strokeWidth={S * 0.8}/>
      <text x="20" y="67" fontSize="6" fill={accent} fontFamily="sans-serif" opacity="0.7">道頓堀</text>
      {/* Takoyaki */}
      <circle cx="160" cy="85" r="5" stroke={color} strokeWidth={S * 0.7}/>
      <circle cx="172" cy="85" r="5" stroke={color} strokeWidth={S * 0.7}/>
      <circle cx="166" cy="75" r="5" stroke={color} strokeWidth={S * 0.7}/>
      {/* Steam lines */}
      <path d="M160 68 Q162 62 160 56" stroke={color} strokeWidth="0.6" opacity="0.3"/>
      <path d="M166 65 Q168 59 166 53" stroke={color} strokeWidth="0.6" opacity="0.25"/>
      <path d="M172 68 Q174 62 172 56" stroke={color} strokeWidth="0.6" opacity="0.2"/>
      {/* Ground */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
    </svg>
  ),

  Fuji: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mt Fuji */}
      <path d="M30 110 L100 15 L170 110" stroke={color} strokeWidth={S * 1.2} strokeLinecap="round" strokeLinejoin="round"/>
      {/* Snow cap */}
      <path d="M80 42 L100 15 L120 42 Q110 50 100 48 Q90 50 80 42Z" stroke={color} strokeWidth={S} fill="#FDFBF5"/>
      {/* Clouds */}
      <path d="M55 55 Q65 48 75 55 Q85 48 95 55" stroke={color} strokeWidth="0.8" opacity="0.3"/>
      <path d="M120 45 Q128 40 136 45" stroke={color} strokeWidth="0.8" opacity="0.25"/>
      {/* Lake reflection */}
      <path d="M40 110 Q70 95 100 100 Q130 105 160 95" stroke={color} strokeWidth="0.8" opacity="0.2" strokeDasharray="3 3"/>
      {/* Pagoda */}
      <line x1="170" y1="50" x2="170" y2="110" stroke={accent} strokeWidth={S * 0.6}/>
      {[55, 65, 75, 85].map((y, i) => (
        <path key={i} d={`M${164+i} ${y} Q170 ${y-4} ${176-i} ${y}`} stroke={accent} strokeWidth={S * 0.6}/>
      ))}
      {/* Cherry tree */}
      <line x1="25" y1="70" x2="25" y2="110" stroke={color} strokeWidth={S * 0.6}/>
      <circle cx="25" cy="62" r="10" stroke={accent} strokeWidth="0.8" opacity="0.4"/>
      <circle cx="20" cy="58" r="8" stroke={accent} strokeWidth="0.6" opacity="0.3"/>
      <circle cx="30" cy="56" r="7" stroke={accent} strokeWidth="0.6" opacity="0.25"/>
      {/* Petals falling */}
      <circle cx="18" cy="80" r="1.5" fill={accent} opacity="0.2"/>
      <circle cx="32" cy="85" r="1" fill={accent} opacity="0.15"/>
      {/* Ground */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
    </svg>
  ),

  Nara: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Deer */}
      <path d="M55 75 Q50 55 55 45 Q58 40 62 45 L65 55 Q68 60 70 58 L73 50 Q75 46 77 50 L78 58 Q80 62 82 65 L85 75" stroke={color} strokeWidth={S} strokeLinecap="round" fill="none"/>
      <ellipse cx="70" cy="80" rx="18" ry="8" stroke={color} strokeWidth={S * 0.8}/>
      <line x1="58" y1="88" x2="55" y2="108" stroke={color} strokeWidth={S * 0.7}/>
      <line x1="65" y1="88" x2="63" y2="108" stroke={color} strokeWidth={S * 0.7}/>
      <line x1="75" y1="88" x2="77" y2="108" stroke={color} strokeWidth={S * 0.7}/>
      <line x1="82" y1="88" x2="85" y2="108" stroke={color} strokeWidth={S * 0.7}/>
      {/* Antlers */}
      <path d="M62 45 Q58 35 55 30" stroke={color} strokeWidth="0.8"/>
      <path d="M55 30 Q52 25 50 28" stroke={color} strokeWidth="0.6"/>
      <path d="M55 30 Q58 25 56 22" stroke={color} strokeWidth="0.6"/>
      <path d="M65 45 Q68 36 72 32" stroke={color} strokeWidth="0.8"/>
      <path d="M72 32 Q75 28 73 25" stroke={color} strokeWidth="0.6"/>
      {/* Temple in background */}
      <rect x="130" y="55" width="50" height="55" rx="1" stroke={color} strokeWidth={S * 0.6} opacity="0.4"/>
      <path d="M125 55 L155 30 L185 55" stroke={color} strokeWidth={S * 0.6} opacity="0.4"/>
      {/* Ground */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
      {/* Petals */}
      <circle cx="110" cy="20" r="2" fill={accent} opacity="0.2"/>
      <circle cx="118" cy="28" r="1.5" fill={accent} opacity="0.15"/>
      <circle cx="35" cy="50" r="1.8" fill={accent} opacity="0.2"/>
    </svg>
  ),

  Disney: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Castle */}
      <rect x="75" y="50" width="50" height="60" rx="1" stroke={color} strokeWidth={S}/>
      <path d="M70 50 L100 25 L130 50" stroke={color} strokeWidth={S}/>
      {/* Towers */}
      <rect x="65" y="40" width="12" height="70" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <path d="M63 40 L71 20 L79 40" stroke={color} strokeWidth={S * 0.8}/>
      <rect x="123" y="40" width="12" height="70" rx="1" stroke={color} strokeWidth={S * 0.8}/>
      <path d="M121 40 L129 20 L137 40" stroke={color} strokeWidth={S * 0.8}/>
      {/* Center spire */}
      <line x1="100" y1="25" x2="100" y2="8" stroke={accent} strokeWidth={S}/>
      <circle cx="100" cy="6" r="2" fill={accent} opacity="0.4"/>
      {/* Gate */}
      <path d="M90 110 L90 80 Q100 72 110 80 L110 110" stroke={color} strokeWidth={S * 0.8}/>
      {/* Stars */}
      {[[35,20],[165,15],[150,35],[45,40],[25,60]].map(([x,y],i) => (
        <path key={i} d={`M${x} ${y-3} L${x+1} ${y-1} L${x+3} ${y} L${x+1} ${y+1} L${x} ${y+3} L${x-1} ${y+1} L${x-3} ${y} L${x-1} ${y-1}Z`}
          stroke={accent} strokeWidth="0.5" fill={accent} opacity={0.15 + i * 0.05}/>
      ))}
      {/* Ground */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
    </svg>
  ),

  Onsen: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hot spring pool */}
      <ellipse cx="100" cy="95" rx="60" ry="18" stroke={color} strokeWidth={S}/>
      {/* Rocks */}
      <path d="M35 90 Q30 80 40 75 Q50 70 55 80 Q58 85 50 90" stroke={color} strokeWidth={S * 0.8}/>
      <path d="M145 88 Q150 75 160 78 Q168 82 165 90" stroke={color} strokeWidth={S * 0.8}/>
      <path d="M55 82 Q60 72 70 76 Q72 80 68 85" stroke={color} strokeWidth={S * 0.6} opacity="0.5"/>
      {/* Steam */}
      {[80, 100, 120].map((x, i) => (
        <path key={i} d={`M${x} 72 Q${x+5} 60 ${x-2} 48 Q${x+3} 36 ${x} 24`}
          stroke={color} strokeWidth="0.8" opacity={0.2 + i * 0.05} strokeLinecap="round"/>
      ))}
      {/* Mountains behind */}
      <path d="M10 80 L50 40 L80 70 L120 30 L160 65 L190 45 L190 80" stroke={color} strokeWidth={S * 0.5} opacity="0.2"/>
      {/* Ground */}
      <line x1="10" y1="110" x2="190" y2="110" stroke={color} strokeWidth={S * 0.6} strokeDasharray="2 4"/>
      {/* 温 character */}
      <text x="160" y="55" fontSize="12" fill={accent} fontFamily="serif" opacity="0.15">♨</text>
    </svg>
  ),

  Food: ({ w = 200, h = 120, color = "#1C1917", accent = "#D94025" }) => (
    <svg width={w} height={h} viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ramen bowl */}
      <ellipse cx="100" cy="75" rx="50" ry="12" stroke={color} strokeWidth={S}/>
      <path d="M50 75 Q50 110 100 110 Q150 110 150 75" stroke={color} strokeWidth={S}/>
      {/* Noodles */}
      <path d="M70 75 Q75 85 70 95" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <path d="M85 75 Q88 88 83 98" stroke={color} strokeWidth="0.8" opacity="0.35"/>
      <path d="M100 75 Q103 90 98 100" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <path d="M115 75 Q118 85 113 95" stroke={color} strokeWidth="0.8" opacity="0.35"/>
      {/* Egg */}
      <ellipse cx="120" cy="70" rx="8" ry="5" stroke={accent} strokeWidth="0.8"/>
      {/* Chopsticks */}
      <line x1="115" y1="40" x2="135" y2="80" stroke={color} strokeWidth={S}/>
      <line x1="120" y1="38" x2="140" y2="78" stroke={color} strokeWidth={S}/>
      {/* Steam */}
      <path d="M80 55 Q83 45 78 35" stroke={color} strokeWidth="0.7" opacity="0.25"/>
      <path d="M95 50 Q98 40 93 30" stroke={color} strokeWidth="0.7" opacity="0.3"/>
      <path d="M110 52 Q113 42 108 32" stroke={color} strokeWidth="0.7" opacity="0.25"/>
      {/* うまい! text */}
      <text x="150" y="55" fontSize="8" fill={accent} fontFamily="sans-serif" opacity="0.4" transform="rotate(-10 150 55)">うまい!</text>
      {/* Petals */}
      <circle cx="35" cy="30" r="2" fill={accent} opacity="0.2"/>
      <circle cx="170" cy="25" r="1.5" fill={accent} opacity="0.15"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// MAP DAY MARKER ICONS — Tiny city-specific shapes inside pins
// ═══════════════════════════════════════════

export const CityMarkerIcon = {
  // Tiny skyscraper (Tokyo)
  Tokyo: (color) => (
    <g>
      <rect x="16" y="12" width="3" height="10" stroke={color} strokeWidth="0.8" fill="none"/>
      <rect x="20.5" y="14" width="3.5" height="8" stroke={color} strokeWidth="0.8" fill="none"/>
    </g>
  ),
  // Tiny torii (Kyoto)
  Kyoto: (color) => (
    <g>
      <line x1="15" y1="14" x2="25" y2="14" stroke={color} strokeWidth="1"/>
      <line x1="17" y1="14" x2="17" y2="22" stroke={color} strokeWidth="0.8"/>
      <line x1="23" y1="14" x2="23" y2="22" stroke={color} strokeWidth="0.8"/>
    </g>
  ),
  // Tiny castle (Osaka)
  Osaka: (color) => (
    <g>
      <rect x="16" y="16" width="8" height="6" stroke={color} strokeWidth="0.8" fill="none"/>
      <path d="M15 16 L20 11 L25 16" stroke={color} strokeWidth="0.8" fill="none"/>
    </g>
  ),
  // Tiny deer (Nara)
  Nara: (color) => (
    <g>
      <circle cx="20" cy="16" r="3" stroke={color} strokeWidth="0.8" fill="none"/>
      <line x1="18" y1="13" x2="17" y2="10" stroke={color} strokeWidth="0.6"/>
      <line x1="22" y1="13" x2="23" y2="10" stroke={color} strokeWidth="0.6"/>
    </g>
  ),
  // Tiny mountain (Fuji / Hakone / Kawaguchiko)
  Fuji: (color) => (
    <g>
      <path d="M14 22 L20 10 L26 22" stroke={color} strokeWidth="1" fill="none"/>
      <path d="M17 14 L20 10 L23 14" stroke={color} strokeWidth="0.6" fill="#FDFBF5"/>
    </g>
  ),
  // Castle for Disney
  Disney: (color) => (
    <g>
      <rect x="17" y="16" width="6" height="6" stroke={color} strokeWidth="0.7" fill="none"/>
      <path d="M16 16 L20 11 L24 16" stroke={color} strokeWidth="0.7" fill="none"/>
      <line x1="20" y1="11" x2="20" y2="8" stroke={color} strokeWidth="0.6"/>
    </g>
  ),
  // Ski/mountain (Takayama, Matsumoto)
  Mountain: (color) => (
    <g>
      <path d="M13 22 L18 12 L23 22" stroke={color} strokeWidth="0.8" fill="none"/>
      <path d="M18 22 L24 14 L28 22" stroke={color} strokeWidth="0.7" fill="none" opacity="0.6"/>
    </g>
  ),
  // Garden (Kanazawa)
  Garden: (color) => (
    <g>
      <circle cx="20" cy="14" r="5" stroke={color} strokeWidth="0.8" fill="none"/>
      <line x1="20" y1="19" x2="20" y2="23" stroke={color} strokeWidth="0.8"/>
      <path d="M16 14 Q20 10 24 14" stroke={color} strokeWidth="0.5" opacity="0.4"/>
    </g>
  ),
  // Bowl (Nagoya — food city)
  Bowl: (color) => (
    <g>
      <path d="M14 15 Q14 22 20 22 Q26 22 26 15" stroke={color} strokeWidth="0.8" fill="none"/>
      <line x1="13" y1="15" x2="27" y2="15" stroke={color} strokeWidth="0.8"/>
      <path d="M18 10 Q19 12 18 14" stroke={color} strokeWidth="0.4" opacity="0.4"/>
      <path d="M22 10 Q23 12 22 14" stroke={color} strokeWidth="0.4" opacity="0.4"/>
    </g>
  ),
};

// Map city names to marker icon type
export const cityToMarkerIcon = {
  "Tokyo": "Tokyo",
  "Tokyo Disney": "Disney",
  "Tokyo DisneySea": "Disney",
  "Kanazawa": "Garden",
  "Takayama": "Mountain",
  "Matsumoto": "Mountain",
  "Nagoya": "Bowl",
  "Osaka": "Osaka",
  "Osaka Universal": "Disney",
  "Nara": "Nara",
  "Kyoto": "Kyoto",
  "Kawaguchiko": "Fuji",
  "Hakone": "Fuji",
};

// Map city names to hero illustration
export const cityToHeroIllustration = {
  "Tokyo": "Tokyo",
  "Tokyo Disney": "Disney",
  "Tokyo DisneySea": "Disney",
  "Kanazawa": "Kyoto",  // garden aesthetic
  "Takayama": "Fuji",
  "Matsumoto": "Onsen",
  "Nagoya": "Food",
  "Osaka": "Osaka",
  "Osaka Universal": "Disney",
  "Nara": "Nara",
  "Kyoto": "Kyoto",
  "Kawaguchiko": "Fuji",
  "Hakone": "Onsen",
};

// ═══════════════════════════════════════════
// ACTIVITY LINE-ART ICONS — Small inline decorative
// Stroke weight 1.5 matches font/border weight
// ═══════════════════════════════════════════

export const ActivityIcons = {
  shrine: ({ size = 16, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="10" x2="7" y2="22"/><line x1="17" y1="10" x2="17" y2="22"/>
      <path d="M10 7 L12 3 L14 7" opacity="0.5"/>
    </svg>
  ),
  viewpoint: ({ size = 16, color = "#1C1917" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/><path d="M2 12 Q7 5 12 5 Q17 5 22 12 Q17 19 12 19 Q7 19 2 12Z"/>
    </svg>
  ),
  walk: ({ size = 16, color = "#1C1917" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2"/><path d="M10 22l1-7"/><path d="M17 14l-4-1-2-4-3 4 4 1 1 5"/><path d="M7 9l3-1"/>
    </svg>
  ),
  train: ({ size = 16, color = "#1C1917" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="14" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="12" y1="3" x2="12" y2="11"/>
      <circle cx="8" cy="20" r="1"/><circle cx="16" cy="20" r="1"/><line x1="8" y1="17" x2="8" y2="19"/><line x1="16" y1="17" x2="16" y2="19"/>
    </svg>
  ),
  food: ({ size = 16, color = "#C4A048" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>
    </svg>
  ),
  coffee: ({ size = 16, color = "#78716C" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
    </svg>
  ),
  shopping: ({ size = 16, color = "#1C1917" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  park: ({ size = 16, color = "#5C7A2E" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 22V8"/><path d="M5 12 L12 4 L19 12" /><path d="M7 16 L12 10 L17 16"/>
    </svg>
  ),
  camera: ({ size = 16, color = "#78716C" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  onsen: ({ size = 16, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 18 Q4 22 12 22 Q20 22 20 18"/><ellipse cx="12" cy="18" rx="8" ry="3"/>
      <path d="M8 12 Q9 8 8 4"/><path d="M12 12 Q13 8 12 4"/><path d="M16 12 Q17 8 16 4"/>
    </svg>
  ),
};

export default { CityIllustrations, CityMarkerIcon, cityToMarkerIcon, cityToHeroIllustration, ActivityIcons };
