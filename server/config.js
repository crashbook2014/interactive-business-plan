// PULSE — central configuration: org chart, compounds, RBAC matrix.
// Access follows the email that signs in. Replace placeholder emails with
// real pulse.sa addresses before production. All names are fictional.

export const REGION = 'MENA';
export const PORTFOLIO = 'Riyadh';
export const TIMEZONE = 'Asia/Riyadh';
export const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'pulse.sa';

export const PROPERTIES = [
  { id: 'narjis-gardens', name: 'Narjis Gardens', city: 'Riyadh', type: 'Diplomatic & corporate compound', live: true,  lat: 24.8226, lng: 46.6431 },
  { id: 'olaya-nine',   name: 'Olaya Nine',   city: 'Riyadh', type: 'Premium family compound', live: false, lat: 24.6949, lng: 46.6858 },
  { id: 'hittin-hills', name: 'Hittin Hills', city: 'Riyadh', type: 'Expat residential compound', live: false, lat: 24.7654, lng: 46.5934 },
  { id: 'yasmin-grove', name: 'Yasmin Grove', city: 'Riyadh', type: 'Corporate housing compound', live: false, lat: 24.8352, lng: 46.6520 },
  { id: 'malqa-oasis', name: 'Malqa Oasis', city: 'Riyadh', type: 'Premium family compound', live: false, lat: 24.8107, lng: 46.6027 }
];
export const HOME_PROPERTY = 'narjis-gardens';

export const ROLES = {
  director:           { title: 'Director of Operations',      scope: 'region' },
  ops_manager:        { title: 'Operations Manager',          scope: 'portfolio' },
  gm:                 { title: 'General Manager',             scope: 'property' },
  agm:                { title: 'Assistant General Manager',   scope: 'property' },
  senior_rx:          { title: 'Senior Resident Experience',  scope: 'property' },
  rx:                 { title: 'Resident Experience',         scope: 'property' },
  production_manager: { title: 'Events Production Manager',   scope: 'property' },
  venue_manager:      { title: 'Venue Manager',               scope: 'property' }
};

// Org chart / roster — fictional placeholders on the pulse.sa domain.
export const ORG = [
  { email: 'director@pulse.sa',       name: 'Rania Kassem',  role: 'director' },
  { email: 'amal.rashed@pulse.sa',    name: 'Amal Rashed',   role: 'ops_manager' },
  { email: 'gm.narjisgardens@pulse.sa', name: 'Omar Hadi',   role: 'gm',  property: 'narjis-gardens' },
  { email: 'sara.nasser@pulse.sa',    name: 'Sara Nasser',   role: 'agm', property: 'narjis-gardens' },
  { email: 'lina.fares@pulse.sa',     name: 'Lina Fares',    role: 'senior_rx', property: 'narjis-gardens' },
  { email: 'karim.saleh@pulse.sa',    name: 'Karim Saleh',   role: 'senior_rx', property: 'narjis-gardens' },
  { email: 'noor.hamdan@pulse.sa',    name: 'Noor Hamdan',   role: 'rx', property: 'narjis-gardens' },
  { email: 'ziad.qassim@pulse.sa',    name: 'Ziad Qassim',   role: 'rx', property: 'narjis-gardens' },
  { email: 'maha.suleiman@pulse.sa',  name: 'Maha Suleiman', role: 'rx', property: 'narjis-gardens' },
  { email: 'production.narjisgardens@pulse.sa', name: 'Fadi Mansour', role: 'production_manager', property: 'narjis-gardens' },
  { email: 'venue.narjisgardens@pulse.sa',      name: 'Huda Bakr',    role: 'venue_manager',      property: 'narjis-gardens' }
];

const ALL = ['director','ops_manager','gm','agm','senior_rx','rx','production_manager','venue_manager'];
const RX_UP = ['director','ops_manager','gm','agm','senior_rx','rx'];
const MGMT = ['director','ops_manager','gm','agm','senior_rx'];
export const FINANCIAL_ROLES = ['director','ops_manager','gm','agm'];

// The access matrix. Enforced on every API endpoint, not just navigation.
export const MODULE_ACCESS = {
  home:       ALL,
  shift:      RX_UP,
  journeys:   RX_UP,
  events:     ALL,                                   // everyone works events
  clients:    MGMT,                                  // B2B pipeline
  residents:  RX_UP,
  feedback:   RX_UP,
  cases:      ALL.filter(r => r !== 'venue_manager'),
  experience: MGMT,
  oversight:  MGMT
};

export const DEFAULT_LANDING = {
  director: 'experience', ops_manager: 'experience', gm: 'experience',
  agm: 'oversight', senior_rx: 'shift', rx: 'shift',
  production_manager: 'events', venue_manager: 'events'
};

// Fields stripped server-side for anyone outside FINANCIAL_ROLES.
export const FINANCIAL_FIELDS = [
  'revenue', 'cost', 'reserve', 'noi', 'budget', 'spend',
  'contractValue', 'pipelineValue', 'b2bAccounts'
];

// SLA windows in hours by priority (cases + event tasks).
export const SLA_HOURS = { high: 8, normal: 48, low: 120 };
export const SLA_AT_RISK_RATIO = 0.75;

export function findUser(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  return ORG.find(u => u.email.toLowerCase() === e) || null;
}

export function scopeProperties(user) {
  if (!user) return [];
  const scope = ROLES[user.role]?.scope;
  if (scope === 'region' || scope === 'portfolio') return PROPERTIES.map(p => p.id);
  return user.property ? [user.property] : [];
}
