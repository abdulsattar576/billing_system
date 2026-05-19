// app/layout.tsx
import "./globals.css";
import ClientLayoutWrapper from "./components/ClientLayoutWrapper";
import ClientCronInitializer from "./components/CrobJobWarpper";


export const metadata = {
  title: "FCN || the brand",
  description: "Sidebar everywhere",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientCronInitializer/>
        <ClientLayoutWrapper>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}
