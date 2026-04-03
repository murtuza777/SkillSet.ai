import { create } from "zustand";

interface UiState {
  mobileMenuOpen: boolean;
  selectedSkillScope: string;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  setSelectedSkillScope: (value: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileMenuOpen: false,
  selectedSkillScope: "",
  toggleMobileMenu: () =>
    set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  setSelectedSkillScope: (value) => set({ selectedSkillScope: value }),
}));
