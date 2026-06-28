const EFFECTIVE_DATE = 'June 28, 2026'
const LAST_UPDATED_DATE = 'June 28, 2026'
const LEGAL_ENTITY = 'Ethan Grebmeier'
const CONTACT_EMAIL = 'contact@chompgrocery.com'
const GOVERNING_JURISDICTION = 'the State of Washington, USA'
const PRIVACY_POLICY_URL = '/privacy'

export default function TermsOfService() {
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
            Terms of Service
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
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Chomp
            (&ldquo;Chomp,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a
            grocery list, recipe, and meal-planning application (the &ldquo;App&rdquo;), operated by{' '}
            {LEGAL_ENTITY}. By creating an account, using the App as a guest, or otherwise accessing
            the App, you agree to be bound by these Terms. If you do not agree, do not use the App.
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">1. Eligibility</h2>
            <p>
              You must be at least 13 years old (or the minimum age required in your jurisdiction)
              to use the App. By using the App, you represent that you meet this requirement and
              that you have the legal capacity to enter into these Terms. If you use the App on
              behalf of an organization, you represent that you are authorized to accept these Terms
              on its behalf.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">2. Your Account</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Account creation.</strong> You can create an
                account using Apple Sign In, Google Sign In, or an email magic code. You are
                responsible for the information associated with your account and for keeping your
                sign-in method secure.
              </li>
              <li>
                <strong className="font-semibold">Guest use.</strong> You may use the App as a guest
                without creating a full account. Guest sessions are temporary and anonymous, and
                content created in guest mode may be lost if you do not sign in. If you later sign
                in, your guest content may be associated with your account.
              </li>
              <li>
                <strong className="font-semibold">Account security.</strong> You are responsible for
                activity that occurs under your account. Notify us promptly at{' '}
                <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>{' '}
                if you believe your account has been accessed without authorization.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">3. License to Use the App</h2>
            <p>
              Subject to these Terms, we grant you a personal, limited, non-exclusive,
              non-transferable, revocable license to download and use the App for your own personal,
              non-commercial purposes. These Terms do not transfer any ownership rights in the App to
              you.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">4. Your Content</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Ownership.</strong> You retain ownership of the
                content you create or add to the App, including grocery lists and list items, saved
                items, recipes and recipe ingredients, imported recipe source URLs, meal plans,
                stores, custom categories, and recipe images (&ldquo;Your Content&rdquo;).
              </li>
              <li>
                <strong className="font-semibold">License to us.</strong> You grant us a worldwide,
                non-exclusive, royalty-free license to host, store, reproduce, modify (for example,
                to format or display content), and transmit Your Content solely as needed to operate
                and provide the App, including syncing your content across devices and enabling
                features you choose to use, such as sharing.
              </li>
              <li>
                <strong className="font-semibold">Responsibility.</strong> You are solely
                responsible for Your Content and for ensuring you have the rights necessary to add it
                to the App.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">5. Shared Lists and Collaboration</h2>
            <p>
              Chomp lets you share a grocery list with other users by inviting them with a join
              code. When you share a list, the people you share it with can view and modify the
              shared list and its items. You are responsible for who you invite and for the content
              you choose to share. Do not include sensitive personal information in shared lists. The
              owner of a list controls who has access to it and may remove access at any time.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">6. Recipe Imports and Third-Party Content</h2>
            <p>
              The App lets you import recipes from the web by submitting a URL, which we send to our
              recipe-parsing service to extract recipe and ingredient details. Imported content
              originates from third parties, and we do not control, endorse, or guarantee the
              accuracy, completeness, or legality of that content. You are responsible for ensuring
              your use of imported content complies with the source website&rsquo;s terms and
              applicable law.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>Use the App for any unlawful purpose or in violation of these Terms.</li>
              <li>
                Upload or share content that is illegal, infringing, harmful, harassing, or that
                violates the rights of others.
              </li>
              <li>
                Attempt to access accounts, data, or systems that you are not authorized to access.
              </li>
              <li>
                Interfere with, disrupt, overload, or attempt to gain unauthorized access to the App
                or its infrastructure.
              </li>
              <li>
                Reverse engineer, decompile, or attempt to extract the source code of the App, except
                to the extent permitted by law.
              </li>
              <li>
                Use automated means to access or scrape the App in a manner that burdens our systems
                or circumvents intended functionality.
              </li>
            </ul>
            <p>
              We may remove content or suspend or terminate access for conduct that we reasonably
              believe violates these Terms or harms other users or the App.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">
              8. No Reliance on Recipe and Nutritional Information
            </h2>
            <p>
              The App provides grocery, recipe, and meal-planning information for general
              informational and organizational purposes only. It is not medical, dietary, or
              nutritional advice. We do not guarantee that recipe details, ingredients, quantities,
              or any imported or parsed information are accurate, complete, or suitable for your
              needs. Always verify ingredients and consult a qualified professional regarding
              allergies, dietary restrictions, or health conditions.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">9. Third-Party Services</h2>
            <p>
              The App relies on third-party providers &mdash; including authentication, database and
              synchronization, application delivery, and recipe-parsing services &mdash; to deliver
              its features. Your use of those services may be subject to their own terms and
              policies. We are not responsible for the acts or omissions of third-party providers.
              For details on how data is handled, see our{' '}
              <a className="underline underline-offset-4" href={PRIVACY_POLICY_URL}>
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">10. Intellectual Property</h2>
            <p>
              The App, including its software, design, branding, logos, and other materials
              (excluding Your Content), is owned by {LEGAL_ENTITY} or its licensors and is protected
              by intellectual property laws. Except for the rights expressly granted in these Terms,
              we reserve all rights in and to the App. You may not use our name or marks without our
              prior written permission.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">11. Termination</h2>
            <p>
              You may stop using the App and delete your account at any time by contacting us at{' '}
              <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{' '}
              or using the in-app account deletion option where available. We may suspend or
              terminate your access to the App at any time, with or without notice, if we reasonably
              believe you have violated these Terms or to protect the App or its users. Upon
              termination, the license granted to you ends, and the sections of these Terms that by
              their nature should survive will continue to apply, including ownership, disclaimers,
              limitations of liability, and dispute provisions.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">12. Disclaimers</h2>
            <p>
              THE APP IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE,
              SECURE, OR THAT DATA WILL NOT BE LOST. YOU USE THE APP AT YOUR OWN RISK.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">13. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL_ENTITY.toUpperCase()} AND ITS
              AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS,
              OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE APP. OUR TOTAL LIABILITY FOR ANY
              CLAIM RELATING TO THE APP WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US TO USE
              THE APP IN THE TWELVE MONTHS BEFORE THE CLAIM OR USD $50. SOME JURISDICTIONS DO NOT
              ALLOW CERTAIN LIMITATIONS, SO SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">14. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless {LEGAL_ENTITY} and its affiliates from any
              claims, damages, losses, liabilities, and expenses (including reasonable legal fees)
              arising out of or related to Your Content, your use of the App, or your violation of
              these Terms or applicable law.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">15. Apple App Store and Google Play Terms</h2>
            <p>
              If you download the App from a third-party app store, your use is also subject to that
              store&rsquo;s terms. For the Apple App Store, the standard{' '}
              <a
                className="underline underline-offset-4"
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                target="_blank"
                rel="noreferrer"
              >
                Licensed Application End User License Agreement
              </a>{' '}
              applies, and you acknowledge that Apple is not responsible for the App or its support,
              and is a third-party beneficiary of these Terms with the right to enforce them. Where a
              conflict exists between these Terms and the applicable store terms, the store terms
              control to the extent of the conflict for that distribution.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">16. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we make material changes, we will
              update the &ldquo;Last updated&rdquo; date above and, where appropriate, provide
              additional notice within the App. Your continued use of the App after the changes take
              effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">17. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by the laws of {GOVERNING_JURISDICTION}, without regard to its
              conflict-of-laws principles. You agree that any dispute arising out of or relating to
              these Terms or the App will be resolved in the courts located in{' '}
              {GOVERNING_JURISDICTION}, unless applicable law requires otherwise, and you consent to
              their jurisdiction.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">18. Miscellaneous</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold">Entire agreement.</strong> These Terms, together
                with our Privacy Policy, constitute the entire agreement between you and us regarding
                the App.
              </li>
              <li>
                <strong className="font-semibold">Severability.</strong> If any provision of these
                Terms is found unenforceable, the remaining provisions will remain in full force and
                effect.
              </li>
              <li>
                <strong className="font-semibold">No waiver.</strong> Our failure to enforce any
                provision is not a waiver of our right to do so later.
              </li>
              <li>
                <strong className="font-semibold">Assignment.</strong> You may not assign these Terms
                without our consent; we may assign them in connection with a merger, acquisition, or
                sale of assets.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold uppercase">19. Contact Us</h2>
            <p>If you have questions about these Terms, contact us at:</p>
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
          </section>
        </div>
      </main>
    </div>
  )
}
