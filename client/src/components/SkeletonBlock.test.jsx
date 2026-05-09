import { render } from '@testing-library/react';
import { SkeletonBlock } from './SkeletonBlock.jsx';

describe('SkeletonBlock', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom width and height via style', () => {
    const { container } = render(<SkeletonBlock width="50%" height="2rem" />);
    expect(container.firstChild.style.width).toBe('50%');
    expect(container.firstChild.style.height).toBe('2rem');
  });

  it('has shimmer class', () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.firstChild).toHaveClass('shimmer');
  });
});
