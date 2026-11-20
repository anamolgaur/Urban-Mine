// SAMPLE users and workshops. Fictional; phone numbers are not real.
export const WORKSHOPS = [
  { id: 'ws-1', name: 'SAMPLE Workshop One', address: 'SAMPLE: Lane 4, Seelampur, Delhi', lat: 28.6692, lng: 77.2655 },
  { id: 'ws-2', name: 'SAMPLE Workshop Two', address: 'SAMPLE: Block C, Tangra, Kolkata', lat: 22.5535, lng: 88.3913 },
];
export const USERS = [
  { id: 'u-worker-1', role: 'worker', name: 'SAMPLE Worker Asha', phone: '9000000001', language: 'hi', workshop_id: 'ws-1' },
  { id: 'u-worker-2', role: 'worker', name: 'SAMPLE Worker Ravi', phone: '9000000002', language: 'hi', workshop_id: 'ws-2' },
  { id: 'u-recycler-1', role: 'recycler', name: 'SAMPLE Recycler Alpha', phone: '9000000011', language: 'en', workshop_id: null },
  { id: 'u-recycler-2', role: 'recycler', name: 'SAMPLE Recycler Beta', phone: '9000000012', language: 'en', workshop_id: null },
  { id: 'u-repairer-1', role: 'repairer', name: 'SAMPLE Repairer Mohan', phone: '9000000021', language: 'hi', workshop_id: null },
  { id: 'u-auditor-1', role: 'auditor', name: 'SAMPLE Auditor Priya', phone: '9000000031', language: 'en', workshop_id: null },
];
export const REPAIRER_LISTINGS = [
  { id: 'rl-1', user_id: 'u-repairer-1', skills: ['phone_screen', 'phone_battery', 'charger'], area: 'SAMPLE: Seelampur, Delhi', start_price: 150, hours: '10:00-19:00', verified_count: 0 },
];
