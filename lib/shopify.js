import crypto from 'crypto';

export const SHOPIFY_CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
export const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
export const SHOPIFY_SCOPES        = 'read_orders,read_products';
export const SHOPIFY_SHOP          = process.env.SHOPIFY_SHOP || 'meama.myshopify.com';

/** Build the OAuth redirect URL for a given shop */
export function buildAuthUrl(shop, redirectUri, state) {
  const params = new URLSearchParams({
    client_id:    SHOPIFY_CLIENT_ID,
    scope:        SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user',
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

/** Exchange the OAuth code for a permanent access token */
export async function getAccessToken(shop, code) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.status}`);
  const { access_token } = await res.json();
  return access_token;
}

/** Verify that the HMAC in the callback query string is genuine */
export function verifyHmac(query) {
  const { hmac, ...rest } = query;
  const message = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('&');
  const digest  = crypto.createHmac('sha256', SHOPIFY_CLIENT_SECRET).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

/** Fetch vending orders from today using the stored access token */
export async function fetchVendingOrders(shop, accessToken, fromDate) {
  const params = new URLSearchParams({
    status:         'any',
    created_at_min: fromDate.toISOString(),
    limit:          '250',
    fields:         'id,name,total_price,created_at,financial_status,tags,note_attributes',
  });

  const res = await fetch(`https://${shop}/admin/api/2024-01/orders.json?${params}`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type':           'application/json',
    },
  });

  if (!res.ok) throw new Error(`Shopify orders fetch failed: ${res.status}`);
  const { orders } = await res.json();

  // Only return orders tagged as vending machine orders
  return orders.filter(o =>
    o.tags && (
      o.tags.toLowerCase().includes('vending') ||
      o.tags.toLowerCase().includes('vms') ||
      o.note_attributes?.some(a => a.name === 'vms_id')
    )
  );
}
