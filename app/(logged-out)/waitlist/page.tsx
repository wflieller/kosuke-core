import { WaitlistForm } from '@/app/(logged-out)/waitlist/components/waitlist-form';

export default function WaitlistPage() {
  return (
    <div className="container max-w-3xl space-y-8 text-center py-12 md:py-24">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">Kosuke</h1>
      <p className="text-2xl font-medium tracking-tight sm:text-3xl md:text-4xl">
        Ship production-ready web apps in a matter of minutes
      </p>
      <p className="text-lg text-muted-foreground md:text-xl">
        Kosuke is the first open-source vibe coding platform
      </p>

      <div className="mx-auto max-w-md space-y-4 pt-8">
        <p className="text-sm text-muted-foreground md:text-base">
          We are working on a Managed Version. Get notified when we launch.
        </p>
        <WaitlistForm />
      </div>
    </div>
  );
}
