import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '{{PROJECT_NAME}}',
  description: '{{PROJECT_NAME}} application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
