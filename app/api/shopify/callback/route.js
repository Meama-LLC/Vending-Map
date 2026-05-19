import { NextResponse } from 'next/server';
import { getAccessToken, verifyHmac } from '../../../../lib/shopify';
import { cookies } from 'next/headers';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const shop  = searchParams.get('shop');
  const state = searchParams.get('state');
  const hmac  = searchParams.get('hmac');

  // 1. Verify HMAC signature from Shopify
  if (!hmac || !verifyHmac(Object.fromEntries(searchParams))) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 403 });
  }

  // 2. Verify state matches what we set in the auth step (CSRF protection)
  const cookieStore = cookies();
  const savedState = cookieStore.get('shopify_oauth_state')?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.json({ error: 'State mismatch — possible CSRF' }, { status: 403 });
  }

  // 3. Exchange code for access token
  let accessToken;
  try {
    accessToken = await getAccessToken(shop, code);
  } catch (err) {
    console.error('Token exchange error:', err);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 });
  }

  // 4. Store the access token securely in an httpOnly cookie
  //    (For production, store in a DB/KV store keyed by shop domain instead)
  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://vending-map-pi.vercel.app'}/?shopify=connected`
  );

  response.cookies.set('shopify_access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });
  response.cookies.set('shopify_shop', shop, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  // Clear the nonce cookie
  response.cookies.delete('shopify_oauth_state');

  return response;
}
