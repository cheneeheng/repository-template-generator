import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarkModeToggle } from './DarkModeToggle.jsx';

describe('DarkModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('reads initial state from localStorage (dark)', () => {
    localStorage.setItem('color-scheme', 'dark');
    render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to matchMedia when localStorage is empty', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles dark class on click and updates localStorage', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('color-scheme')).toBe('dark');
  });

  it('OS scheme change updates state when no explicit localStorage preference', () => {
    let changeHandler;
    const mq = {
      matches: false,
      addEventListener: vi.fn((_, h) => { changeHandler = h; }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mq);

    render(<DarkModeToggle />);
    act(() => changeHandler({ matches: true }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('OS scheme change is ignored when explicit preference is stored', () => {
    localStorage.setItem('color-scheme', 'light');
    const mq = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mq);

    render(<DarkModeToggle />);
    // Component returns early from useEffect when localStorage has explicit preference,
    // so no change listener is registered and OS preference has no effect.
    expect(mq.addEventListener).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('removes OS scheme change listener on unmount', () => {
    const mq = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mq);

    const { unmount } = render(<DarkModeToggle />);
    unmount();
    expect(mq.removeEventListener).toHaveBeenCalled();
  });
});
