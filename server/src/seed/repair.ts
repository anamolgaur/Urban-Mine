// SAMPLE repair guides. DRAFT: not verified by a technician.
type L = { en: string; hi: string };
export type GuideRow = { id: string; fault: L; device_type: string; difficulty: 'easy' | 'medium' | 'hard'; tools: L[]; steps: L[] };

const t = (en: string, hi: string): L => ({ en, hi });

export const GUIDES: GuideRow[] = [
  { id: 'rg-phone-screen', fault: t('Cracked phone screen', 'टूटी फ़ोन स्क्रीन'), device_type: 'phone', difficulty: 'medium',
    tools: [t('Plastic pry tool', 'प्लास्टिक पिक'), t('Small screwdriver', 'छोटा पेचकस'), t('Heat gun or hair dryer', 'हीट गन या ड्रायर')],
    steps: [t('Power off and remove the battery if possible.', 'बंद करें और संभव हो तो बैटरी निकालें।'), t('Warm the edges to soften the glue.', 'गोंद नरम करने के लिए किनारे गरम करें।'), t('Lift the old screen and fit the new one.', 'पुरानी स्क्रीन उठाएँ और नई लगाएँ।')] },
  { id: 'rg-phone-battery', fault: t('Phone battery drains fast', 'फ़ोन की बैटरी जल्दी खत्म'), device_type: 'phone', difficulty: 'medium',
    tools: [t('Plastic pry tool', 'प्लास्टिक पिक'), t('Small screwdriver', 'छोटा पेचकस')],
    steps: [t('Open the back and disconnect the battery.', 'पीछे खोलें और बैटरी कनेक्टर निकालें।'), t('Fit a new battery and close the case.', 'नई बैटरी लगाएँ और केस बंद करें।')] },
  { id: 'rg-charger-cable', fault: t('Charger cable frayed', 'चार्जर का तार घिसा'), device_type: 'charger', difficulty: 'easy',
    tools: [t('Replacement cable', 'नया केबल')],
    steps: [t('Check the adapter works with another cable.', 'दूसरे केबल से एडॉप्टर जाँचें।'), t('Swap the cable; do not tape bare wires.', 'केबल बदलें; खुले तार पर टेप न लगाएँ।')] },
  { id: 'rg-laptop-slow', fault: t('Laptop very slow', 'लैपटॉप बहुत धीमा'), device_type: 'laptop', difficulty: 'easy',
    tools: [t('Small screwdriver', 'छोटा पेचकस'), t('Compatible SSD or RAM', 'संगत SSD या RAM')],
    steps: [t('Unplug and open the bottom panel.', 'प्लग निकालें और नीचे का पैनल खोलें।'), t('Replace the old drive or add memory.', 'पुरानी ड्राइव बदलें या मेमोरी जोड़ें।'), t('Reinstall the system.', 'सिस्टम दोबारा इंस्टॉल करें।')] },
  { id: 'rg-laptop-nocharge', fault: t('Laptop will not charge', 'लैपटॉप चार्ज नहीं होता'), device_type: 'laptop', difficulty: 'hard',
    tools: [t('Multimeter', 'मल्टीमीटर'), t('Soldering iron', 'सोल्डरिंग आयरन')],
    steps: [t('Test the adapter output first.', 'पहले एडॉप्टर का आउटपुट जाँचें।'), t('Inspect the charging socket for a loose joint.', 'चार्जिंग सॉकेट का ढीला जोड़ देखें।'), t('Resolder only if you are trained.', 'प्रशिक्षित हों तभी सोल्डर करें।')] },
  { id: 'rg-router-reset', fault: t('Router has no internet', 'राउटर में इंटरनेट नहीं'), device_type: 'router', difficulty: 'easy',
    tools: [t('Paper clip', 'पेपर क्लिप')],
    steps: [t('Power-cycle the router.', 'राउटर बंद करके चालू करें।'), t('Hold the reset pin for 10 seconds.', 'रीसेट पिन 10 सेकंड दबाएँ।'), t('Set it up again.', 'दोबारा सेट करें।')] },
];
