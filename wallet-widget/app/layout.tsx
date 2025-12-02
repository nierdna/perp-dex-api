import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "LynxPay Widget",
    description: "Embeddable deposit widget for any website",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
