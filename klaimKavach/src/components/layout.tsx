import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const appNavItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/claim", label: "Claim" },
    { href: "/fraud", label: "Trust Score" },
  ];

  const publicPages = ["/", "/features", "/pricing", "/about"];
  const isPublicPage = publicPages.includes(location);
  const isHomePage = location === "/";
  const isAuthPage = location === "/register";
  const isAppPage = !isPublicPage && !isAuthPage;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* ── Main content ── */}
      <main
        className={`flex-1 flex flex-col ${isAppPage ? "container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl py-10" : ""} ${isPublicPage && !isHomePage ? "pt-14" : ""}`}
      >
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex flex-col"
        >
          {children}
        </motion.div>
      </main>

      {/* ── Mobile bottom nav (app pages only) ── */}
      {isAppPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
          <div className="flex items-center justify-around p-3">
            {appNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 min-w-16 transition-colors ${
                  location === item.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span className="text-xs font-medium">{item.label}</span>
                {location === item.href && (
                  <div className="w-1 h-1 rounded-full bg-foreground mt-1" />
                )}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
