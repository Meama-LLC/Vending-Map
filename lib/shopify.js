/**
 * Shopify OAuth 2.0 — Client Credentials Grant
 * Used for own-store / server-to-server integrations (no browser redirect needed).
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization/client-secrets
 */

export const SHOPIFY_CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
export const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
export const SHOPIFY_SHOP          = process.env.SHOPIFY_SHOP || 'meama-vending.myshopify.com';
export const SHOPIFY_API_VERSION   = '2024-01';

// ── In-memory token cache (survives within a serverless instance lifetime) ──
let _cachedToken     = null;
let _tokenExpiresAt  = 0;   // unix ms

/**
 * Get a valid access token using Client Credentials Grant.
 * Re-uses the cached token until it expires (tokens last ~24 h).
 */
export async function getClientCredentialsToken() {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt - 60_000) {
    return _cachedToken;   // still valid (with 1-min buffer)
  }

  const shop = SHOPIFY_SHOP;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     SHOPIFY_CLIENT_ID,
    client_secret: SHOPIFY_CLIENT_SECRET,
  });

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify client_credentials failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  _cachedToken    = json.access_token;
  // expires_in is in seconds; default to 24 h if missing
  _tokenExpiresAt = now + (json.expires_in ?? 86399) * 1000;

  return _cachedToken;
}

/**
 * Fetch today's vending orders from the Shopify Admin REST API.
 */
export async function fetchVendingOrders(fromDate) {
  const token = await getClientCredentialsToken();
  const shop  = SHOPIFY_SHOP;

  const params = new URLSearchParams({
    status:         'any',
    created_at_min: fromDate.toISOString(),
    limit:          '250',
    fields:         'id,name,total_price,created_at,financial_status,tags,note_attributes',
  });

  const res = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${params}`,
    {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type':           'application/json',
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify orders fetch failed (${res.status}): ${text}`);
  }

  const { orders } = await res.json();

  // Filter to vending machine orders only
  return (orders || []).filter(o =>
    o.tags && (
      o.tags.toLowerCase().includes('vending') ||
      o.tags.toLowerCase().includes('vms') ||
      (o.note_attributes || []).some(a => a.name === 'vms_id')
    )
  );
}
