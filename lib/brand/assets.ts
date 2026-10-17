/**
 * Approved TuRnMaRk artwork from the supplied brand asset pack.
 *
 * Keep application code on this allowlist. Assets excluded by the Stage 1 audit
 * are intentionally absent until a clean source or an approved cleanup exists.
 */
export const TURNMARK_ASSETS = {
  branding: {
    symbol: { src: "/assets/turnmark/branding/brand_symbol.png", width: 115, height: 98, alt: "TuRnMaRk symbol" },
    wordmark: { src: "/assets/turnmark/branding/brand_wordmark.png", width: 280, height: 62, alt: "TuRnMaRk" },
  },
  auth: {
    receptionist: { src: "/assets/turnmark/auth/welcome-receptionist.jpg", width: 1024, height: 1280, alt: "TuRnMaRk receptionist working at a laptop" },
    trustedAvatars: { src: "/assets/turnmark/auth/trusted-avatars.jpg", width: 1280, height: 426, alt: "A group of professionals" },
    gradientDecoration: { src: "/assets/turnmark/auth/auth-gradient-decoration.jpg", width: 1254, height: 1254, alt: "Sunset gradient decoration" },
    testimonialReference: { src: "/assets/turnmark/auth/testimonial-card-reference.jpg", width: 1280, height: 853, alt: "Testimonial card design reference" },
  },
  characters: {
    student: { src: "/assets/turnmark/characters/student_character.png", width: 195, height: 215, alt: "Student holding a tablet" },
    healthcareProfessional: { src: "/assets/turnmark/characters/healthcare_professional.jpg", width: 1066, height: 1280, alt: "Healthcare professional" },
    businessProfessional: { src: "/assets/turnmark/characters/business_professional.jpg", width: 1066, height: 1280, alt: "Business professional holding a tablet" },
  },
  hero: {
    reception: { src: "/assets/turnmark/hero/reception-hero.jpg", width: 1280, height: 960, alt: "Customer using TuRnMaRk at a reception desk" },
  },
  industries: {
    government: { src: "/assets/turnmark/industries/government_building.png", width: 271, height: 130, alt: "Government service building" },
    healthcare: { src: "/assets/turnmark/industries/hospital_building.png", width: 253, height: 127, alt: "Hospital building" },
    education: { src: "/assets/turnmark/industries/school_building.png", width: 251, height: 127, alt: "School building" },
  },
  illustrations: {
    calendar: { src: "/assets/turnmark/illustrations/calendar_3d.png", width: 112, height: 90, alt: "Calendar with a confirmation check" },
    clock: { src: "/assets/turnmark/illustrations/clock_3d.png", width: 113, height: 89, alt: "Clock" },
    success: { src: "/assets/turnmark/illustrations/success_badge.png", width: 161, height: 145, alt: "Success check" },
    waitingChairs: { src: "/assets/turnmark/illustrations/waiting_chairs.png", width: 175, height: 140, alt: "Waiting-room chairs" },
  },
  queue: {
    platformScene: { src: "/assets/turnmark/queue/queue-platform-scene.jpg", width: 1280, height: 719, alt: "Illustration of a customer phone beside a TuRnMaRk queue workspace" },
  },
  icons: {
    analytics: { src: "/assets/turnmark/icons/analytics_icon_card.png", width: 121, height: 82, alt: "Analytics" },
    appointments: { src: "/assets/turnmark/icons/appointment_icon_card.png", width: 120, height: 82, alt: "Appointments" },
    attendance: { src: "/assets/turnmark/icons/attendance_icon_card.png", width: 119, height: 82, alt: "Attendance" },
    bank: { src: "/assets/turnmark/icons/bank_icon_card.png", width: 119, height: 80, alt: "Bank" },
    business: { src: "/assets/turnmark/icons/business_icon_card.png", width: 121, height: 80, alt: "Business" },
    government: { src: "/assets/turnmark/icons/government_icon_card.png", width: 122, height: 80, alt: "Government" },
    healthcare: { src: "/assets/turnmark/icons/hospital_icon_card.png", width: 120, height: 80, alt: "Hospital" },
    queue: { src: "/assets/turnmark/icons/queue_icon_card.png", width: 119, height: 82, alt: "Queue" },
    reports: { src: "/assets/turnmark/icons/reports_icon_card.png", width: 122, height: 82, alt: "Reports" },
    school: { src: "/assets/turnmark/icons/school_icon_card.png", width: 118, height: 80, alt: "School" },
  },
} as const;

export type TurnmarkAssetCategory = keyof typeof TURNMARK_ASSETS;

type TurnmarkAssetGroups = typeof TURNMARK_ASSETS;

export type TurnmarkAsset = {
  [Category in keyof TurnmarkAssetGroups]: TurnmarkAssetGroups[Category][keyof TurnmarkAssetGroups[Category]];
}[keyof TurnmarkAssetGroups];
