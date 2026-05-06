import { render } from '@testing-library/react';
import { FileIcon } from './FileIcon.jsx';

describe('FileIcon', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(<FileIcon filename="app.js" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies extension-specific class', () => {
    const { container } = render(<FileIcon filename="app.ts" />);
    expect(container.firstChild).toHaveClass('ext-ts');
  });

  it('applies base file-icon class', () => {
    const { container } = render(<FileIcon filename="README.md" />);
    expect(container.firstChild).toHaveClass('file-icon');
  });

  it('renders for filenames without extension', () => {
    const { container } = render(<FileIcon filename="Makefile" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
