// DRAFT CONTENT, EXPERT REVIEW REQUIRED BEFORE FIELD USE. reviewed_by stays null until a real expert signs off.
type L = { en: string; hi: string };
type Step = { id: string; title: L; drawing: string; instruction: L; do: L[]; dont: L[]; photo_required: boolean };
export type PackSource = { device_type: string; gear: L[]; steps: Step[] };

export const SAFETY_VERSION = 'draft-0.1';
export const EMERGENCY: L = { en: 'Smoke, heat or fire? Move away and call 112.', hi: 'धुआँ, गर्मी या आग? दूर हटें और 112 पर कॉल करें।' };
export const DRAFT_BANNER: L = { en: 'DRAFT CONTENT — EXPERT REVIEW REQUIRED BEFORE FIELD USE', hi: 'ड्राफ़्ट सामग्री — फ़ील्ड उपयोग से पहले विशेषज्ञ समीक्षा ज़रूरी' };

const GLOVES: L = { en: 'Cut-resistant gloves', hi: 'कट-रोधी दस्ताने' };
const GOGGLES: L = { en: 'Safety glasses', hi: 'सुरक्षा चश्मा' };
const MASK: L = { en: 'Dust mask (N95 or better)', hi: 'धूल का मास्क (N95 या बेहतर)' };
const POWER_OFF: L = { en: 'Unplug the device and remove any power source first', hi: 'पहले डिवाइस का प्लग निकालें और बिजली का स्रोत हटाएँ' };
const NO_HAMMER: L = { en: 'Do not hit, crush or pierce the battery', hi: 'बैटरी को न मारें, न कुचलें, न छेदें' };

