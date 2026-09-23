// Default Tactical Military Symbols as high-fidelity inline SVGs for the Custom Symbol Option
// Includes: Tank, Infantry, Communication Tower, Artillery Gun, plus Aerial Drone & Radar

export interface TacticalSvgPreset {
  id: string;
  name: string;
  label: string;
  category: 'armor' | 'infantry' | 'artillery' | 'communication' | 'aviation' | 'airdefense';
  defaultColor: string;
  description: string;
  svgRaw: string;
  dataUrl: string;
}

export const buildDataUrl = (svgString: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

/**
 * Replaces colors in tactical SVGs with a user-chosen color
 */
export const colorizeTacticalSvg = (svgRaw: string, targetColor: string): string => {
  // Replace stroke/fill hex codes with user's selected target color
  const colorized = svgRaw
    .replace(/(stroke|fill)="(#(?:ef4444|10b981|3b82f6|ec4899|38bdf8|f59e0b|60a5fa|93c5fd|f472b6))"/gi, `$1="${targetColor}"`);
  return buildDataUrl(colorized);
};

// 1. Tactical Main Battle Tank (Armored Tracked Combat Vehicle)
const TANK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- Tank Tracks / Chassis -->
  <rect x="14" y="58" width="72" height="24" rx="8" fill="#0f172a" stroke="#ef4444" stroke-width="4"/>
  <!-- Track Wheels -->
  <circle cx="25" cy="70" r="5" fill="#ef4444"/>
  <circle cx="41" cy="70" r="5" fill="#ef4444"/>
  <circle cx="59" cy="70" r="5" fill="#ef4444"/>
  <circle cx="75" cy="70" r="5" fill="#ef4444"/>
  <!-- Upper Hull -->
  <path d="M22 58 L28 42 L72 42 L78 58 Z" fill="#1e293b" stroke="#ef4444" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- Turret -->
  <path d="M36 42 L42 28 L62 28 L66 42 Z" fill="#0f172a" stroke="#ef4444" stroke-width="3.5" stroke-linejoin="round"/>
  <!-- Main Gun Barrel & Muzzle Brake -->
  <line x1="62" y1="35" x2="94" y2="35" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
  <rect x="88" y="32" width="6" height="6" rx="1" fill="#ef4444"/>
  <!-- Commander Hatch / Cupola -->
  <rect x="46" y="24" width="10" height="4" rx="1.5" fill="#ef4444"/>
</svg>`;

// 2. Infantry / Dismounted Troops (Tactical Soldier / Squad Silhouette)
const INFANTRY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- Tactical Ground Base -->
  <line x1="16" y1="88" x2="84" y2="88" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
  <!-- Primary Dismounted Infantry Operator -->
  <!-- Helmet & Head -->
  <ellipse cx="44" cy="22" rx="9" ry="8" fill="#10b981"/>
  <path d="M34 22 C34 16 54 16 54 22 Z" fill="#0f172a" stroke="#10b981" stroke-width="2"/>
  <!-- Night Vision / Tactical Visor -->
  <rect x="47" y="20" width="7" height="3" rx="1" fill="#38bdf8"/>
  <!-- Torso with Tactical Plate Carrier -->
  <path d="M35 32 L53 32 L51 58 L37 58 Z" fill="#1e293b" stroke="#10b981" stroke-width="3" stroke-linejoin="round"/>
  <!-- Tactical Rifle / Carbine (low-ready stance) -->
  <path d="M42 42 L68 38 L74 38 L74 42 L64 44 L58 52" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Legs in Stance -->
  <path d="M39 58 L33 86 M49 58 L55 86" stroke="#10b981" stroke-width="4.5" stroke-linecap="round"/>
  <!-- Secondary Squad Member (Background Stance) -->
  <ellipse cx="68" cy="30" rx="7" ry="6" fill="#10b981" opacity="0.6"/>
  <path d="M62 38 L74 38 L72 58 L64 58 Z" fill="#0f172a" stroke="#10b981" stroke-width="2.5" opacity="0.6"/>
  <path d="M64 58 L60 84 M70 58 L76 84" stroke="#10b981" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
</svg>`;

// 3. Communications Tower / Tactical Relay Antenna
const COMM_TOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- Concrete Base Foundation -->
  <rect x="22" y="86" width="56" height="6" rx="2" fill="#1e293b" stroke="#3b82f6" stroke-width="2.5"/>
  <!-- Lattice Mast / Truss Structure -->
  <line x1="28" y1="86" x2="47" y2="28" stroke="#3b82f6" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="72" y1="86" x2="53" y2="28" stroke="#3b82f6" stroke-width="3.5" stroke-linecap="round"/>
  <!-- Cross Bracing Lattice Bars -->
  <line x1="32" y1="74" x2="68" y2="74" stroke="#3b82f6" stroke-width="2.5"/>
  <line x1="32" y1="74" x2="63" y2="60" stroke="#3b82f6" stroke-width="2"/>
  <line x1="68" y1="74" x2="37" y2="60" stroke="#3b82f6" stroke-width="2"/>
  <line x1="37" y1="60" x2="63" y2="60" stroke="#3b82f6" stroke-width="2.5"/>
  <line x1="37" y1="60" x2="59" y2="44" stroke="#3b82f6" stroke-width="2"/>
  <line x1="63" y1="60" x2="41" y2="44" stroke="#3b82f6" stroke-width="2"/>
  <line x1="41" y1="44" x2="59" y2="44" stroke="#3b82f6" stroke-width="2.5"/>
  <!-- Top Mast Pole & Beacon -->
  <line x1="50" y1="28" x2="50" y2="14" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="12" r="3.5" fill="#60a5fa" stroke="#3b82f6" stroke-width="1.5"/>
  <!-- Microwave Dish Antenna -->
  <ellipse cx="40" cy="36" rx="8" ry="12" fill="#0f172a" stroke="#60a5fa" stroke-width="2.5" transform="rotate(-15 40 36)"/>
  <!-- RF Transmission Propagation Waves -->
  <path d="M50 8 C40 -2 30 14 30 14" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
  <path d="M50 8 C60 -2 70 14 70 14" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
  <path d="M50 2 C35 -10 20 12 20 12" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M50 2 C65 -10 80 12 80 12" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
</svg>`;

// 4. Artillery Gun / Howitzer (Towed Direct-Fire Weapon)
const ARTILLERY_GUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- Ground Stabilizer Spades -->
  <line x1="12" y1="84" x2="88" y2="84" stroke="#ec4899" stroke-width="3" stroke-linecap="round"/>
  <!-- Split-Trail Carriage Outriggers -->
  <path d="M22 84 L46 64 M78 84 L54 64" stroke="#ec4899" stroke-width="4" stroke-linecap="round"/>
  <!-- Wheeled Base Carriage -->
  <circle cx="44" cy="68" r="14" fill="#0f172a" stroke="#ec4899" stroke-width="4"/>
  <circle cx="44" cy="68" r="4" fill="#ec4899"/>
  <!-- Gun Cradle & Recoil Cylinder -->
  <rect x="42" y="44" width="22" height="12" rx="3" transform="rotate(-32 44 50)" fill="#1e293b" stroke="#ec4899" stroke-width="3"/>
  <!-- Long High-Angle Howitzer Barrel -->
  <line x1="36" y1="62" x2="84" y2="18" stroke="#ec4899" stroke-width="6" stroke-linecap="square"/>
  <!-- Perforated Muzzle Brake -->
  <rect x="79" y="14" width="10" height="9" rx="2" transform="rotate(-42 84 18)" fill="#ec4899"/>
  <!-- Gunner Shield Armor Plate -->
  <path d="M30 40 L38 70" stroke="#f472b6" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;

// 5. Tactical UAV / Surveillance Drone
const DRONE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- Quadcopter Arms -->
  <line x1="24" y1="24" x2="76" y2="76" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
  <line x1="24" y1="76" x2="76" y2="24" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
  <!-- Central Avionics Pod -->
  <circle cx="50" cy="50" r="14" fill="#0f172a" stroke="#38bdf8" stroke-width="4"/>
  <circle cx="50" cy="50" r="6" fill="#38bdf8"/>
  <!-- Rotors & Guards -->
  <circle cx="22" cy="22" r="12" stroke="#38bdf8" stroke-width="3" stroke-dasharray="3 3"/>
  <circle cx="78" cy="22" r="12" stroke="#38bdf8" stroke-width="3" stroke-dasharray="3 3"/>
  <circle cx="22" cy="78" r="12" stroke="#38bdf8" stroke-width="3" stroke-dasharray="3 3"/>
  <circle cx="78" cy="78" r="12" stroke="#38bdf8" stroke-width="3" stroke-dasharray="3 3"/>
  <!-- Rotor Hubs -->
  <circle cx="22" cy="22" r="4" fill="#38bdf8"/>
  <circle cx="78" cy="22" r="4" fill="#38bdf8"/>
  <circle cx="22" cy="78" r="4" fill="#38bdf8"/>
  <circle cx="78" cy="78" r="4" fill="#38bdf8"/>
</svg>`;

// 6. Air Defense Missile Battery
const AIR_DEFENSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <line x1="18" y1="84" x2="82" y2="84" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="28" y="64" width="44" height="20" rx="3" fill="#0f172a" stroke="#f59e0b" stroke-width="3"/>
  <!-- Turret Pedestal -->
  <path d="M42 64 L50 48 L58 64 Z" fill="#1e293b" stroke="#f59e0b" stroke-width="2.5"/>
  <!-- Center Missile Launcher Canister -->
  <line x1="50" y1="52" x2="50" y2="18" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
  <polygon points="50,10 44,22 56,22" fill="#f59e0b"/>
  <!-- Left Missile Canister -->
  <line x1="40" y1="56" x2="28" y2="24" stroke="#f59e0b" stroke-width="4.5" stroke-linecap="round"/>
  <polygon points="26,18 20,29 32,26" fill="#f59e0b"/>
  <!-- Right Missile Canister -->
  <line x1="60" y1="56" x2="72" y2="24" stroke="#f59e0b" stroke-width="4.5" stroke-linecap="round"/>
  <polygon points="74,18 68,26 80,29" fill="#f59e0b"/>
</svg>`;

export const DEFAULT_TACTICAL_SVGS: TacticalSvgPreset[] = [
  {
    id: 'preset_tank',
    name: 'Main Battle Tank',
    label: 'SIM MBT 01',
    category: 'armor',
    defaultColor: '#ef4444',
    description: 'Armored combat vehicle with turret & tracks',
    svgRaw: TANK_SVG,
    dataUrl: buildDataUrl(TANK_SVG),
  },
  {
    id: 'preset_infantry',
    name: 'Infantry Squad',
    label: 'SIM INF 01',
    category: 'infantry',
    defaultColor: '#10b981',
    description: 'Dismounted tactical foot soldier & squad',
    svgRaw: INFANTRY_SVG,
    dataUrl: buildDataUrl(INFANTRY_SVG),
  },
  {
    id: 'preset_comm_tower',
    name: 'Communication Tower',
    label: 'SIM COMM TOWER',
    category: 'communication',
    defaultColor: '#3b82f6',
    description: 'Tactical lattice relay mast with dish antenna',
    svgRaw: COMM_TOWER_SVG,
    dataUrl: buildDataUrl(COMM_TOWER_SVG),
  },
  {
    id: 'preset_artillery_gun',
    name: 'Artillery Gun',
    label: 'SIM ARTY 01',
    category: 'artillery',
    defaultColor: '#ec4899',
    description: 'Field howitzer / direct-fire weapon position',
    svgRaw: ARTILLERY_GUN_SVG,
    dataUrl: buildDataUrl(ARTILLERY_GUN_SVG),
  },
  {
    id: 'preset_drone',
    name: 'Tactical UAV / Drone',
    label: 'SIM UAV 01',
    category: 'aviation',
    defaultColor: '#38bdf8',
    description: 'Surveillance / recon quadcopter drone',
    svgRaw: DRONE_SVG,
    dataUrl: buildDataUrl(DRONE_SVG),
  },
  {
    id: 'preset_air_defense',
    name: 'Air Defense Battery',
    label: 'SIM AIR DEF 01',
    category: 'airdefense',
    defaultColor: '#f59e0b',
    description: 'Surface-to-air missile launcher site',
    svgRaw: AIR_DEFENSE_SVG,
    dataUrl: buildDataUrl(AIR_DEFENSE_SVG),
  },
];
