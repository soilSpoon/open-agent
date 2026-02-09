import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { SettingsProvider } from "@/components/settings-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { WorkerInit } from "@/components/worker-init";
import { Providers } from "./providers";

export { metadata } from "./layout-metadata";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SettingsProvider>
            <SidebarProvider>
              <WorkerInit />
              <div className="grid min-h-svh w-full md:grid-cols-[280px_1fr]">
                <div className="hidden border-r bg-muted/40 md:block">
                  <Sidebar className="flex" />
                </div>
                <div className="flex flex-col">
                  <MobileHeader />
                  <Header />
                  <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 bg-background">
                    <Providers>{children}</Providers>
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
