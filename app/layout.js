import './globals.css';

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
      </head>

      <body> 
        {/* ✅ This renders your actual page content */}
        {children}
      </body>
    </html>
  );
}
