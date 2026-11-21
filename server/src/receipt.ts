import type { Db } from './db.ts';
import PDFDocument from 'pdfkit';

type Row = Record<string, any>;

export type ReceiptData = {
  receipt_no: string; lot_id: string; hash: string; date: string;
  seller: { name: string; address: string; phone: string };
  buyer: { name: string };
  weight_kg: number; amount: number; items: { name: string; qty: number }[];
};

/** Build receipt data for a SOLD lot from its accepted bid. */
export async function receiptData(db: Db, lotId: string): Promise<ReceiptData> {
  const lot = await db.prepare('SELECT * FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot) throw new Error('Lot not found');
  if (lot.status !== 'sold') throw new Error('Receipt is only available for sold lots');
  const bid = await db.prepare("SELECT b.*, u.name AS buyer FROM bid b JOIN app_user u ON u.id = b.recycler_id WHERE b.lot_id = ? AND b.status = 'accepted'").get(lotId) as Row;
  const seller = await db.prepare('SELECT u.name, u.phone, w.address FROM app_user u LEFT JOIN workshop w ON w.id = u.workshop_id WHERE u.id = ?').get(lot.user_id) as Row;
  const items = await Promise.all((JSON.parse(lot.items) as Row[]).map(async (it) => {
    const m = it.model_id ? (await db.prepare('SELECT brand, model FROM device_model WHERE id = ?').get(it.model_id) as Row | undefined) : undefined;
    return { name: m ? `${m.brand} ${m.model}` : String(it.type).replace('_', ' '), qty: it.qty ?? 1 };
  }));
  const phone = String(seller.phone ?? '');
  return {
    receipt_no: 'UM-' + lot.hash.slice(0, 8).toUpperCase(), lot_id: lot.id, hash: lot.hash, date: lot.created_at.slice(0, 10),
    seller: { name: seller.name, address: seller.address ?? 'Address not registered', phone: phone ? 'xxxxxx' + phone.slice(-4) : '-' },
    buyer: { name: bid.buyer }, weight_kg: lot.weight_kg, amount: bid.amount, items,
  };
}

/** PDF in plain Latin text (the built-in PDF font has no Devanagari or rupee sign, so we write "Rs."). */
export function renderReceiptPdf(d: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).text('URBAN MINE - PURCHASE RECEIPT');
    doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#B3261E')
      .text('Prototype format, check against current CPCB requirements. SAMPLE DATA. Payout is simulated.');
    doc.fillColor('#14171A').moveDown();

    const row = (k: string, v: string) => { doc.font('Helvetica-Bold').fontSize(11).text(k, { continued: true }).font('Helvetica').text('  ' + v); };
    row('Receipt no:', d.receipt_no);
    row('Date:', d.date);
    row('Lot id:', d.lot_id);
    doc.moveDown(0.6);
    row('Seller (informal):', d.seller.name);
    row('Seller address:', d.seller.address);
    row('Seller phone:', d.seller.phone);
    row('Buyer (recycler):', d.buyer.name);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').text('Items');
    for (const it of d.items) doc.font('Helvetica').text(`  ${it.qty} x ${it.name}`);
    doc.moveDown(0.6);
    row('Total weight:', `${d.weight_kg} kg`);
    row('Agreed price:', `Rs. ${d.amount.toFixed(2)}`);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').text('Lot record hash (SHA-256)');
    doc.font('Courier').fontSize(9).text(d.hash);
    doc.moveDown(0.6).font('Helvetica').fontSize(9).fillColor('#555555')
      .text('The hash chain proves this record was not altered after it was created. It does not prove the first entry was true.');
    doc.end();
  });
}
