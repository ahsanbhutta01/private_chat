import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Provider } from "@/components/Provider";
import { Toaster } from 'react-hot-toast';

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"]
})

export const metadata: Metadata = {
  title: "Private Chat App",
  description: "Chat will be private b/w user. After sometime (10min) chat will be destryed",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jetBrainsMono.variable}  antialiased`}
      >
        <Toaster position="top-center" toastOptions={{ duration: 2000, removeDelay: 2000 }} />
        <Provider>
          {children}
        </Provider>
      </body>
    </html>
  );
}
