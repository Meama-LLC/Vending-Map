import { NextResponse } from 'next/server';
import { fetchVendingOrders } from '../../../../lib/shopify';
import DROPPER_LOCATIONS from '../../.././../lib/droppers';

// Build a reverse lookup: normalised name → vms_id
// Shopify order `tags` == dropper `name` (lowercase, no spaces)
const nameToId = {};
Object.entries(DROPPER_LOCATIONS).forEach(([id, loc]) => {
  if (loc.name) nameToId[norm(loc.name)] = id;
});

function norm(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '').trim();
}

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const orders = await fetchVendingOrders(todayStart);

    const normalised = orders.map(o => {
      const tag    = (o.tags || '').split(',')[0].trim(); // first tag = machine name
      const vmsId  = nameToId[norm(tag)] || null;
      const vmsLoc = vmsId ? DROPPER_LOCATIONS[vmsId] : null;

      return {
        shopify_id:       String(o.id),
        name:             o.name,
        total:            o.total_price,
        created_at:       o.created_at,
        financial_status: o.financial_status,
        tags:             o.tags,
        vms_id:           vmsId,
        vms_name:         vmsLoc?.name || tag || null,
      };
    });

    return NextResponse.json({ orders: normalised, source: 'shopify', count: normalised.length });
  } catch (err) {
    console.error('[shopify/orders]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
