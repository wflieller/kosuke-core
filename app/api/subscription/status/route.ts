import { NextResponse } from 'next/server';

import { canUpgradeSubscription } from '@/lib/actions/subscription';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ isUpgradable: false }, { status: 401 });
    }

    const isUpgradable = await canUpgradeSubscription();

    return NextResponse.json({ isUpgradable });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Failed to check subscription status' }, { status: 500 });
  }
}
