import './globals.css';
import Header from '@/components/Header';

// ✅ Metadata is used by Next.js for SEO and automatic head population (not rendered manually)
export const metadata = {
  title: "Swing Swing",                     // Page title in browser tabs
  description: "Golf swing comparison app", // Shown in search previews
};

// ✅ This RootLayout wraps your entire app. It defines your HTML skeleton.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ CRUCIAL: This ensures mobile browsers use the actual screen width */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Preload critical resources */}
        <link rel="preload" href="/swing-swing-logo.svg" as="image" />
        {/* Use prefetch instead of preload for video since 'as="video"' is not supported */}
        <link rel="prefetch" href="/videos/test-clip.mp4" />
      </head>
      <body>
        {/* Beta badge in upper left with drop shadow */}
        <div style={{position: 'fixed', top: 0, left: 0, zIndex: 1000}}>
          <img src="/beta.svg" alt="Beta badge" style={{height: 75, width: 'auto', filter: 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.45))'}} />
        </div>
        <Header />
        {/* ✅ This renders your actual page content */}
        {children}
      </body>
    </html>
  );
}