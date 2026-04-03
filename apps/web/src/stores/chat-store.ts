import { create } from "zustand";

import type { Message } from "@/types/domain";

interface ChatState {
  activeRoomId: string | null;
  connectionState: "idle" | "connecting" | "open" | "closed";
  messagesByRoom: Record<string, Message[]>;
  typingByRoom: Record<string, string[]>;
  setActiveRoomId: (roomId: string | null) => void;
  setConnectionState: (state: ChatState["connectionState"]) => void;
  setRoomMessages: (roomId: string, messages: Message[]) => void;
  addRoomMessage: (roomId: string, message: Message) => void;
  setTypingUsers: (roomId: string, users: string[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeRoomId: null,
  connectionState: "idle",
  messagesByRoom: {},
  typingByRoom: {},
  setActiveRoomId: (roomId) => set({ activeRoomId: roomId }),
  setConnectionState: (state) => set({ connectionState: state }),
  setRoomMessages: (roomId, messages) =>
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: messages,
      },
    })),
  addRoomMessage: (roomId, message) =>
    set((state) => {
      const existing = state.messagesByRoom[roomId] ?? [];

      if (existing.some((entry) => entry.id === message.id)) {
        return state;
      }

      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: [...existing, message],
        },
      };
    }),
  setTypingUsers: (roomId, users) =>
    set((state) => ({
      typingByRoom: {
        ...state.typingByRoom,
        [roomId]: users,
      },
    })),
}));
