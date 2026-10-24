import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './globals.css';
import './polish.css';

export const metadata: Metadata = {
  title: 'Casebridge · AICTE complaint coordination',
  description:
    'An institution-first workspace for tracking complaints and coordinating across AICTE bureaus. Prototype by Team AGNEYA.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
