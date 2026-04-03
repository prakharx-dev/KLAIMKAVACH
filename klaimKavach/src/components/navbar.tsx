import { Link, useLocation } from "wouter";
import { Shield, User, LogOut, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [location] = useLocation();
  const { isAuthenticated, isAdmin, logout } = useAuth();

  const appNavItems = isAdmin
    ? [{ href: "/admin", label: "Admin Panel" }]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/claim", label: "Claim" },
        { href: "/fraud", label: "Trust Score" },
      ];

  const publicPages = ["/", "/features", "/pricing", "/about"];
  const isPublicPage = publicPages.includes(location);
  const isAuthPage = location === "/register";
  const isAppPage = !isPublicPage && !isAuthPage;

  return (
    <>
      {/* ── Public navbar (home, features, pricing, about) ── */}
      {isPublicPage && (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <img
                src="/logo.jpg"
                alt="KlaimKavach"
                className="w-7 h-7 rounded-md object-contain"
              />
              <span className="font-semibold text-sm tracking-tight text-foreground">
                KlaimKavach
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {[
                { href: "/features", label: "Features" },
                { href: "/pricing", label: "Pricing" },
                { href: "/about", label: "About" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm transition-colors cursor-pointer font-medium ${
                    location === item.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Link href={isAdmin ? "/admin" : "/dashboard"}>
                    <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      {isAdmin ? "Admin Panel" : "Dashboard"}
                    </span>
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/10 transition-all"
                  >
                    Logout
                  </motion.button>
                </>
              ) : (
                <>
                  <Link href="/register">
                    <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      Sign in
                    </span>
                  </Link>
                  <Link href="/register">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex cursor-pointer px-4 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition-all"
                    >
                      Get Started
                    </motion.div>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ── App navbar ── */}
      {isAppPage && (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <img
                src="/logo.jpg"
                alt="KlaimKavach"
                className="w-6 h-6 rounded-md object-contain"
              />
              <span className="font-semibold text-sm tracking-tight text-foreground">
                KlaimKavach
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {appNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative py-1 ${
                    location === item.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {location === item.href && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute left-0 right-0 bottom-0 h-0.5 bg-foreground"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              ))}
            </nav>

            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center cursor-pointer hover:bg-muted transition-colors border border-border">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </header>
      )}
    </>
  );
}
