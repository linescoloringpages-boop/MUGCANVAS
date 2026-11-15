import Legal from '../../components/Legal';

export const metadata = { title: 'Privacy Policy · Dealora' };

const sections = [
  { title: 'Who we are', body: [
    'Dealora is operated by [Legal name of the operator, address, registration number] (“Dealora”, “we”, “us”). We decide how and why your personal data is used on the Dealora website and in related emails, so we are the “controller” of that data. Contact us about privacy at [privacy email].',
  ] },
  { title: 'The data we collect', body: [
    [
      'Account data: your email address, username (shown publicly), country, and your password (stored in a protected form by our login provider; we never see it in readable form).',
      'Email choices: whether you agreed to marketing emails and the monthly magazine, and the date you agreed. Real-time email settings for Verified Users.',
      'Consents and terms: the version of the Link Submission Terms you accepted and when.',
      'Activity while signed in: what you search for, the categories, collections and regions you choose, and which coupons you open, copy or click through to. This is used to improve the deals we show and, for Verified Users, to prepare a personal page and the emails you receive.',
      'Interest answers: for Verified Users, the answers you give about what you use coupons for and your shopping preferences.',
      'Content you post: coupons, links, pictures, reviews, chat messages, replies, poll votes, and your reports. Pictures may contain information you did not intend to share, so please check them before you upload.',
      'Safety checks: the links you submit or pre-check, the web addresses they lead to, the result of the check, and the number of checks you run per hour.',
      'Payment data: your PayPal order reference, the amount and the date. We do not see or store your card or PayPal login details.',
      'Points: points the team adds to your account and the reason.',
      'Moderation records: restrictions on your chat, removals of Content, and, for a removed member, the email address and the reason, kept so the address cannot be used to join again.',
      'Technical data: your IP address and device information in our hosting and database logs, and the cookies or similar storage described below.',
    ],
    'We do not knowingly collect special-category data (such as health or religion). Please do not post it.',
  ] },
  { title: 'Why we use it, and our legal basis', body: [
    [
      'To create and run your account, show codes and links, and provide the features you use. Basis: performing our contract with you.',
      'To process the Verified User payment and keep payment records. Basis: contract, and legal duties such as tax and accounting.',
      'To review submissions, run link safety checks, moderate the Community Board, enforce the rules, and prevent fraud, spam and abuse. Basis: our legitimate interest in keeping the Service safe and trustworthy.',
      'To record your activity and use it to choose deals and prepare Verified Users’ personal pages. Basis: our legitimate interest in improving the Service; for Verified Users, also contract.',
      'To send marketing emails and the monthly magazine. Basis: your consent, which you can withdraw at any time. Real-time deal emails are part of Verified User status.',
      'To segment emails by country. Basis: legitimate interest and, for marketing, your consent.',
      'To answer your requests and meet legal obligations. Basis: legal obligation and legitimate interest.',
    ],
    'Where we rely on consent you can withdraw it at any time, which does not affect what we did before. Where we rely on legitimate interest you can object. See “Your rights”.',
  ] },
  { title: 'What others can see', body: [
    'Your username is shown publicly next to what you share and your replies, and a Verified badge may be shown next to it. Your email address is never shown to other members. Only the Dealora team can see your email, country, activity, points and payment status. The Community Board shows messages only after approval, except in a chat the team set to “free chat”, where they show at once.',
  ] },
  { title: 'Who we share data with', body: [
    'We use service providers (processors) that handle data on our instructions:',
    [
      'Supabase: database, login and file storage.',
      'Our web host (for example Netlify) and its network.',
      'Google: Web Risk or Safe Browsing, which receives the web addresses of links to check them for threats.',
      'PayPal: payments. PayPal is also an independent controller of the payment data you give it.',
      '[Your email sending service, if any]: to send emails.',
    ],
    'We may disclose data if the law requires it, to protect our rights or the safety of others, or in a sale or reorganisation of the business. We do not sell your personal data.',
  ] },
  { title: 'International transfers', body: [
    'Our providers may process data in countries other than yours, including the United States. Where the law requires it, we use safeguards such as standard contractual clauses or the provider’s certification.',
  ] },
  { title: 'Cookies and similar storage', body: [
    'We use storage in your browser that is necessary for the Service: your signed-in session (so you stay logged in) and a few settings, such as the region you chose for deals. We do not use advertising cookies. If we add analytics or advertising tools, we will update this policy and ask for consent where the law requires.',
    'Links to stores may carry affiliate or tracking parameters, and the store’s own cookies are then governed by that store.',
  ] },
  { title: 'How long we keep it', body: [
    [
      'Account data and your Content: until you delete your account or we remove it.',
      'Activity records: [12 months], then deleted or anonymised.',
      'Payment records: for as long as tax and accounting laws require.',
      'Removed-member email record: as long as needed to prevent re-joining and to defend legal claims.',
      'Backups: removed on a normal backup cycle.',
    ],
  ] },
  { title: 'Security', body: [
    'We use access rules in the database so that members can only read and change their own data, and server-side checks for sensitive actions. No system is perfectly secure. Please use a strong, unique password. If we learn of a breach affecting you, we will tell you and the authorities as the law requires.',
  ] },
  { title: 'Your rights', body: [
    'Depending on where you live (for example in the EU/UK, California and many other places) you may have the right to: access your data; correct it; delete it; restrict or object to some uses; receive a copy in a portable format; withdraw consent; and complain to your data protection authority. We do not sell or share personal data for cross-context advertising.',
    'To use a right, write to [privacy email]. We may need to confirm it is you. You can also change your username, country and email choices in your account at any time.',
    'Deleting your account deletes your profile and the Content you posted, except what we must keep by law or to prevent abuse.',
  ] },
  { title: 'Children', body: [
    'The Service is not for anyone under [16]. If we learn that a child gave us personal data, we will delete it. If you are a parent and think this happened, contact us.',
  ] },
  { title: 'Automated decisions', body: [
    'Some limits are applied automatically: for example, a link that fails the safety check is not accepted, and a member who sends more than 3 chat messages in a row is switched to “approval required”. The team can review and lift these. We do not make decisions with legal or similarly significant effects by purely automated means.',
  ] },
  { title: 'Changes and contact', body: [
    'We may update this policy and will change the date above. For important changes we will tell you on the site or by email. Questions: [privacy email].',
  ] },
];

export default function Page() {
  return <Legal title="Privacy Policy" updated="November 14, 2026" intro="This is a detailed draft and not legal advice. It must be reviewed by a lawyer in your country, and every part in [square brackets] must be completed before launch." sections={sections} />;
}
