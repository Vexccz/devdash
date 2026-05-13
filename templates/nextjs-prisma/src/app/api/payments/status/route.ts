import { NextResponse } from 'next/server';
import { stripeEnabled, priceId } from '@/lib/stripe';

export async function GET() {
  return NextResponse.json({ enabled: stripeEnabled, priceId });
}
