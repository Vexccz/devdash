import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '{{DISPLAY_NAME}}',
  description: 'Built with Next.js, Tailwind, Auth.js, Prisma, and Stripe',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
