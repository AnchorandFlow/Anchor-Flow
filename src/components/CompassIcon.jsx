export default function CompassIcon({size=24, color="#fff"}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.6" fill="none"/>
      <polygon points="12,4.5 13.5,11 12,13 10.5,11" fill={color} opacity="0.95"/>
      <polygon points="12,19.5 10.5,13 12,11 13.5,13" fill={color} opacity="0.45"/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
    </svg>
  );
}
