import { ThemeToggle } from '@/components/ui/theme-toggle';
import { CheckCircle2, Circle } from 'lucide-react';

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start max-w-3xl mx-auto w-full">
        <div className="flex justify-between w-full items-center">
          <h2 className="text-xl font-bold">Kosuke Template</h2>
          <ThemeToggle />
        </div>

        <div className="text-center sm:text-left w-full">
          <h1 className="text-4xl font-bold mb-2">Welcome to Kosuke</h1>
          <p className="text-xl text-muted-foreground mb-4">
            The open-source vibe coding platform.{' '}
            <a
              href="https://github.com/filopedraz/kosuke-core"
              className="text-primary underline underline-offset-4 hover:text-primary/90"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </p>
          <p className="text-lg mb-8">Start typing what you want to build...</p>

          <div className="text-left border border-border rounded-lg p-4 bg-card">
            <h2 className="font-semibold mb-3">Here the Kosuke supported features:</h2>
            <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />
                <span>Easy customization</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />
                <span>Lightning fast</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />
                <span>Reusable components</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />
                <span>Modern stack composed of Next 15, React 19, Shadcn UI, and Tailwind</span>
              </li>
              <li className="flex items-start">
                <Circle className="h-5 w-5 mr-2 text-muted-foreground flex-shrink-0" />
                <span>Backend support with Postgres db, Drizzle ORM, and Next.js APIs</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
