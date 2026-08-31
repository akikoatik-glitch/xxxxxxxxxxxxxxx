"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

const LINKS = [
  { href: siteConfig.links.home, label: "Home" },
  { href: siteConfig.links.predictions, label: "Predictions" },
  { href: siteConfig.links.news, label: "News" },
  { href: siteConfig.links.leagues, label: "Leagues" },
  { href: siteConfig.links.teams, label: "Teams" },
  { href: siteConfig.links.stats, label: "Statistics" },
  { href: "/#how-it-works", label: "How It Works" }
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        scrolled
          ? "border-pitch-700/60 bg-pitch-900/95 shadow-[0_8px_32px_-12px_rgba(8,38,28,0.7)] backdrop-blur-xl"
          : "border-transparent bg-pitch-900"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href={siteConfig.links.home} className="group flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10">
            <span className="relative h-5 w-5 rounded-full bg-white">
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-pitch-900" />
              <span className="absolute left-1/2 top-1/2 h-[3px] w-5 -translate-x-1/2 -translate-y-1/2 bg-pitch-900" />
            </span>
          </span>
          <span className="font-display text-lg tracking-wider">
            <span className="font-bold text-white">XWHIZ</span>
            <span className="font-medium text-grass-400"> .COM</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href) && link.href !== "/";
            const isHome = link.href === "/" && pathname === "/";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active || isHome
                    ? "bg-white/12 text-white"
                    : "text-white/65 hover:bg-white/8 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href={siteConfig.links.predictions} className="btn-primary !px-4 !py-2 text-sm">
            Today&apos;s predictions
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/15 bg-pitch-900/98 backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {LINKS.map((link) => {
                const active = pathname.startsWith(link.href) && link.href !== "/";
                const isHome = link.href === "/" && pathname === "/";
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-medium",
                      active || isHome ? "bg-white/12 text-white" : "text-white/70"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Link href={siteConfig.links.predictions} className="btn-primary mt-2">Today&apos;s predictions</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
