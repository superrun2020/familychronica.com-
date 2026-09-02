# FamilyChronica Commercial Website Specification V3.0

## 1. Commercial objective

FamilyChronica is not positioned as a generic family-tree tool or an AI writing utility. It is a voice-first family memory service that turns a family's own words, photographs, and relationships into a living digital chronicle and durable printed editions.

The website has four commercial jobs:

1. Make the outcome immediately understandable: speak, organize, preserve, print.
2. Reduce fear for older adults and the adult children helping them.
3. Establish trust around privacy, AI editing, ownership, fulfillment, and continuity.
4. Move qualified visitors into a free trial, gift purchase, book preview, or sales conversation.

Primary conversion: `Start your free chronicle`.

Secondary conversions: `See a sample book`, `Give as a gift`, `Watch how it works`, and `Talk to a family advisor`.

## 2. Priority audiences

| Audience | Core need | Main concern | Best entry point |
|---|---|---|---|
| Older storyteller | Tell a life story without learning software | “Will this be difficult?” | Voice recording demo |
| Adult child | Preserve parents' stories before they are lost | Time, remote assistance, trust | Create for a parent |
| Family organizer | Build one shared archive across relatives | Permissions and coordination | Family collaboration |
| Gift buyer | Give a meaningful, guided experience | Presentation and delivery | Gift membership |
| Genealogy enthusiast | Add narrative and media to research | Export, source detail, complex families | Family tree and archive |
| Diaspora family | Connect memories across languages and countries | Translation and international access | Multilingual family archive |

## 3. Positioning and message hierarchy

### Promise

`Tell the stories. We help shape the chronicle.`

### Proof pillars

- Voice-first recording with gentle interview prompts.
- Editable AI organization that preserves the speaker's meaning.
- A living timeline, family tree, and searchable media archive.
- Annual printed books with preview and approval before production.
- Family collaboration with granular privacy controls.
- Exportable data and retained version history.

### Language rules

- Lead with family outcomes, not AI terminology.
- Never imply AI invents or verifies family facts.
- Explain what is automatic and what requires family approval.
- Do not publish unverified customer counts, press logos, ratings, or testimonials.
- Avoid legal claims such as “permanent” or “end-to-end encrypted” until technically verified.

## 4. Information architecture

### Header

- Product: Overview, Voice Stories, Family Timeline, Family Tree, Annual Books, Archive.
- How It Works.
- Solutions: For Parents, For Families, Gift a Chronicle.
- Pricing.
- Store.
- Stories & Guides.
- Trust: Privacy & Security, Help Center.
- My Chronicle / Start Free.

### Core routes

| Route | Commercial purpose | Primary CTA |
|---|---|---|
| `/` | Explain the promise and route visitors by intent | Start free |
| `/how-it-works` | Remove process uncertainty | Record first story |
| `/features` | Demonstrate product depth | Explore demo |
| `/for-parents` | Show simplicity and family assistance | Create for a parent |
| `/for-families` | Explain collaboration and permissions | Start family plan |
| `/gift` | Sell gift memberships | Choose a gift |
| `/sample-book` | Show the actual output and quality | Create your book |
| `/pricing` | Resolve plan and value questions | Begin trial |
| `/store` | Sell printed and archive products | Customize product |
| `/security` | Establish data and AI trust | Read privacy details |
| `/blog` | SEO and education | Start a chronicle |
| `/support` | Reduce purchase and onboarding friction | Contact support |
| `/login`, `/signup` | Account entry and acquisition | Continue |
| `/dashboard` | Product preview / authenticated workspace | Record memory |

Supporting legal routes: `/privacy`, `/terms`, `/cookies`, `/shipping-returns`, and `/accessibility`.

## 5. Homepage conversion sequence

1. Full-bleed hero showing a real multigenerational family and a physical book.
2. Clear outcome: voice and photographs become a living family chronicle.
3. Two intent CTAs: start for my family / create for a parent.
4. Product proof strip: voice, timeline, book, archive.
5. Interactive “one memory's journey” demo.
6. Sample book spread and print specification.
7. Audience pathways for storyteller, adult child, and whole family.
8. Senior-friendly interaction proof.
9. Family collaboration and privacy controls.
10. Trust section: ownership, AI transparency, export, support.
11. Plan preview with transparent billing and fulfillment details.
12. Testimonials only when sourced and approved; use labeled illustrative stories before that.
13. FAQ covering data ownership, AI edits, printing, cancellation, and family access.
14. Final CTA with trial terms visible.

## 6. Product demonstration requirements

### Voice-to-story demo

- A visible recording state and a sample transcript.
- Before/after view showing raw transcript versus edited narrative.
- Explicit confirmation that the user reviews changes.
- Link the memory to a person, year, and place.

### Chronicle preview

- Timeline view with mixed media.
- Book spread with cover, chapter title, photograph, and excerpt.
- Version indicator and “last updated” metadata.
- Family tree preview with accessible text alternative.

### Collaboration preview

- Invite family member.
- Role examples: owner, editor, contributor, viewer.
- Private memory, selected family, and whole-family visibility options.
- Approval state before a contribution appears in the annual book.

