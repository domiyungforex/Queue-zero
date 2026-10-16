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
  characters: {
    student: { src: "/assets/turnmark/characters/student_character.png", width: 195, height: 215, alt: "Student holding a tablet" },
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
