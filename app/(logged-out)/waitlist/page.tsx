import { WaitlistForm } from '@/app/(logged-out)/waitlist/components/waitlist-form';

export default function WaitlistPage() {
  return (
    <div className="flex flex-col items-center p-6 pt-16 text-center sm:pt-20 md:pt-24">
      <div className="container max-w-3xl space-y-6 animate-in fade-in duration-500 ease-out">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
          Kosuke
        </h1>
        <p className="text-xl font-medium text-muted-foreground sm:text-2xl lg:text-3xl animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out delay-100">
          Ship production-ready web apps in minutes
        </p>
        <p className="text-lg text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out delay-200">
          Kosuke is the first open-source vibe coding platform. Check it out on{' '}
          <a
            href="https://github.com/filopedraz/kosuke-core"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4 hover:text-primary"
          >
            GitHub
          </a>
          . We are working on a Managed Version. Get notified when we launch.
        </p>

        <div className="mx-auto w-full max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-400">
          <WaitlistForm />
        </div>
      </div>
    </div>
  );
}