## 7. Pricing and packaging

Pricing must show the full billing period, renewal behavior, included printed products, shipping exclusions, storage limits, collaborator limits, and cancellation behavior.

Recommended public packaging:

- Free: prove the workflow with limited written stories and photographs.
- Personal Monthly: digital voice and AI tools, no annual print inclusion.
- Personal Annual: best-value personal plan with defined print credits.
- Family Monthly: collaboration without annual print credits.
- Family Annual: collaboration, increased storage, print credits, and family support.

Add a plan recommender based on contributor count, video needs, and printed-book needs. Do not hide material restrictions inside tooltips.

## 8. Store and fulfillment

- Product detail pages need dimensions, page count range, paper, binding, cover choices, production time, and estimated shipping.
- Customization flow: edition, cover, title, family name, year, inscription, quantity, shipping country.
- Preview and approval must occur before payment or print submission.
- Explain taxes, duties, address changes, damaged-product replacement, and reprint policy.
- Cart must distinguish subscription benefits from physical product charges.

## 9. Trust, privacy, and AI transparency

Publish a plain-language trust center covering:

- Customer ownership of uploaded and generated family content.
- How recordings are transcribed and how AI suggestions are reviewed.
- Whether customer content is used for model training.
- Data retention after cancellation and deletion timelines.
- Export formats and account succession / family administrator transfer.
- Storage regions, encryption, backups, access logging, and incident response only after verification.
- Facial recognition and inferred date/place controls with opt-in and correction.
- Special handling for minors, deceased persons, and legacy messages.

## 10. Accessibility and senior experience

- Default body text at least 18px with a persistent larger-text preference.
- Keyboard-visible focus, semantic headings, descriptive image text, and high contrast.
- Recording flows must not rely on color alone.
- Plain language, generous touch targets, and no forced time limits.
- Family assistance should be explicit, revocable, and logged.
- Publish an accessibility statement and support channel.

## 11. Content and SEO

Content clusters:

- Interviewing parents and grandparents.
- Family history questions and prompts.
- Digitizing old photographs and recordings.
- Family book examples and design guidance.
- Family tree versus family story archive.
- Multilingual and immigrant family histories.
- Grief, legacy letters, and ethical memory preservation.

Every indexable page needs a unique title, description, canonical URL, Open Graph image, breadcrumb where appropriate, and structured data. Use `Organization`, `WebSite`, `Product`, `FAQPage`, `Article`, and `BreadcrumbList` only when page content supports them.

## 12. Lifecycle and communication

- Welcome and first-story onboarding.
- Gentle recording reminders controlled by the user.
- Family invitation and contribution digest.
- Book readiness progress and print approval reminders.
- Order confirmation, production, shipment, and delivery notifications.
- Renewal reminder and storage-limit warnings.
- Export completion and deletion confirmation.

## 13. Measurement plan

Track consented, non-sensitive events:

- CTA selection by audience intent.
- Demo start and completion.
- Sample-book interaction.
- Pricing plan comparison and selection.
- Sign-up start and completion.
- First memory created.
- Family invite sent and accepted.
- Print preview and checkout milestones.

Never send story content, recordings, names, family relationships, or legacy-letter metadata to advertising analytics.

## 14. Launch readiness

### Required before paid traffic

- Working authentication, password reset, and email verification.
- Server-backed recording/upload and data persistence.
- Subscription checkout and webhook reconciliation.
- Print-order fulfillment integration or a documented manual process.
- Privacy, terms, cookies, shipping, returns, and accessibility pages reviewed.
- Support mailbox and response-time commitment staffed.
- Analytics consent and deletion/export workflows tested.
- Backup restore exercise and incident owner assigned.

### Website release acceptance

- Desktop and mobile visual QA at key breakpoints.
- No broken routes or placeholder buttons.
- Core Web Vitals and image sizing reviewed.
- Keyboard navigation and text enlargement verified.
- Checkout and sign-up funnel tested in production.
- HTTPS, canonical redirects, sitemap, robots, and 404 behavior confirmed.

## 15. Client UI alignment addendum

The August 2026 client UI defines product details that the public website must explain consistently:

- Home is a family timeline with quick voice, photo, video, invite, and book-preview actions.
- Voice capture has explicit recording, AI-processing, and family-review states; the website must not collapse them into one unexplained “AI writes it” step.
- Guided interviews save question-by-question progress and support both spoken and typed answers.
- Photos follow an import, scan, suggested-group, human-review, album, detail, search, and per-album privacy flow.
- AI photo suggestions include people, places, homes, and vehicles; every inferred label is correctable and optional.
- Books show annual completion, story/photo/video counts, estimated page count, electronic preview, version history, reprint, and refresh states.
- Family collaboration includes create-or-join, email-code login, invitations, pending invitations, member roles, permission selection, and switching between families.
- Account areas include personal profile, subscription, store, text size, language, privacy, export, support, and deletion.
- Reliability states include first-use empty screens, processing, toasts, offline mode, and missing-memory recovery.

Website terminology, colors, imagery, and interaction examples should mirror these client concepts. Public copy must distinguish designed client behavior from capabilities that are already backed by production services.
