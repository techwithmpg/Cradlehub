/**
 * Scoped Design Tokens for CradleHub Staff PWA
 *
 * Adheres strictly to PWA-C4 UI/UX Specification Section 2:
 * Warm flat page surfaces, white work cards, forest green actions, and restrained gold accents.
 */

export const STAFF_PWA_TOKENS = {
  colors: {
    // Core surfaces
    pageBg: "#F7F3EB", // Cream page surface
    surface: "#FFFFFF", // White work cards
    surfaceWarm: "#FAF8F5", // Warm card secondary
    surfaceRaised: "#FFFFFF",

    // Brand colors
    forest: "#163A2B", // Primary brand forest green
    forestDark: "#10261D", // Pressed/active forest
    gold: "#C8A96B", // Warm gold accent
    goldLight: "#DFCA9B", // Light gold tint

    // Typography
    textMain: "#1E293B", // Slate 800 - high contrast
    textSecondary: "#475569", // Slate 600 - readable secondary
    textMuted: "#64748B", // Slate 500 - metadata
    textInverse: "#FFFFFF",

    // Status chips
    successText: "#1A4A2A",
    successBg: "#EEF8F2",
    warningText: "#654600",
    warningBg: "#FFF4DB",
    errorText: "#9B1C20",
    errorBg: "#FDEBEC",

    // Controls and borders
    border: "#EAE4DC",
    borderStrong: "#D4C8BC",
    borderControl: "#64748B",
    focusOutline: "#163A2B",
  },
  touch: {
    minTarget: "48px",
    scanTarget: "56px",
    spacing: "8px",
  },
  typography: {
    pageTitle: "text-2xl font-bold tracking-tight",
    sectionTitle: "text-lg font-semibold tracking-normal",
    body: "text-base font-normal leading-relaxed",
    secondary: "text-sm font-normal text-slate-600",
    caption: "text-xs font-medium leading-none",
    timer: "text-2xl font-semibold tabular-nums",
  },
} as const;
