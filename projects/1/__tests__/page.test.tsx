import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../app/page';

// Mock the ThemeToggle component
jest.mock('@/components/ui/theme-toggle', () => ({
  __esModule: true,
  ThemeToggle: () => <button aria-label="toggle theme">Toggle Theme</button>,
}));

describe('Home Page', () => {
  it('renders the main heading and title', () => {
    render(<Home />);

    expect(screen.getByText('Kosuke Template')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Kosuke')).toBeInTheDocument();
  });

  it('renders the welcome message and GitHub link', () => {
    render(<Home />);

    expect(screen.getByText('The open-source vibe coding platform.')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Start typing what you want to build...')).toBeInTheDocument();

    const githubLink = screen.getByText('GitHub');
    expect(githubLink.closest('a')).toHaveAttribute(
      'href',
      expect.stringContaining('https://github.com/filopedraz/kosuke-core')
    );
  });

  it('renders the theme toggle', () => {
    render(<Home />);

    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('renders the feature list', () => {
    render(<Home />);

    expect(screen.getByText('Here the Kosuke supported features:')).toBeInTheDocument();
    expect(screen.getByText('Easy customization')).toBeInTheDocument();
    expect(screen.getByText('Lightning fast')).toBeInTheDocument();
    expect(screen.getByText('Reusable components')).toBeInTheDocument();
    expect(
      screen.getByText('Modern stack composed of Next 15, React 19, Shadcn UI, and Tailwind')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Backend support with Postgres db, Drizzle ORM, and Next.js APIs')
    ).toBeInTheDocument();
  });
});
