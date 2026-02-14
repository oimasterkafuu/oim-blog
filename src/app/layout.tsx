import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BlogProvider } from "@/components/blog-provider";
import { ThemeProvider } from "next-themes";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = 'force-dynamic'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

async function getSettings() {
  try {
    const settings = await db.setting.findMany();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);
  } catch {
    return {};
  }
}

async function getNavData() {
  try {
    const [categories, pages] = await Promise.all([
      db.category.findMany({
        orderBy: { order: 'asc' },
        select: { id: true, name: true, slug: true }
      }),
      db.page.findMany({
        where: { status: 'published' },
        orderBy: { order: 'asc' },
        select: { id: true, title: true, slug: true }
      })
    ]);
    return { categories, pages };
  } catch {
    return { categories: [], pages: [] };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteName = settings.site_name || "我的博客";
  const siteDescription = settings.site_description || "一个简洁优雅的博客";

  const metadata: Metadata = {
    title: {
      default: siteName,
      template: `%s - ${siteName}`,
    },
    description: siteDescription,
    keywords: settings.site_keywords?.split(",") || ["博客", "技术", "分享"],
  };

  if (settings.site_icon) {
    metadata.icons = {
      icon: [
        { url: settings.site_icon, type: 'image/png' },
      ],
      apple: [
        { url: settings.site_icon, type: 'image/png' },
      ],
    };
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  const { categories, pages } = await getNavData();
  const user = await getSession();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {settings.site_icon && (
          <>
            <link rel="icon" href={settings.site_icon} type="image/png" />
            <link rel="apple-touch-icon" href={settings.site_icon} />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BlogProvider initialSettings={settings} initialCategories={categories} initialPages={pages} initialUser={user}>
            {children}
          </BlogProvider>
        </ThemeProvider>
        <Toaster />
        <Sonner />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
