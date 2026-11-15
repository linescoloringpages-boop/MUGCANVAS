import Legal from '../../components/Legal';

export const metadata = { title: 'Terms of Use · Dealora' };

const sections = [
  { title: 'About these terms', body: [
    'These Terms of Use (the “Terms”) are an agreement between you and [Legal name of the operator, address, registration number] (“Dealora”, “we”, “us”). They govern your use of the Dealora website and related emails and services (the “Service”).',
    'By visiting the Service, creating an account, paying for Verified User status, or posting anything, you agree to these Terms, the Privacy Policy, the Community Rules and, when you add a link, the Link Submission Terms. If you do not agree, do not use the Service.',
  ] },
  { title: 'Who may use Dealora', body: [
    'You must be at least [16] years old, or the age of digital consent in your country if it is higher, and able to enter a binding contract. The Service is not for children.',
    'You must give accurate information when you register, keep your password secret, and tell us if you think someone else has used your account. You are responsible for everything done through your account. One person may hold one account.',
  ] },
  { title: 'What Dealora is', body: [
    'Dealora lists coupons, discounts and deals from stores and from members. We are not the seller of any product and we are not a party to any purchase you make from a store.',
    'We do not guarantee that any coupon, code, discount or link works, is accurate, or is still available. Offers can change or end without notice, may be limited by country, product or time, and are controlled entirely by the store. Deals marked “Verified Deal” have been checked by us at the time shown. Deals without that badge come from members or other sources and have not been independently verified.',
    'Check the store’s own terms before you buy. Dealora is not responsible for the store’s products, prices, delivery, refunds or conduct.',
  ] },
  { title: 'Account types', body: [
    [
      'Visitors can browse deals. Coupon codes and store links are hidden.',
      'Registered members (free) can see codes and links, share coupons, write reviews, and take part in the Community Board where the team opened it. All shared content needs the team’s approval before it is shown.',
      'Verified Users (one-time payment) also receive the Verified badge, real-time deal emails, a personal page of coupons chosen for them from their answers, and the monthly magazine option, as described on the site when you pay.',
    ],
    'We may change, add or remove features of any account type. Benefits that are described as coming later are not promised until they are available.',
  ] },
  { title: 'Verified User payment', body: [
    'Verified User status is a one-time payment of US$1.99 (or the price and currency shown at checkout). It is charged once, does not renew, and is processed by PayPal. We do not see or store your card details. The price may change for new buyers at any time; the price you accept at checkout is the price you pay.',
    'Taxes such as VAT or sales tax are [included in / added to] the price where the law requires.',
    'Verified User status lasts for as long as the Service is offered and your account remains in good standing. It is personal, cannot be transferred or shared, and has no cash value.',
    'Refunds: [Complete before launch. State clearly whether, and for how long, the payment is refundable, and how to ask. Consumer laws in many countries give a right to cancel digital purchases in certain situations; do not exclude rights that the law gives and cannot be waived.]',
    'If your account is limited, suspended or removed because you broke the Terms or the Community Rules, the payment is not refunded, except where the law requires it.',
  ] },
  { title: 'Content you post', body: [
    'You are responsible for the coupons, links, pictures, reviews, chat messages, replies, votes and usernames you post (“Content”). You promise that you have the right to post it, that it is accurate to the best of your knowledge, and that it follows the Community Rules and the law.',
    'You keep ownership of your Content. You give Dealora the licence described in the Link Submission Terms, which covers coupons, links, pictures and other submissions, and extends to reviews, replies, chat messages and usernames shown on the Service.',
    'Nothing you submit is shown until we approve it, except messages in a chat that the team set to “free chat”, which are shown at once and reviewed afterwards. We may refuse, edit, hide or remove any Content at any time, with or without a reason, and without liability.',
  ] },
  { title: 'The Community Board and chats', body: [
    'The Community Board is written by the Dealora team. Members may reply or vote only where the team opened a post. The team chooses whether each chat is moderated (every message is approved before it shows) or free (messages show at once).',
    'We apply automatic limits: in a free chat you may send at most 3 messages in a row, and a member who tries to send more is automatically switched to “approval required”. The team may also require approval for any member’s messages at any time.',
    'We may remove a membership for behaviour that harms the community, including breaking the Community Rules. Removal deletes the account and the Content it posted, and the email address cannot be used to join again. Decisions about moderation are made at our discretion and are final, subject to any rights you have under the law.',
  ] },
  { title: 'Links, affiliate links and safety checks', body: [
    'Dealora may earn a commission when you use some links. See the Affiliate Disclosure. We may replace, wrap or add tracking or affiliate parameters to any link, as set out in the Link Submission Terms.',
    'Links submitted by members are checked automatically for known threats using Google Web Risk or Google Safe Browsing, and are reviewed by the team before they appear. No check is perfect. A link that passes is not a guarantee that the destination is safe, lawful or accurate, and you open links at your own risk. Never enter payment details or passwords on a page you do not trust.',
  ] },
  { title: 'Points and rewards', body: [
    'Points are a discretionary courtesy. You may receive 1 point automatically when a coupon you shared is approved and 1 point when a review you wrote is approved, and the team may add or remove points at any time. Points stay on your account if the coupon or review is later deleted. They have no cash value, cannot be sold or transferred, and may be changed, suspended or cancelled at any time. Points do not create any right to a reward unless and until we publish a specific reward and its rules.',
  ] },
  { title: 'Emails', body: [
    'We send service emails (such as confirming your address) when needed. We send marketing emails and the monthly magazine only if you opted in, and you can opt out at any time in your account or with the unsubscribe link. Real-time deal emails are part of Verified User status and can be paused in your account.',
  ] },
  { title: 'Acceptable use', body: [
    'You must not misuse the Service. For example, you must not try to break or overload it, bypass its limits or access controls, scrape it in bulk, use bots or automated tools to create accounts or post, reverse engineer it, collect other people’s data, or use it to send spam. You must follow the Community Rules.',
  ] },
  { title: 'Suspension, limits and removal', body: [
    'We may limit, suspend or end your account or access, or remove Content, at any time if we believe you broke these Terms, the Community Rules or the law, if you create risk or cost for us or others, or if we must do so legally. We may do this with or without notice.',
    'You may stop using the Service and ask us to delete your account at any time. See the Privacy Policy for what happens to your data.',
  ] },
  { title: 'Intellectual property', body: [
    'The Dealora name, logo, design, software and the way the Service is organised belong to us or our licensors. You may use the Service for personal, non-commercial purposes only. Store names, logos and trademarks belong to their owners and are used only to identify the offers. They do not mean the store sponsors or endorses Dealora.',
    'If you believe Content on Dealora infringes your rights, contact us with details of the Content, your rights and your contact information, and we will review it.',
  ] },
  { title: 'Disclaimers', body: [
    'The Service is provided “as is” and “as available”. To the fullest extent the law allows, we give no warranty of any kind, whether express or implied, including about accuracy, availability, merchantability, fitness for a particular purpose, or that the Service will be uninterrupted, secure or error-free.',
  ] },
  { title: 'Limit of liability', body: [
    'To the fullest extent the law allows, Dealora and the people who run it are not liable for any indirect, incidental, special, consequential or punitive loss, or for loss of profit, savings, data or goodwill, arising from your use of the Service, from a coupon, link, store or Content, or from a decision to buy something.',
    'Where we are liable despite this, our total liability for all claims is limited to the greater of the amount you paid us in the 12 months before the claim and [US$50].',
    'Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud, for death or personal injury caused by negligence, or rights you have as a consumer that cannot be waived.',
  ] },
  { title: 'You protect us', body: [
    'You agree to defend and compensate Dealora and the people who run it against any claim, loss, cost or expense (including reasonable legal fees) arising from your Content, from your breach of these Terms, the Community Rules or the law, or from your breach of someone else’s rights, to the extent the law allows.',
  ] },
  { title: 'Changes to the Service and the Terms', body: [
    'We may change, suspend or stop any part of the Service, and we may update these Terms. When we make an important change we will update the date above and, where appropriate, tell you on the site or by email. If you keep using the Service after a change takes effect, you accept the new Terms. The Link Submission Terms version you accepted when you added a link is recorded and applies to that submission.',
  ] },
  { title: 'Governing law and disputes', body: [
    'These Terms are governed by the laws of [country / state to be completed], without regard to its conflict-of-law rules. The courts of [city / country to be completed] have exclusive jurisdiction, except that if you are a consumer you keep the right to use the courts of your home country and any mandatory consumer protection your local law gives you.',
    'Before starting a formal dispute, please contact us and give us a chance to resolve it in good faith.',
  ] },
  { title: 'General', body: [
    'If a part of these Terms is found unenforceable, the rest stays in force. Our failure to enforce a right is not a waiver of it. You may not transfer your rights under these Terms; we may transfer ours as part of a business transfer. These Terms, together with the documents they refer to, are the whole agreement between you and us about the Service.',
  ] },
  { title: 'Contact', body: [
    'Questions about these Terms, removal requests or reports: use the Contact page or write to [support email].',
  ] },
  { id: 'links', title: 'Link Submission Terms', body: [
    'When you add a link, you must read and accept the Link Submission Terms shown at the moment you submit it. In short, they allow Dealora to remove, edit or replace any submitted link, including with its own affiliate link, and they say that you receive no payment or commission for it. They also explain the licence you give for your submission, what you promise about it, and the automatic safety check. The full text and version number are shown in the submission form and in the footer link “Link Submission Terms”.',
  ] },
];

export default function Page() {
  return <Legal title="Terms of Use" updated="November 14, 2026" intro="This is a detailed draft and not legal advice. It must be reviewed by a lawyer in your country, and every part in [square brackets] must be completed before launch." sections={sections} />;
}
