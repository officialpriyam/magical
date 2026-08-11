export interface MotionSitesTemplate {
  id: string
  name: string
  description: string
  category: string
  previewImage: string
  prompt: string
}

export const motionsitesTemplates: MotionSitesTemplate[] = [
  {
    id: 'coffee-shop',
    name: 'Coffee Shop',
    description: 'Warm artisanal coffee shop with menu highlights and gallery',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build a warm, artisanal coffee shop and café website called "Groundwork Coffee" using React + Vite + TypeScript + Tailwind CSS. Include a sticky navbar, full-viewport hero with café image, menu highlights grid (Espresso Drinks, Filter Coffee, All-Day Brunch, Baked Goods), brew methods strip, "From Farm to Cup" section, about section, gallery strip, events section, testimonials, and footer. Use Playfair Display for headings and DM Sans for body text. Colors: warm cream background, espresso brown primary, warm amber accent.'
  },
  {
    id: 'gym',
    name: 'Gym',
    description: 'Modern fitness center with classes and membership tiers',
    category: 'Health & Fitness',
    previewImage: 'https://framerusercontent.com/images/hzor4WeeTCpQ2pf4q2EmNZjLaQE.webp?width=1200&height=630',
    prompt: 'Build a modern gym and fitness center website using React + Vite + TypeScript + Tailwind CSS. Include a bold hero with count-up stats strip, classes grid, membership tiers (Basic, Pro, Elite), trainer cards, testimonials, and contact section. Use Space Grotesk for headings. Colors: near-black background with electric lime accents.'
  },
  {
    id: 'real-estate-agent',
    name: 'Real Estate Agent',
    description: 'Professional real estate with property listings and valuation',
    category: 'Real Estate',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a professional real estate agent website using React + Vite + TypeScript + Tailwind CSS. Include elegant hero, property listing cards with images, count-up stats, about section, valuation CTA, testimonials, and contact form. Use Cormorant Garamond for headings. Colors: white background, charcoal text, gold accents.'
  },
  {
    id: 'hair-salon',
    name: 'Hair Salon',
    description: 'Editorial hair salon with services and booking',
    category: 'Beauty',
    previewImage: 'https://framerusercontent.com/images/t8NpiYoAR8laNE8SUkUwmvoOw4.webp?width=1200&height=630',
    prompt: 'Build a stylish hair salon website using React + Vite + TypeScript + Tailwind CSS. Include editorial hero with background name text, services grid (Cuts, Color, Styling), portfolio strip, team section, booking CTA, and contact. Use Bebas Neue for headings. Colors: near-black background with terracotta accents.'
  },
  {
    id: 'photography-studio',
    name: 'Photography Studio',
    description: 'Black-and-white editorial photography portfolio',
    category: 'Portfolio',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a stunning black-and-white photography portfolio website called "Still Frame Studio" using React + Vite + TypeScript + Tailwind CSS + Framer Motion. Include full-bleed hero portrait, masonry portfolio grid with 12 images, specialties section (Portrait, Editorial, Brand), about section, pricing tiers (Essential £395, Signature £750, Full Day £1400), testimonials, and booking CTA. Use Libre Baskerville for headings. Pure black-and-white aesthetic.'
  },
  {
    id: 'yoga-studio',
    name: 'Yoga Studio',
    description: 'Calming yoga studio with classes and instructors',
    category: 'Health & Fitness',
    previewImage: 'https://framerusercontent.com/images/hzor4WeeTCpQ2pf4q2EmNZjLaQE.webp?width=1200&height=630',
    prompt: 'Build a calming yoga studio website using React + Vite + TypeScript + Tailwind CSS. Include serene hero, class schedule, instructor profiles, membership options, testimonials, and contact. Use soft, earthy colors with clean typography.'
  },
  {
    id: 'lawyer',
    name: 'Lawyer',
    description: 'Professional law firm with practice areas and team',
    category: 'Professional Services',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a professional lawyer website using React + Vite + TypeScript + Tailwind CSS. Include authoritative hero, practice areas section, attorney profiles, case results, testimonials, and contact form. Use serif fonts for headings. Colors: navy blue and gold.'
  },
  {
    id: 'dentist',
    name: 'Dentist',
    description: 'Modern dental clinic with services and booking',
    category: 'Health & Fitness',
    previewImage: 'https://framerusercontent.com/images/hzor4WeeTCpQ2pf4q2EmNZjLaQE.webp?width=1200&height=630',
    prompt: 'Build a modern dental clinic website using React + Vite + TypeScript + Tailwind CSS. Include clean hero, services grid, team section, before/after gallery, testimonials, and appointment booking. Use clean, medical-grade design with blue accents.'
  },
  {
    id: 'bakery',
    name: 'Bakery',
    description: 'Artisan bakery with menu and online ordering',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build a delicious artisan bakery website using React + Vite + TypeScript + Tailwind CSS. Include warm hero with baked goods, menu categories, featured products, about section, ordering CTA, and location. Use warm, inviting colors with Playfair Display headings.'
  },
  {
    id: 'digital-agency',
    name: 'Digital Agency',
    description: 'Creative digital agency with services and portfolio',
    category: 'Professional Services',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a creative digital agency website using React + Vite + TypeScript + Tailwind CSS. Include bold hero, services section, portfolio grid, team profiles, client logos, testimonials, and contact form. Use modern, bold typography with gradient accents.'
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Fine dining restaurant with menu and reservations',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build an elegant fine dining restaurant website using React + Vite + TypeScript + Tailwind CSS. Include atmospheric hero, menu sections, chef story, gallery, reservation CTA, and location. Use sophisticated typography with dark, moody colors.'
  },
  {
    id: 'wedding-venue',
    name: 'Wedding Venue',
    description: 'Romantic wedding venue with galleries and packages',
    category: 'Events',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a romantic wedding venue website using React + Vite + TypeScript + Tailwind CSS. Include beautiful hero, photo gallery, venue spaces, packages, testimonials, and inquiry form. Use elegant, romantic typography with soft colors.'
  },
  {
    id: 'personal-trainer',
    name: 'Personal Trainer',
    description: 'Personal training with programs and transformations',
    category: 'Health & Fitness',
    previewImage: 'https://framerusercontent.com/images/hzor4WeeTCpQ2pf4q2EmNZjLaQE.webp?width=1200&height=630',
    prompt: 'Build a motivating personal trainer website using React + Vite + TypeScript + Tailwind CSS. Include energetic hero, programs, transformation gallery, pricing, testimonials, and booking CTA. Use bold, energetic design with motivational quotes.'
  },
  {
    id: 'cleaning-service',
    name: 'Cleaning Service',
    description: 'Professional cleaning with services and booking',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build a professional cleaning service website using React + Vite + TypeScript + Tailwind CSS. Include clean hero, services grid, pricing packages, before/after gallery, testimonials, and booking form. Use fresh, clean design with blue and green accents.'
  },
  {
    id: 'plumber',
    name: 'Plumber',
    description: 'Reliable plumbing with services and emergency call',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build a reliable plumber website using React + Vite + TypeScript + Tailwind CSS. Include trustworthy hero, services list, emergency call CTA, pricing, testimonials, and contact. Use professional, trustworthy design with blue accents.'
  },
  {
    id: 'car-dealership',
    name: 'Car Dealership',
    description: 'Modern car dealership with inventory and financing',
    category: 'Automotive',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a modern car dealership website using React + Vite + TypeScript + Tailwind CSS. Include sleek hero, vehicle inventory grid, financing calculator, about section, testimonials, and contact. Use automotive-grade design with bold typography.'
  },
  {
    id: 'pet-groomer',
    name: 'Pet Groomer',
    description: 'Friendly pet grooming with services and booking',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build a friendly pet groomer website using React + Vite + TypeScript + Tailwind CSS. Include playful hero, services grid, before/after gallery, pricing, testimonials, and booking form. Use warm, friendly design with pet-friendly colors.'
  },
  {
    id: 'florist',
    name: 'Florist',
    description: 'Beautiful flower shop with arrangements and delivery',
    category: 'Local Business',
    previewImage: 'https://framerusercontent.com/images/vob1JqLgEy4borkaUct7shqE5s.webp?width=1600&height=3154',
    prompt: 'Build a beautiful florist website using React + Vite + TypeScript + Tailwind CSS. Include floral hero, arrangement categories, seasonal collections, about section, delivery info, and contact. Use elegant, botanical design with soft colors.'
  },
  {
    id: 'music-school',
    name: 'Music School',
    description: 'Music school with lessons and instructor profiles',
    category: 'Education',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a inspiring music school website using React + Vite + TypeScript + Tailwind CSS. Include musical hero, instrument categories, instructor profiles, lesson packages, recital calendar, and enrollment CTA. Use creative, artistic design.'
  },
  {
    id: 'accountant',
    name: 'Accountant',
    description: 'Professional accounting with services and consultation',
    category: 'Professional Services',
    previewImage: 'https://framerusercontent.com/images/afGk7fkrCMcbSmFt4fdjmjqPULQ.webp?width=1200&height=630',
    prompt: 'Build a professional accountant website using React + Vite + TypeScript + Tailwind CSS. Include trustworthy hero, services grid, about section, pricing, client portal CTA, and contact. Use professional, trustworthy design with navy and green accents.'
  }
]

export function getTemplatesByCategory(category: string): MotionSitesTemplate[] {
  return motionsitesTemplates.filter(t => t.category.toLowerCase() === category.toLowerCase())
}

export function getCategories(): string[] {
  const categories = new Set(motionsitesTemplates.map(t => t.category))
  return Array.from(categories)
}
