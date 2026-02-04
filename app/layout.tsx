import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { SettingsProvider } from "@/components/settings-provider";
import { ThemeProvider } from "@/components/theme-provider";

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
            <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
              <div className="hidden border-r bg-gray-100/40 lg:block dark:bg-gray-800/40">
                <Sidebar />
              </div>
              <div className="flex flex-col">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
                  {children}
                </main>
              </div>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
