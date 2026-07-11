import type {
  Fragrance,
  Outfit,
  Profile,
  ProtocolStepDef,
  StandardDef,
} from "./types";

/**
 * Russ's starting system. Every item here is editable inside the app
 * (System tab) — these defaults exist so day one already feels designed,
 * not empty. Wording is part of the product: short, direct, second person.
 */

export const DEFAULT_PROFILE: Profile = {
  name: "Russ",
  wakeTime: "05:30",
  sleepTime: "22:30",
  hydrationTargetMl: 3000,
  hydrationStepMl: 250,
};

export const DEFAULT_MORNING_STEPS: ProtocolStepDef[] = [
  {
    id: "m-rise",
    title: "Rise at first alarm",
    detail: "No negotiation. The day starts on your terms.",
  },
  {
    id: "m-water",
    title: "Drink 500ml of water",
    detail: "Rehydrate before anything else gets your attention.",
  },
  {
    id: "m-cold",
    title: "Cold shower",
    detail: "Two minutes. Decide who's in charge early.",
  },
  {
    id: "m-skin",
    title: "Skincare",
    detail: "Cleanse, moisturise, SPF.",
  },
  {
    id: "m-groom",
    title: "Groom to standard",
    detail: "Hair set, face lined up, nails clean.",
  },
  {
    id: "m-dress",
    title: "Dress with intention",
    detail: "Wear today's recommendation. No second-guessing.",
  },
  {
    id: "m-fragrance",
    title: "Fragrance on",
    detail: "Two sprays. Signature applied.",
  },
  {
    id: "m-intention",
    title: "Set today's intention",
    detail: "One line: what must be true by tonight?",
  },
];

export const DEFAULT_NIGHT_STEPS: ProtocolStepDef[] = [
  {
    id: "n-screens",
    title: "Screens down",
    detail: "The last hour belongs to you, not the feed.",
  },
  {
    id: "n-skin",
    title: "Evening skincare",
    detail: "Cleanse and repair.",
  },
  {
    id: "n-layout",
    title: "Lay out tomorrow",
    detail: "Outfit ready. Zero morning decisions.",
  },
  {
    id: "n-standards",
    title: "Review your standards",
    detail: "Mark what you held. Own what you didn't.",
  },
  {
    id: "n-bed",
    title: "Lights out on time",
    detail: "Recovery is training.",
  },
];

export const DEFAULT_STANDARDS: StandardDef[] = [
  {
    id: "s-posture",
    title: "Posture tall and open",
    detail: "Shoulders back in every room you enter.",
  },
  {
    id: "s-speech",
    title: "Speak with intention",
    detail: "Slower, lower, fewer words.",
  },
  {
    id: "s-complaints",
    title: "Zero complaints",
    detail: "State the problem or fix it. Never vent.",
  },
  {
    id: "s-eyes",
    title: "Steady eye contact",
    detail: "Relaxed, present, unhurried.",
  },
  {
    id: "s-phone",
    title: "Phone away in company",
    detail: "Full attention is rare. Be rare.",
  },
  {
    id: "s-move",
    title: "Move for 30 minutes",
    detail: "Train, walk, anything. Daily.",
  },
  {
    id: "s-food",
    title: "Eat like Prime",
    detail: "Protein first. Nothing from a wrapper.",
  },
];

export const DEFAULT_OUTFITS: Outfit[] = [
  {
    id: "o-training",
    name: "Training kit",
    occasion: "training",
    note: "Black shorts, fitted tee, runners.",
  },
  {
    id: "o-casual",
    name: "Clean casual",
    occasion: "casual",
    note: "Dark denim, white tee, white sneakers.",
  },
  {
    id: "o-smart",
    name: "Smart standard",
    occasion: "smart",
    note: "Chinos, knit polo, chelsea boots.",
  },
  {
    id: "o-sharp",
    name: "Sharp",
    occasion: "sharp",
    note: "Navy blazer, open collar, dress boots.",
  },
];

export const DEFAULT_FRAGRANCES: Fragrance[] = [
  {
    id: "f-fresh",
    name: "Daylight citrus",
    profile: "fresh",
    note: "Office hours and sunlight.",
  },
  {
    id: "f-warm",
    name: "Amber evening",
    profile: "warm",
    note: "Dinners and low light.",
  },
  {
    id: "f-intense",
    name: "Night signature",
    profile: "intense",
    note: "Weekends. Leave a trail.",
  },
];
