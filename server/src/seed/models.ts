// SAMPLE device models. Brands are fictional placeholders. Composition is grams per unit, illustrative only.
export type ModelRow = {
  id: string; type: string; brand: string; model: string; label_patterns: string[];
  weight_kg: number; composition: Record<string, number>; repair_notes: string;
};

export const MODELS: ModelRow[] = [
  { id: 'lap-nova-14', type: 'laptop', brand: 'Nova', model: 'Slate 14 (SAMPLE)', label_patterns: ['nova\\s*slate\\s*14', 'sl14-\\w+'], weight_kg: 1.9,
    composition: { plastic: 520, aluminium: 380, steel: 210, copper: 120, pcb: 260, battery_li: 340, glass: 70 }, repair_notes: 'RAM and SSD accessible under bottom panel. Battery is screwed, not glued.' },
  { id: 'lap-kestrel-15', type: 'laptop', brand: 'Kestrel', model: 'K15 Office (SAMPLE)', label_patterns: ['kestrel\\s*k15', 'k15-\\d{3}'], weight_kg: 2.4,
    composition: { plastic: 780, aluminium: 150, steel: 330, copper: 140, pcb: 290, battery_li: 420, glass: 80 }, repair_notes: 'Plastic body, many clips. Hinge breakage is the common fault.' },
  { id: 'ph-arka-a1', type: 'phone', brand: 'Arka', model: 'A1 (SAMPLE)', label_patterns: ['arka\\s*a1', 'ak-a1\\d*'], weight_kg: 0.19,
    composition: { plastic: 35, aluminium: 28, steel: 6, copper: 12, pcb: 30, battery_li: 45, glass: 30 }, repair_notes: 'Glued battery and back glass; heat needed. Screen swap is medium difficulty.' },
  { id: 'ph-arka-a3', type: 'phone', brand: 'Arka', model: 'A3 Plus (SAMPLE)', label_patterns: ['arka\\s*a3', 'ak-a3\\w*'], weight_kg: 0.21,
    composition: { plastic: 40, aluminium: 30, steel: 8, copper: 13, pcb: 32, battery_li: 52, glass: 32 }, repair_notes: 'Pull-tab battery. Charging port is replaceable.' },
  { id: 'ph-veda-s5', type: 'phone', brand: 'Veda', model: 'S5 (SAMPLE)', label_patterns: ['veda\\s*s5', 'vd-s5\\w*'], weight_kg: 0.17,
    composition: { plastic: 50, aluminium: 12, steel: 5, copper: 11, pcb: 28, battery_li: 40, glass: 24 }, repair_notes: 'Feature-style smartphone, removable battery.' },
  { id: 'tab-nova-t8', type: 'tablet', brand: 'Nova', model: 'Tab T8 (SAMPLE)', label_patterns: ['nova\\s*tab\\s*t8', 'nt8-\\w+'], weight_kg: 0.52,
    composition: { plastic: 60, aluminium: 150, steel: 20, copper: 30, pcb: 60, battery_li: 120, glass: 80 }, repair_notes: 'Screen adhesive is strong; battery connector is easy once open.' },
  { id: 'chg-volt-20', type: 'charger', brand: 'Volt', model: '20W USB Adapter (SAMPLE)', label_patterns: ['volt\\s*20w', 'vc-20\\w*'], weight_kg: 0.08,
    composition: { plastic: 30, copper: 14, steel: 8, pcb: 18, aluminium: 2 }, repair_notes: 'Sealed case. Usually recycle; cable replacement only.' },
  { id: 'chg-nova-65', type: 'charger', brand: 'Nova', model: '65W Laptop Adapter (SAMPLE)', label_patterns: ['nova\\s*65w', 'na-65\\w*'], weight_kg: 0.3,
    composition: { plastic: 120, copper: 90, steel: 30, pcb: 45, aluminium: 15 }, repair_notes: 'Often fine; only the cable frays. Test before dismantling.' },
  { id: 'crt-orion-15', type: 'crt_monitor', brand: 'Orion', model: 'CRT 15in (SAMPLE)', label_patterns: ['orion\\s*15', 'or-c15\\w*'], weight_kg: 11.5,
    composition: { glass: 6500, plastic: 2200, steel: 900, copper: 600, pcb: 450, aluminium: 150 }, repair_notes: 'Contains leaded glass tube and stored charge. Do not break the tube.' },
  { id: 'lcd-orion-19', type: 'lcd_monitor', brand: 'Orion', model: 'LCD 19in (SAMPLE)', label_patterns: ['orion\\s*19', 'or-l19\\w*'], weight_kg: 3.6,
    composition: { plastic: 1500, glass: 900, steel: 500, copper: 150, pcb: 350, aluminium: 200 }, repair_notes: 'Backlight or capacitor faults are common. Power board is separate.' },
  { id: 'rtr-link-n300', type: 'router', brand: 'Link', model: 'N300 Wi-Fi Router (SAMPLE)', label_patterns: ['link\\s*n300', 'ln-300\\w*'], weight_kg: 0.25,
    composition: { plastic: 130, copper: 22, steel: 15, pcb: 70, aluminium: 8 }, repair_notes: 'Usually works after factory reset or new adapter.' },
  { id: 'stb-cast-hd', type: 'set_top_box', brand: 'Cast', model: 'HD Set-top Box (SAMPLE)', label_patterns: ['cast\\s*hd', 'cs-hd\\w*'], weight_kg: 0.4,
    composition: { plastic: 160, steel: 90, copper: 40, pcb: 95, aluminium: 15 }, repair_notes: 'Remote or power-supply fault is typical.' },
];
