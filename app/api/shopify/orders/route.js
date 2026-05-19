import { NextResponse } from 'next/server';
import { fetchVendingOrders, SHOPIFY_SHOP } from '../../../../lib/shopify';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('shopify_access_token')?.value
    || process.env.SHOPIFY_ACCESS_TOKEN; // fallback: set in Vercel env vars
  const shop = cookieStore.get('shopify_shop')?.value
    || process.env.SHOPIFY_SHOP
    || SHOPIFY_SHOP;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated. Visit /api/shopify/auth to connect.' },
      { status: 401 }
    );
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const orders = await fetchVendingOrders(shop, accessToken, todayStart);

    // Normalise to the same shape the Dashboard expects from Supabase
    const normalised = orders.map(o => {
      const vmsAttr = o.note_attributes?.find(a => a.name === 'vms_id');
      const vmsNameAttr = o.note_attributes?.find(a => a.name === 'vms_name');
      return {
        shopify_id:       o.id,
        name:             o.name,
        total:            o.total_price,
        created_at:       o.created_at,
        financial_status: o.financial_status,
        tags:             o.tags,
        vms_id:           vmsAttr?.value || extractVmsFromTags(o.tags),
        vms_name:         vmsNameAttr?.value || extractVmsNameFromTags(o.tags),
      };
    });

    return NextResponse.json({ orders: normalised, source: 'shopify', count: normalised.length });
  } catch (err) {
    console.error('Shopify orders error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Helpers to extract VMS info from order tags ──────────────────────────
// Tags format example: "vending, vms_id:VM042, vms_name:Rustaveli Mall"
function extractVmsFromTags(tags = '') {
  const match = tags.match(/vms[_-]?id[:\s]+([^\s,]+)/i);
  return match ? match[1] : null;
}

function extractVmsNameFromTags(tags = '') {
  const match = tags.match(/vms[_-]?name[:\s]+([^,]+)/i);
  return match ? match[1].trim() : null;
}
