import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = { title: "Orbit — work, in orbit", description: "A thoughtful workspace to plan projects, share priorities, and keep your team moving." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers><Shell>{children}</Shell></Providers></body></html>; }
