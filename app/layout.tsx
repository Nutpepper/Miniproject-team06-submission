import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UniLearn — Submission Module | Team 06',
  description: 'Learning Platform · Submission Module · Team 06 UI',
  icons: { icon: '/unilearn-logo.png', apple: '/unilearn-logo.png' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased text-slate-900">
        {children}
      </body>
    </html>
  );
}
