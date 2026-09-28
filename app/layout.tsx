import type { Metadata } from 'next';
import './globals.css';
import './landing.css';
import './desk/operations.css';
import './desk/kit-contents.css';
import './desk/agent-rehearsal.css';
export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: 'Understudy — rehearse before the handoff',
  description:
    'Private equipment workspaces, policy rehearsal and lending receipts.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
