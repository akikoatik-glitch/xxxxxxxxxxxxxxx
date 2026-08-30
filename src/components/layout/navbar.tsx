"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/predictions", label: "Predictions" },
  { href: "/leagues", label: "Leagues" },
  { href: "/teams", label: "Teams" },
  { href: "/stats", label: "Model Stats" }
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
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-line/70 bg-bg/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-elevated shadow-inner3d">
            <span className="relative h-5 w-5 rounded-full bg-white shadow-inner3d">
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-[#12201a]" />
              <span className="absolute left-1/2 top-1/2 h-[3px] w-5 -translate-x-1/2 -translate-y-1/2 bg-[#12201a]" />
            </span>
          </span>
          <span className="font-display text-lg tracking-wider">
            <span className="font-bold text-ink">XWHIZ</span>
            <span className="font-medium text-accent"> LITE</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  active ? "bg-elevated text-accent" : "text-mute hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/predictions" className="btn-primary !px-4 !py-2 text-sm">
            Today&apos;s predictions
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-elevated text-ink md:hidden"
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
            className="overflow-hidden border-b border-line bg-bg/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm font-medium",
                    pathname.startsWith(link.href) ? "bg-elevated text-accent" : "text-mute"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/predictions" className="btn-primary mt-2">Today&apos;s predictions</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}