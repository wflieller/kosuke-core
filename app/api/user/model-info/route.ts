import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getModelForUser, getUserMessageLimit, getPremiumMessageCount } from '@/lib/models';

/**
 * GET /api/user/model-info
 * Returns information about which model the current user can access
 * and their message usage statistics
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the model information based on user subscription
    const modelInfo = await getModelForUser();

    // Get message limit and current count
    const messageLimit = await getUserMessageLimit();
    const messageCount = await getPremiumMessageCount(session.user.id);

    return NextResponse.json({
      ...modelInfo,
      messageCount,
      messageLimit,
    });
  } catch (error) {
    console.error('Error getting model info:', error);
    return NextResponse.json({ error: 'Failed to get model information' }, { status: 500 });
  }
}
