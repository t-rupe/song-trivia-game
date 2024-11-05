"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Music, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/dark-mode-toggle";
import { JoinButton } from "./join-game-dialog";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
  ];

  const handleNavigation = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleCreateGame = () => {
    setIsOpen(false);
    const roomCode = generateRoomCode();
    router.push(`/room/${roomCode}`);
  };

  const generateRoomCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  };

  return (
    <nav className="bg-default">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => handleNavigation("/")}
              className="flex-shrink-0 cursor-pointer"
            >
              <Music className="h-8 w-8 text-secondary-foreground" />
            </button>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "bg-secondary text-secondary-foreground"
                        : "text-secondary-foreground hover:bg-primary/80"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden md:flex space-x-4 items-center">
            <Button variant="default" onClick={handleCreateGame}>
              Create Game
            </Button>
            <JoinButton />

            <div className="pt-[2px]">
              <ModeToggle />
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="-mr-2 flex md:hidden">
            <Button
              variant="ghost"
              className={cn(
                "inline-flex items-center justify-center p-2 rounded-md",
                "text-primary-foreground hover:bg-primary/80",
                "focus:outline-none focus:ring-2 focus:ring-offset-2",
                "focus:ring-offset-primary focus:ring-white"
              )}
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                className={cn(
                  "block w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors",
                  pathname === item.href
                    ? "bg-secondary text-secondary-foreground"
                    : "text-primary-foreground hover:bg-primary/80"
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-primary/20">
            <div className="px-2 space-y-2">
              <Button
                variant="default"
                className="w-full"
                onClick={handleCreateGame}
              >
                Create Game
              </Button>
              <JoinButton />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
