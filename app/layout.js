import './globals.css';

export const metadata = {
  title: 'Your account',
  description: 'A personal dashboard and profile.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
