'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Shield, TrendingUp, Heart } from 'lucide-react'

const pillars = [
  {
    icon: Shield,
    title: 'Security',
    description:
      'Real estate investments can provide stability and security, offering a tangible asset that generally appreciates over time.',
  },
  {
    icon: TrendingUp,
    title: 'Stability',
    description:
      'Real estate markets tend to be less volatile compared to stocks or other investments, providing a stable income stream through rental properties or potential capital appreciation.',
  },
  {
    icon: Heart,
    title: 'Satisfaction',
    description:
      'Owning real estate can bring personal satisfaction, whether through homeownership, investment returns, or contributing to community development.',
  },
]

export function ThreeSSection() {
  return (
    <section className="py-16 md:py-24 bg-slate-950 relative overflow-hidden">
      {/* Subtle background accents matching brand */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-orange-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-500/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

      <div className="relative container-max section-padding">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <p className="text-orange-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Why Real Estate
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">3S&apos;s</span> in Real Estate
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Security · Stability · Satisfaction — the pillars that make property investment with JerryHomes a smart choice.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Promotional image */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-br from-orange-500/40 to-yellow-500/20 rounded-2xl blur-sm opacity-60 group-hover:opacity-80 transition-opacity" />
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <Image
                src="/3s-in-real-estate.jpg"
                alt="Jerry Homes — The 3S's in Real Estate: Security, Stability and Satisfaction. Contact 09026784812 or 07064688383"
                width={1000}
                height={1007}
                className="w-full h-auto object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={75}
                loading="lazy"
                decoding="async"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAAUABQDASIAAhEBAxEB/8QAGAABAAMBAAAAAAAAAAAAAAAAAAMEBgX/xAAmEAACAgEEAQIHAAAAAAAAAAABAgADEQQSIUFRBTEUIjJTscHh/8QAFwEAAwEAAAAAAAAAAAAAAAAAAQIEA//EABkRAQEAAwEAAAAAAAAAAAAAAAEAAhESBP/aAAwDAQACEQMRAD8Ak1GttS2xDTxzX9XnvGPfuZ569qqd7DPnP6mgv0bu9uRZtLls565wJxlJHyFNpx7jiSeZxB1aZCtSZznAP5iW20xJye4lHRDil9P1V4uWxrXcjPDMSJZXX2tZUrpW4UjG5c8eOeoiNokpG9TcOw+G02Aft/2IiLG//9k="
              />
            </div>
          </div>

          {/* Content pillars */}
          <div className="space-y-8">
            {pillars.map(({ icon: Icon, title, description }, idx) => (
              <div
                key={title}
                className="flex gap-5 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-orange-500/30 transition-all duration-300"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-orange-400 font-bold text-sm">{idx + 1}.</span>
                    <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide">
                      {title}
                    </h3>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/properties"
                className="inline-flex items-center justify-center px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-orange-500/25"
              >
                Explore Properties
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3.5 border border-white/20 hover:border-orange-400/50 text-white font-semibold rounded-xl transition-colors"
              >
                Talk to an Agent
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}