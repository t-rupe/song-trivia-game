"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinButton({
  size = "default",
}: {
  size?: "sm" | "default" | "lg" | undefined;
}) {
  const { toast, dismiss } = useToast();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [roomInput, setRoomInput] = useState("");

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // validate room code
    if (roomInput.length !== 4) {
      toast({
        variant: "destructive",
        title: "Invalid Room Code",
        description: "Room code must be exactly 4 characters long.",
      });
      return;
    }

    // if valid room code, dismiss toast and navigate to room
    dismiss();
    router.push(`/room/${roomInput.toUpperCase()}`);
    setIsOpen(false);
    setRoomInput("");
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size={size}>
          Join Game
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Join Game</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the room code to join an existing game.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            placeholder="Enter room code"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            className="uppercase"
            maxLength={4}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleSubmit}>Join</AlertDialogAction>

          <AlertDialogCancel
            className="bg-red-800 text-white"
            onClick={() => setRoomInput("")}
          >
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
