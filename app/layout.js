import './globals.css';

export const metadata = {
  title: 'Hello world',
  description: 'A simple Hello world Next.js app.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
