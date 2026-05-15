import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, FileText, BarChart2, Home,
  ChevronLeft, ChevronRight, Moon, Sun, Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: BarChart2, label: "Dashboard" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/research", icon: Search, label: "Research" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/reports", icon: FileText, label: "Reports" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 min-h-[57px]">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Cpu size={15} className="text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="font-semibold text-sm text-foreground whitespace-nowrap overflow-hidden"
              >
                Synapse AI
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="h-px bg-sidebar-border mx-3 mb-2" />

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5 py-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.97 }}
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer transition-colors select-none",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-2 space-y-1 border-t border-sidebar-border">
          <button
            onClick={toggle}
            data-testid="button-theme-toggle"
            className="flex items-center gap-3 px-2.5 py-2 rounded-md w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs whitespace-nowrap"
                >
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            data-testid="button-sidebar-toggle"
            className="flex items-center gap-3 px-2.5 py-2 rounded-md w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs whitespace-nowrap"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
