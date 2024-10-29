"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Music, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initSocket } from "@/lib/socket";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
  ];

  const handleNavigation = async (href: string) => {
    setIsOpen(false);

    // Disconnect socket if it exists
    const socket = initSocket();
    if (socket.connected) {
      socket.disconnect();
    }

    // Navigate first
    await router.push(href);

    // Force a window reload after a short delay, for some reason the socket connection won't refresh with typical NextJs navigation (Link or router.push)
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleCreateGame = async () => {
    setIsOpen(false);

    const socket = initSocket();
    if (socket.connected) {
      socket.disconnect();
    }

    const roomCode = generateRoomCode();
    await router.push(`/room/${roomCode}`);

    // Force a window reload after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 100);
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
    <nav className="bg-gradient-to-r from-purple-600 to-blue-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => handleNavigation("/")}
              className="flex-shrink-0 cursor-pointer"
            >
              <Music className="h-8 w-8 text-white" />
            </button>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium",
                      pathname === item.href
                        ? "bg-blue-700 text-white"
                        : "text-white hover:bg-purple-500 hover:bg-opacity-75"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <Button variant="secondary" onClick={handleCreateGame}>
              Create Game
            </Button>
          </div>
          {/* Mobile menu button */}
          <div className="-mr-2 flex md:hidden">
            <Button
              variant="ghost"
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-purple-500 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-purple-600 focus:ring-white"
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
                  "block w-full text-left px-3 py-2 rounded-md text-base font-medium",
                  pathname === item.href
                    ? "bg-blue-700 text-white"
                    : "text-white hover:bg-purple-500 hover:bg-opacity-75"
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-purple-500">
            <div className="px-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleCreateGame}
              >
                Create Game
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