export const PACKS: PackSource[] = [
  { device_type: 'laptop', gear: [GLOVES, GOGGLES, MASK], steps: [
    { id: 'lap-1', title: { en: 'Power off and unplug', hi: 'बंद करें और प्लग निकालें' }, drawing: 'laptop-unplug',
      instruction: { en: 'Shut down the laptop and unplug the charger.', hi: 'लैपटॉप बंद करें और चार्जर निकालें।' },
      do: [{ en: 'Work on a dry, flat table', hi: 'सूखी, समतल मेज़ पर काम करें' }], dont: [{ en: 'Do not open it while plugged in', hi: 'प्लग लगे रहते हुए न खोलें' }], photo_required: false },
    { id: 'lap-2', title: { en: 'Remove the battery first', hi: 'सबसे पहले बैटरी निकालें' }, drawing: 'laptop-battery',
      instruction: { en: 'Open the back panel and lift the battery out after unplugging its connector.', hi: 'पिछला पैनल खोलें और कनेक्टर निकालकर बैटरी बाहर निकालें।' },
      do: [{ en: 'Store the battery upright on a bare floor, away from other items', hi: 'बैटरी को खाली फ़र्श पर सीधा, अन्य सामान से दूर रखें' }], dont: [NO_HAMMER, { en: 'Do not use a swollen battery; keep it apart and tell your supervisor', hi: 'फूली हुई बैटरी न छुएँ; अलग रखें' }], photo_required: true },
    { id: 'lap-3', title: { en: 'Take out RAM and SSD', hi: 'RAM और SSD निकालें' }, drawing: 'laptop-ram',
      instruction: { en: 'Release the side clips and slide out the memory and drive for resale.', hi: 'साइड क्लिप छोड़ें और बिक्री के लिए मेमोरी और ड्राइव निकालें।' },
      do: [{ en: 'Hold parts by the edges', hi: 'पुर्ज़ों को किनारे से पकड़ें' }], dont: [{ en: 'Do not touch the gold contacts', hi: 'सुनहरे संपर्कों को न छुएँ' }], photo_required: false },
    { id: 'lap-4', title: { en: 'Separate the board and metal', hi: 'बोर्ड और धातु अलग करें' }, drawing: 'laptop-board',
      instruction: { en: 'Unscrew the mainboard and sort board, plastic and metal into separate bins.', hi: 'मेनबोर्ड के स्क्रू खोलें और बोर्ड, प्लास्टिक व धातु अलग डिब्बों में रखें।' },
      do: [{ en: 'Wear gloves and a mask', hi: 'दस्ताने और मास्क पहनें' }], dont: [{ en: 'Do not burn cables or boards', hi: 'तार या बोर्ड न जलाएँ' }], photo_required: false } ] },
  { device_type: 'phone', gear: [GLOVES, GOGGLES], steps: [
    { id: 'ph-1', title: { en: 'Power off and remove SIM', hi: 'बंद करें और सिम निकालें' }, drawing: 'phone-sim',
      instruction: { en: 'Switch the phone off and take out the SIM and memory card.', hi: 'फ़ोन बंद करें और सिम व मेमोरी कार्ड निकालें।' },
      do: [{ en: 'Give the SIM back to the owner', hi: 'सिम मालिक को लौटाएँ' }], dont: [{ en: 'Do not keep personal data', hi: 'निजी डेटा न रखें' }], photo_required: false },
    { id: 'ph-2', title: { en: 'Remove the battery first', hi: 'सबसे पहले बैटरी निकालें' }, drawing: 'phone-battery',
      instruction: { en: 'Warm the back gently, open it and lift the battery by its pull tab.', hi: 'पीछे का हिस्सा हल्का गरम करें, खोलें और पुल-टैब से बैटरी उठाएँ।' },
      do: [{ en: 'Use a plastic tool', hi: 'प्लास्टिक के औज़ार का उपयोग करें' }], dont: [{ en: 'Do not use a metal blade near the battery', hi: 'बैटरी के पास धातु की ब्लेड न लगाएँ' }, NO_HAMMER], photo_required: true },
    { id: 'ph-3', title: { en: 'Separate screen and board', hi: 'स्क्रीन और बोर्ड अलग करें' }, drawing: 'phone-board',
      instruction: { en: 'Unscrew the board and lift the screen; keep reusable screens aside.', hi: 'बोर्ड के स्क्रू खोलें और स्क्रीन उठाएँ; काम की स्क्रीन अलग रखें।' },
      do: [{ en: 'Wear safety glasses for cracked glass', hi: 'टूटे काँच के लिए चश्मा पहनें' }], dont: [{ en: 'Do not squeeze cracked glass', hi: 'टूटे काँच को न दबाएँ' }], photo_required: false } ] },
  { device_type: 'crt_monitor', gear: [GLOVES, GOGGLES, MASK], steps: [
    { id: 'crt-1', title: { en: 'Unplug and wait', hi: 'प्लग निकालें और रुकें' }, drawing: 'crt-unplug',
      instruction: { en: 'Unplug the monitor and wait at least one hour before touching the inside.', hi: 'मॉनिटर का प्लग निकालें और अंदर छूने से पहले कम से कम एक घंटा रुकें।' },
      do: [POWER_OFF], dont: [{ en: 'Do not touch the back of the tube; it can hold charge', hi: 'ट्यूब के पीछे न छुएँ; उसमें चार्ज रह सकता है' }], photo_required: false },
    { id: 'crt-2', title: { en: 'Open the case', hi: 'केस खोलें' }, drawing: 'crt-case',
      instruction: { en: 'Remove the back cover screws and lift the cover away.', hi: 'पीछे के कवर के स्क्रू खोलें और कवर हटाएँ।' },
      do: [{ en: 'Keep your face away from the glass tube', hi: 'चेहरा काँच की ट्यूब से दूर रखें' }], dont: [{ en: 'Do not drop or hit the tube; leaded glass can implode', hi: 'ट्यूब को न गिराएँ या मारें; सीसे वाला काँच फट सकता है' }], photo_required: true },
    { id: 'crt-3', title: { en: 'Sort without breaking the tube', hi: 'ट्यूब तोड़े बिना छाँटें' }, drawing: 'crt-sort',
      instruction: { en: 'Remove boards and copper yoke; hand the intact tube to an authorised recycler.', hi: 'बोर्ड और तांबे का योक निकालें; साबुत ट्यूब अधिकृत रीसायकलर को दें।' },
      do: [{ en: 'Wear a dust mask', hi: 'धूल का मास्क पहनें' }], dont: [{ en: 'Do not break the tube to get at the metal', hi: 'धातु के लिए ट्यूब न तोड़ें' }], photo_required: false } ] },
];
