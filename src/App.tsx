import ChefLogo from './components/chef-logo'
import { LinkIcon } from 'lucide-react'

const featureItems = [
  'Save your favorite recipes',
  'Plan your meals for the week',
  'Create and collaborate on a grocery list in seconds',
]

const storeLinks = [
  {
    label: 'Download on the App Store',
    href: '#',
  },
  {
    label: 'Made by Ethan Grebmeier',
    href: 'https://ethangrebmeier.com',
  },
  {
    label: 'Privacy Policy',
    href: '/privacy',
  },
]

const emptyStoreRows = Math.max(featureItems.length - storeLinks.length, 0)

export default function App() {
  return (
    <div className="bg-chomp-blue">
      <main className="app flex min-h-screen w-full flex-col bg-chomp-blue">
        <div className="px-6 pt-6 md:px-12 md:pt-12">
          <h1 className="text-6xl font-bold uppercase leading-none text-chomp-cream -translate-x-2 sm:text-7xl md:text-8xl">Chomp</h1>
          <p className="mt-4 max-w-64 text-base font-light uppercase leading-5 text-chomp-cream sm:text-lg sm:leading-6 md:text-xl">
            Don&apos;t let grocery planning eat into your time.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-12 py-12 text-chomp-cream sm:py-16">
          <div className="w-full">
            <ChefLogo />
          </div>
        </div>

        <div className="pb-6 text-left text-base leading-5 text-chomp-cream sm:text-lg sm:leading-6 md:pb-12">
          <div className="grid grid-cols-1 border-y border-chomp-cream lg:grid-cols-2">
            <div className="divide-y divide-chomp-cream">
              {featureItems.map((feature) => (
                <p className="px-6 py-2 uppercase md:px-12 text-sm" key={feature}>
                  {feature}
                </p>
              ))}
            </div>

            <div className="grid divide-y divide-chomp-cream border-t border-chomp-cream md:grid-rows-3 lg:border-l lg:border-t-0">
              {storeLinks.map((link) => (
                <a
                  className="flex items-center text-sm px-6 py-2 uppercase transition-colors hover:bg-chomp-cream hover:text-chomp-blue focus-visible:bg-chomp-cream focus-visible:text-chomp-blue focus-visible:outline-none md:px-12"
                  href={link.href}
                  key={link.label}
                >
                  <LinkIcon size={16} className="mr-2" /> {link.label}
                </a>
              ))}
              {Array.from({ length: emptyStoreRows }).map((_, index) => (
                <span
                  aria-hidden="true"
                  className="hidden px-6 py-2 md:flex md:px-12"
                  key={`empty-store-row-${index}`}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
