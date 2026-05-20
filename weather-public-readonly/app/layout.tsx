import type { ReactNode } from "react";

export const metadata = {
  title: "Weather Public Readonly for Orchet",
  description: "Get current public weather for a city without user authentication.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
