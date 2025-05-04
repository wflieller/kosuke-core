import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { waitlistEntries } from '@/lib/db/schema';

const waitlistSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the request body
    const { email } = waitlistSchema.parse(body);

    // Insert the email into the waitlist_entries table
    await db
      .insert(waitlistEntries)
      .values({
        email,
        status: 'pending',
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: waitlistEntries.email });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Waitlist error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
