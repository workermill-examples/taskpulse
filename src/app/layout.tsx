import { Inter, JetBrains_Mono } from "next/font/google";
import SessionProvider from "@/components/shared/SessionProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "TaskPulse",
  description: "Background Tasks, Monitored.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.className} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-950 text-gray-100">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}