import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Providers } from "@/providers/providers";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: { default: "Productivity Tracker", template: "%s | Productivity Tracker" },
  description: "Plan your day and track what actually happened",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
