const LEGAL_ENTITY = 'Ethan Grebmeier'
const CONTACT_EMAIL = 'contact@chompgrocery.com'
const RESPONSE_TIME = '2 business days'

export default function Support() {
  return (
    <div className="bg-chomp-blue text-chomp-cream">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12 md:px-12 md:py-16">
        <header className="border-b border-chomp-cream pb-8">
          <a
            href="/"
            className="text-sm uppercase underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            &larr; Chomp
          </a>
          <h1 className="mt-6 text-4xl font-bold uppercase leading-none sm:text-5xl">Support</h1>
          <p className="mt-4 text-sm">
            Need help with Chomp? We&rsquo;re here for you.
          </p>
        </header>

        <div className="prose-chomp flex flex-col gap-6 pt-8 text-sm leading-6">
          <p>
            Chomp is a grocery list, recipe, and meal-planning app operated by {LEGAL_ENTITY}. If you
            have a question, run into a problem, or want to share feedback, reach out using the
            contact details below and we&rsquo;ll be happy to help.
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">Contact Us</h2>
            <p>
              The best way to reach us is by email. We typically respond within {RESPONSE_TIME}.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Email:</strong>{' '}
                <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <strong className="font-semibold">Operator:</strong> {LEGAL_ENTITY}
              </li>
            </ul>
            <p>
              To help us resolve your issue quickly, please include your device type, app version,
              and a description of what happened, along with any steps to reproduce the problem.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">Report a Bug or Request a Feature</h2>
            <p>
              Found something that isn&rsquo;t working, or have an idea to make Chomp better? Email us
              at{' '}
              <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{' '}
              with as much detail as you can. We read every message.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">Privacy and Terms</h2>
            <p>
              For details on how we handle your data and the rules that govern use of the App, see
              our{' '}
              <a className="underline underline-offset-4" href="/privacy">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a className="underline underline-offset-4" href="/terms">
                Terms of Service
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
