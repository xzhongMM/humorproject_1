import './globals.css';

export const metadata = {
  title: 'Lion Laughs',
  description: 'AI meme captions for Columbia, ranked by you.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
