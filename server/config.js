// PULSE — central configuration: org chart, properties, RBAC matrix.
// Access follows the email that signs in. Replace placeholder emails with
// real pulse.sa addresses before production.

export const REGION = 'MENA';
export const PORTFOLIO = 'Riyadh';
export const TIMEZONE = 'Asia/Riyadh';
export const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'pulse.sa';

export const PROPERTIES = [
  { id: 'narjis-gardens', name: 'Narjis Gardens', city: 'Riyadh', type: 'Diplomatic & corporate compound', live: true,  lat: 24.8226, lng: 46.6431 },
  { id: 'olaya-nine',   name: 'Olaya Nine',   city: 'Riyadh', type: 'Premium family compound', live: false, lat: 24.6949, lng: 46.6858 },
  { id: 'hittin-hills', name: 'Hittin Hills', city: 'Riyadh', type: 'Expat residential compound', live: false, lat: 24.7654, lng: 46.5934 },
  { id: 'yasmin-grove', name: 'Yasmin Grove', city: 'Riyadh', type: 'Corporate housing compound',    live: false, lat: 24.8352, lng: 46.6520 },
  { id: 'malqa-oasis', name: 'Malqa Oasis', city: 'Riyadh', type: 'Premium family compound', live: false, lat: 24.8107, lng: 46.6027 }
];
export const HOME_PROPERTY = 'narjis-gardens';

export const ROLES = {
  director:            { title: 'Director of Operations',    scope: 'region' },
  ops_manager:         { title: 'Operations Manager',        scope: 'portfolio' },
  gm:                  { title: 'General Manager',           scope: 'property' },
  agm:                 { title: 'Assistant General Manager', scope: 'property' },
  senior_rx:           { title: 'Senior Resident Experience', scope: 'property' },
  rx:                  { title: 'Resident Experience',       scope: 'property' },
  maintenance_manager: { title: 'Maintenance Manager',       scope: 'property' },
  housekeeping_manager:{ title: 'Housekeeping Manager',      scope: 'property' }
};

// Org chart / roster. property is ignored for region/portfolio scopes.
export const ORG = [
  { email: 'director@pulse.sa',            name: 'Rania Kassem', role: 'director' },
  { email: 'amal.rashed@pulse.sa',      name: 'Amal Rashed',         role: 'ops_manager' },
  { email: 'gm.narjisgardens@pulse.sa',       name: 'Omar Hadi', role: 'gm',  property: 'narjis-gardens' },
  { email: 'sara.nasser@pulse.sa',    name: 'Sara Nasser',       role: 'agm', property: 'narjis-gardens' },
  { email: 'lina.fares@pulse.sa',name: 'Lina Fares',   role: 'senior_rx', property: 'narjis-gardens' },
  { email: 'karim.saleh@pulse.sa',      name: 'Karim Saleh',         role: 'senior_rx', property: 'narjis-gardens' },
  { email: 'noor.hamdan@pulse.sa',       name: 'Noor Hamdan',          role: 'rx', property: 'narjis-gardens' },
  { email: 'ziad.qassim@pulse.sa',      name: 'Ziad Qassim',         role: 'rx', property: 'narjis-gardens' },
  { email: 'maha.suleiman@pulse.sa',     name: 'Maha Suleiman',        role: 'rx', property: 'narjis-gardens' },
  { email: 'maintenance.narjisgardens@pulse.sa', name: 'Fadi Mansour', role: 'maintenance_manager', property: 'narjis-gardens' },
  { email: 'housekeeping.narjisgardens@pulse.sa', name: 'Huda Bakr', role: 'housekeeping_manager', property: 'narjis-gardens' }
];

const ALL = ['director','ops_manager','gm','agm','senior_rx','rx','maintenance_manager','housekeeping_manager'];
const RX_UP = ['director','ops_manager','gm','agm','senior_rx','rx'];
const MGMT = ['director','ops_manager','gm','agm','senior_rx'];
export const FINANCIAL_ROLES = ['director','ops_manager','gm','agm'];

// The access matrix. Enforced on every API endpoint, not just navigation.
export const MODULE_ACCESS = {
  home:         ALL,
  shift:        RX_UP,
  units:        ALL,
  moves:        ALL,
  housekeeping: ALL.filter(r => r !== 'rx' && r !== 'maintenance_manager'),
  maintenance:  ALL.filter(r => r !== 'housekeeping_manager'),
  cases:        ALL.filter(r => r !== 'housekeeping_manager'),
  residents:    RX_UP,
  feedback:     RX_UP,
  events:       RX_UP,
  operations:   MGMT,
  oversight:    MGMT
};

export const DEFAULT_LANDING = {
  director: 'operations', ops_manager: 'operations', gm: 'operations',
  agm: 'oversight', senior_rx: 'shift', rx: 'shift',
  maintenance_manager: 'maintenance', housekeeping_manager: 'housekeeping'
};

// Fields stripped server-side for anyone outside FINANCIAL_ROLES.
export const FINANCIAL_FIELDS = [
  'revenue', 'cost', 'reserve', 'noi', 'bufferCash', 'b2bRevenueConcentration',
  'revenueMTD', 'costMTD', 'adr', 'b2bAccounts'
];

// SLA windows in hours by priority.
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
