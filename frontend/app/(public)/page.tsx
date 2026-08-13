// frontend/app/(public)/page.tsx
import { HeroSection } from '@/components/property/HeroSection'
import { FeaturedSection } from '@/components/property/FeaturedSection'
import { StatsSection } from '@/components/property/StatsSection'
import { ThreeSSection } from '@/components/property/ThreeSSection'
import { CTASection } from '@/components/property/CTASection'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'JerryHomes — Premium Rental Properties in Abuja',
  description: "Find premium rental apartments, houses, duplexes and penthouses across Abuja's finest neighbourhoods.",
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <ThreeSSection />
      <FeaturedSection />
      <CTASection />
    </>
  )
}