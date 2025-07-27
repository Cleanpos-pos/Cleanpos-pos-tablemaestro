
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { getPublicRestaurantSettings } from '@/services/settingsService';

// This function dynamically generates metadata for the page.
export async function generateMetadata(): Promise<Metadata> {
  // Fetch the public settings which include SEO fields.
  const settings = await getPublicRestaurantSettings();

  const title = settings?.seoH1 || settings?.restaurantName || 'Table Maestro V2';
  const description = settings?.seoMetaDescription || 'Restaurant booking and waitlist optimization system.';
  const keywords = settings?.seoKeywords?.split(',').map(k => k.trim()) || [];

  return {
    title: title,
    description: description,
    keywords: keywords,
  };
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
