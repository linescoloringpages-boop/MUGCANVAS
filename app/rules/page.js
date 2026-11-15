import Legal from '../../components/Legal';

export const metadata = { title: 'Community Rules · Dealora' };

const sections = [
  { title: 'Why these rules exist', body: [
    'Dealora is a place to find coupons and share what works. The Community Board, replies, shared coupons and reviews only work if people can trust them. These rules apply to everything you post on Dealora, including usernames, chat messages, replies, poll votes, shared coupons, links, pictures and reviews (together, “Content”).',
    'By creating an account or posting Content you agree to these rules, to the Terms of Use and to the Privacy Policy. If you do not agree, please do not post.',
  ] },
  { title: 'What is not allowed', body: [
    'You may not post, link to or encourage any of the following:',
    [
      'Anything illegal, or anything that helps someone commit a crime or break a contract or a store’s terms.',
      'Harassment, bullying, threats, hate speech, or content that attacks people for their race, ethnicity, nationality, religion, sex, gender, sexual orientation, age, disability or any other protected characteristic.',
      'Sexual or adult content, graphic violence, or content that involves or sexualises minors. Content involving minors is reported to the authorities.',
      'Spam: repeated, copied or off-topic messages, advertising, referral or affiliate links of your own, invitation codes, chain messages, or promoting another website, group or service.',
      'Scams, phishing, malware, misleading pages, fake coupons or reviews, or any link that tries to take money, passwords or personal data.',
      'Personal information about other people (names, emails, phone numbers, addresses, account details) and anything that reveals a private person’s identity.',
      'Content that copies someone else’s work, or uses a brand, logo or name in a way that suggests you are the brand or that Dealora is endorsed by it.',
      'Fake or paid reviews, reviews of a store you work for or compete with, or review manipulation of any kind.',
      'Trying to get around a limit or a decision of the Dealora team, for example by opening another account after being limited or removed.',
      'Anything that disrupts the site, the Community Board or other members, or tries to access data or accounts that are not yours.',
    ],
  ] },
  { title: 'The Community Board', body: [
    'The Community Board is run by the Dealora team. Only the team creates posts. Members can reply or vote only where the team opened a post for it.',
    'There are two kinds of open chats. In a moderated chat, every message waits for the team’s approval before it is shown. In a free chat, messages are shown immediately and the team reviews them afterwards. The team decides which mode each chat uses and can change it at any time.',
    'Please keep messages short, on topic and polite. Messages are limited to 300 characters.',
  ] },
  { title: 'Limits that protect the chat', body: [
    'To prevent message flooding, in a free chat you may send at most 3 messages in a row, meaning with no one else writing in between. If you try to send more, your message is held for approval and your account is automatically switched to “approval required”.',
    'The team may also switch any member to “approval required” at any time. While this is on, every one of your chat messages waits for the team’s approval before it is shown. A limited member can have at most 5 messages waiting at once.',
    'These limits are applied automatically and are not a penalty by themselves. The team can lift them at its discretion.',
  ] },
  { title: 'What we may do', body: [
    'Dealora may, at its sole discretion and with or without notice:',
    [
      'refuse, edit, hide or delete any Content;',
      'limit a member’s chat so that each message needs approval;',
      'suspend a member’s ability to post, share or review;',
      'remove a membership. Removal deletes the account and the Content it posted, and the email address can no longer be used to join again;',
      'report illegal Content or conduct to the authorities and cooperate with their requests.',
    ],
    'We act on behaviour that harms the community, even if it is not listed above. We are not obliged to give a reason, and a decision to approve one message does not oblige us to approve another.',
    'A removed membership does not entitle you to a refund of the one-time Verified User payment, except where the law requires it. See the Terms of Use.',
  ] },
  { title: 'Reporting a problem', body: [
    'If you see Content that breaks these rules, or a coupon or link that is dangerous or misleading, tell us through the Contact page and include where you saw it. We review reports as quickly as we reasonably can, but we cannot promise a response time.',
  ] },
  { title: 'Your Content and your responsibility', body: [
    'You are responsible for what you post. Your username may be shown publicly next to your Content, and Content you post may stay visible until the team removes it. Do not post anything you do not want others to see.',
    'You confirm that you have the right to post your Content and that it does not break the law or anyone’s rights. The licence you give Dealora for your Content, and the other rules about links, are in the Terms of Use and the Link Submission Terms.',
  ] },
  { title: 'Changes', body: [
    'We may update these rules. When we make an important change we will update the date above. If you keep using the Community Board after a change, you accept the new rules.',
  ] },
];

export default function Page() {
  return <Legal title="Community Rules" updated="November 14, 2026" intro="This is a detailed draft. It must be reviewed by a lawyer in your country, and the bracketed parts must be completed before launch." sections={sections} />;
}
