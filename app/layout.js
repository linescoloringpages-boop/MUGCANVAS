import './globals.css';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'http://localhost:3000').replace(/\/$/, '');
const DESC = 'Better deals. Every day. Coupons and deals from stores around the world.';

// The picture and text shown when someone shares a link to the site in WhatsApp, Facebook, Telegram, X, email and so on.
export const metadata = {
  metadataBase: new URL(SITE),
  title: 'Dealora',
  description: DESC,
  openGraph: {
    type: 'website', siteName: 'Dealora', title: 'Dealora - Better deals. Every day.', description: DESC,
    images: [{ url: '/og-image.jpg', width: 1200, height: 800, alt: 'Dealora - Better deals. Every day.' }],
  },
  twitter: { card: 'summary_large_image', title: 'Dealora - Better deals. Every day.', description: DESC, images: ['/og-image.jpg'] },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
