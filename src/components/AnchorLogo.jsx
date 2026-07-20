export default function AnchorLogo({size=40, color="#6A9BB5"}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 58 Q25 50 40 58 Q55 66 70 58 Q85 50 92 54" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <line x1="50" y1="22" x2="50" y2="72" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="50" cy="15" r="6" stroke={color} strokeWidth="3.5" fill="none"/>
      <line x1="34" y1="32" x2="66" y2="32" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <path d="M50 72 Q34 72 30 62 L36 64" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M50 72 Q66 72 70 62 L64 64" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
