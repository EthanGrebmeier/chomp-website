const EFFECTIVE_DATE = 'June 28, 2026'
const LAST_UPDATED_DATE = 'June 28, 2026'
const LEGAL_ENTITY = 'Ethan Grebmeier'
const CONTACT_EMAIL = 'contact@chompgrocery.com'
const GOVERNING_JURISDICTION = 'the State of Washington, USA'

export default function PrivacyPolicy() {
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
          <h1 className="mt-6 text-4xl font-bold uppercase leading-none sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm">
            <strong className="font-medium">Effective date:</strong> {EFFECTIVE_DATE}
          </p>
          <p className="text-sm">
            <strong className="font-medium">Last updated:</strong> {LAST_UPDATED_DATE}
          </p>
        </header>

        <div className="prose-chomp flex flex-col gap-6 pt-8 text-sm leading-6">
          <p>
            Chomp (&ldquo;Chomp,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), operated by{' '}
            {LEGAL_ENTITY}, provides a grocery list, recipe, and meal-planning application
            (the &ldquo;App&rdquo;). This Privacy Policy explains what information we collect, how
            we use it, who we share it with, and the choices you have. By using the App, you agree
            to the practices described in this policy.
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">1. Information We Collect</h2>

            <h3 className="text-base font-semibold uppercase">Information you provide</h3>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Account information.</strong> When you create an
                account, we collect your email address. Depending on how you sign in, this is
                provided through Apple Sign In, Google Sign In, or an email magic code.
              </li>
              <li>
                <strong className="font-semibold">Content you create.</strong> We store the content
                you add to the App, including grocery lists and list items, saved items, recipes
                and recipe ingredients, imported recipe source URLs, meal plans, stores, and custom
                categories.
              </li>
              <li>
                <strong className="font-semibold">Recipe imports.</strong> When you import a recipe
                from the web, you provide a URL. We retrieve the contents of that page and process
                them to extract ingredient and recipe details.
              </li>
            </ul>

            <h3 className="text-base font-semibold uppercase">
              Information collected automatically
            </h3>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Authentication and session data.</strong> To keep
                you signed in and secure your account, we and our authentication provider process
                authentication tokens and session identifiers.
              </li>
              <li>
                <strong className="font-semibold">Device and local storage.</strong> The App stores
                data locally on your device (including a local database, cached content, and
                securely stored credentials) to enable offline use and faster performance.
              </li>
              <li>
                <strong className="font-semibold">Technical and diagnostic data.</strong> We may
                process limited technical information such as app version, device type, and network
                status to operate, maintain, and troubleshoot the App.
              </li>
            </ul>

            <h3 className="text-base font-semibold uppercase">Guest use</h3>
            <p>
              You can use the App as a guest without creating a full account. In guest mode we
              create a temporary, anonymous session so your content can be stored and synced. If you
              later sign in, your guest content may be associated with your account.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>Provide, operate, and maintain the App and its features.</li>
              <li>Create and manage your account and keep you signed in.</li>
              <li>Store and synchronize your content across your devices in real time.</li>
              <li>Enable collaborative features, such as sharing a grocery list with others.</li>
              <li>Parse recipes you import from the web.</li>
              <li>Diagnose problems, improve performance, and develop new features.</li>
              <li>Protect the security and integrity of the App and prevent abuse.</li>
              <li>Comply with legal obligations and enforce our terms.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">3. Shared Lists and Collaboration</h2>
            <p>
              Chomp lets you share a grocery list with other users by inviting them with a join
              code. When you share a list, the people you share it with can view and modify the
              shared list and its items. Do not include sensitive personal information in shared
              lists. The owner of a list controls who has access to it.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">4. Third-Party Services</h2>
            <p>
              We rely on trusted third-party providers to deliver the App. These providers process
              certain data on our behalf or as independent controllers under their own privacy
              policies. The categories of providers we use include:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Authentication providers</strong> &mdash; to
                create and secure your account and, where you choose it, to let you sign in with a
                third-party account such as Apple or Google.
              </li>
              <li>
                <strong className="font-semibold">Database and synchronization providers</strong>{' '}
                &mdash; to store your content and keep it in sync across your devices in real time.
              </li>
              <li>
                <strong className="font-semibold">
                  Application delivery and update providers
                </strong>{' '}
                &mdash; to distribute the App and deliver updates.
              </li>
            </ul>
            <p>
              These providers may change over time as we improve the App. We encourage you to
              review the privacy policies of any third-party sign-in services you choose to use.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">5. How We Share Information</h2>
            <p>
              We do not sell your personal information. We share information only in the following
              circumstances:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">With service providers</strong> who process data
                on our behalf to operate the App (see &ldquo;Third-Party Services&rdquo;).
              </li>
              <li>
                <strong className="font-semibold">With other users</strong> when you use
                collaborative features, such as sharing a grocery list.
              </li>
              <li>
                <strong className="font-semibold">For legal reasons</strong>, when we believe
                disclosure is required to comply with applicable law, legal process, or government
                request, or to protect the rights, property, or safety of Chomp, our users, or
                others.
              </li>
              <li>
                <strong className="font-semibold">In a business transfer</strong>, such as a merger,
                acquisition, or sale of assets, in which case we will take reasonable steps to
                ensure your information remains protected.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">6. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to
              provide the App. If you delete content or your account, we will delete or de-identify
              the associated data within a reasonable period, except where we are required to retain
              it to comply with legal obligations, resolve disputes, or enforce our agreements. Some
              data may remain in backups for a limited time.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">7. Your Choices and Rights</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Access and update.</strong> You can view and edit
                your content within the App.
              </li>
              <li>
                <strong className="font-semibold">Delete content.</strong> You can delete grocery
                lists, recipes, meal plans, and other content you create.
              </li>
              <li>
                <strong className="font-semibold">Delete your account.</strong> You may request
                deletion of your account and associated data by contacting us at{' '}
                <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
                .
              </li>
              <li>
                <strong className="font-semibold">Photo access.</strong> You can grant or revoke the
                App&rsquo;s access to your photo library in your device settings.
              </li>
              <li>
                <strong className="font-semibold">Sign out.</strong> You can sign out of the App at
                any time.
              </li>
            </ul>
            <p>
              Depending on where you live, you may have additional rights under laws such as the
              EU/UK General Data Protection Regulation (GDPR) or the California Consumer Privacy Act
              (CCPA/CPRA), including the right to access, correct, delete, or restrict processing of
              your personal information, and the right to data portability. To exercise these
              rights, contact us at{' '}
              <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              . We will not discriminate against you for exercising your rights.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">8. Data Security</h2>
            <p>
              We use reasonable technical and organizational measures to protect your information,
              including encrypted storage of credentials on your device and secure transmission of
              data. No method of transmission or storage is completely secure, however, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">9. Children&rsquo;s Privacy</h2>
            <p>
              The App is not directed to children under the age of 13 (or the minimum age required
              in your jurisdiction), and we do not knowingly collect personal information from them.
              If you believe a child has provided us with personal information, please contact us at{' '}
              <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{' '}
              so we can take appropriate action.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">10. International Users</h2>
            <p>
              Your information may be processed and stored in countries other than the one in which
              you reside, including the United States. These countries may have data protection laws
              that differ from those in your country. Where required, we take steps to ensure your
              information receives an adequate level of protection.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we
              will update the &ldquo;Last updated&rdquo; date above and, where appropriate, provide
              additional notice within the App. Your continued use of the App after changes take
              effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">12. Contact Us</h2>
            <p>
              If you have questions or requests regarding this Privacy Policy or your personal
              information, contact us at:
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
              This policy is governed by the laws of {GOVERNING_JURISDICTION}, without regard to its
              conflict-of-laws principles.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
