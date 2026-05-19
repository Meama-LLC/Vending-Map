import { NextResponse } from 'next/server';
import { buildAuthUrl, SHOPIFY_SHOP } from '../../../../lib/shopify';
import crypto from 'crypto';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop') || SHOPIFY_SHOP;

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
  }

  // Generate a random state nonce to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vending-map-pi.vercel.app';
  const redirectUri = `${appUrl}/api/shopify/callback`;

  const authUrl = buildAuthUrl(shop, redirectUri, state);

  // Store state in a short-lived cookie for verification in the callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  return response;
}
