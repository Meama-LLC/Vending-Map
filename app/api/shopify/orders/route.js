import { NextResponse } from 'next/server';
import { fetchVendingOrders } from '../../../../lib/shopify';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const orders = await fetchVendingOrders(todayStart);

    // Normalise to the same shape Dashboard.js expects
    const normalised = orders.map(o => {
      const attrs     = o.note_attributes || [];
      const vmsId     = attrs.find(a => a.name === 'vms_id')?.value   || extractVmsId(o.tags);
      const vmsName   = attrs.find(a => a.name === 'vms_name')?.value || extractVmsName(o.tags);
      return {
        shopify_id:       String(o.id),
        name:             o.name,
        total:            o.total_price,
        created_at:       o.created_at,
        financial_status: o.financial_status,
        tags:             o.tags,
        vms_id:           vmsId,
        vms_name:         vmsName,
      };
    });

    return NextResponse.json({ orders: normalised, source: 'shopify', count: normalised.length });
  } catch (err) {
    console.error('[shopify/orders]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Tag parsers ────────────────────────────────────────────────────────────
// Expected tag format: "vending, vms_id:VM042, vms_name:Rustaveli Mall"
function extractVmsId(tags = '') {
  const m = tags.match(/vms[_-]?id[:\s]+([^\s,]+)/i);
  return m ? m[1] : null;
}
function extractVmsName(tags = '') {
  const m = tags.match(/vms[_-]?name[:\s]+([^,]+)/i);
  return m ? m[1].trim() : null;
}
