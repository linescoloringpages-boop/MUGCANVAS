'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Badge, Action, RecCard, colorFor, ini, stars, imgUrl } from './Cards';
import { cname } from '../lib/regions';

const KIND = { announcement: 'News', coupon: 'New coupon', rec: 'Shared by a member', review: 'New review', member: 'Welcome', question: 'Chat', poll: 'Question' };
const ago = (d) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 60) return m <= 1 ? 'just now' : m + ' min ago';
  if (m < 1440) return Math.round(m / 60) + ' h ago';
  return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
};

// A smaller version of the site's own coupon card.
function MiniCoupon({ d, unlocked }) {
  return (
    <article className="deal mini">
      {d.image_path && <img className="deal-img" alt="" src={imgUrl(d.image_path)} loading="lazy" />}
      <div className="deal-top">
        <div className="store"><span className="mono" style={{ background: colorFor(d.store) }}>{ini(d.store)}</span><span>{d.store}</span></div>
        <Badge type={d.type} />
      </div>
      <div className="off">{d.discount_text}</div>
      {d.description && <p className="desc">{d.description}</p>}
      <div className="by">Valid in: {cname(d.country)}{d.area ? ' · ' + d.area : ''}</div>
      <Action code={d.code} url={d.url} unlocked={unlocked} />
    </article>
  );
}

function Review({ r }) {
  return (
    <div className="rv">
      <span className="stars" aria-hidden="true">{r.rating ? stars(r.rating) : ''}</span>{' '}
      <b>{r.author_name ? '@' + r.author_name : 'A member'}</b>
      {r.report === 'expired' ? ' · reported expired' : r.report === 'failed' ? ' · did not work' : ''}
      {r.body ? <div>{r.body}</div> : null}
    </div>
  );
}

// The community board: a bulletin board that only the Dealora team writes to.
// Everything on it comes from the team: news, coupons, member shares and reviews, chats and questions.
// Members can reply or vote only where the team opened a post. Replies show after the team approves them.
export default function Board({ auth, stats }) {
  const [posts, setPosts] = useState([]);
  const [data, setData] = useState({ coupons: {}, subs: {} });
  const [comments, setComments] = useState([]);
  const [counts, setCounts] = useState([]);
  const [mine, setMine] = useState({ votes: {}, pending: [] });
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState({});
  const [ready, setReady] = useState(false);
  const uid = auth.user ? auth.user.id : null;

  const load = useCallback(async () => {
    const p = await supabase.from('board_posts').select('*').in('status', ['published', 'closed']).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(40);
    const list = p.data || [];
    setPosts(list);
    const ids = list.map((x) => x.id);
    const cids = list.map((x) => x.coupon_id).filter(Boolean);
    const sids = list.map((x) => x.submission_id).filter(Boolean);
    const [c, sb, cm, n] = await Promise.all([
      cids.length ? supabase.from(uid ? 'coupons' : 'coupons_public').select('*').in('id', cids) : { data: [] },
      sids.length ? supabase.from(uid ? 'community_members' : 'community_public').select('*').in('id', sids) : { data: [] },
      ids.length ? supabase.from('board_comments_public').select('*').in('post_id', ids).order('created_at') : { data: [] },
      ids.length ? supabase.from('board_poll_counts').select('*').in('post_id', ids) : { data: [] },
    ]);
    const coupons = {}; (c.data || []).forEach((x) => { coupons[x.id] = x; });
    const subs = {}; (sb.data || []).forEach((x) => { subs[x.id] = x; });
    setData({ coupons, subs }); setComments(cm.data || []); setCounts(n.data || []);
    if (uid) {
      const [v, pc] = await Promise.all([
        supabase.from('board_votes').select('post_id,choice').eq('user_id', uid),
        supabase.from('board_comments').select('post_id,body,status').eq('user_id', uid).eq('status', 'pending'),
      ]);
      const votes = {}; (v.data || []).forEach((r) => { votes[r.post_id] = r.choice; });
      setMine({ votes, pending: pc.data || [] });
    }
    setReady(true);
  }, [uid]);
  useEffect(() => { load(); }, [load]);
  // Free chats feel live: refresh every 20 seconds while the page is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const vote = async (post, choice) => {
    const { error } = await supabase.from('board_votes').upsert({ post_id: post.id, user_id: uid, choice }, { onConflict: 'post_id,user_id' });
    if (error) return setMsg((m) => ({ ...m, [post.id]: 'Could not save your vote.' }));
    await load();
  };
  const reply = async (post) => {
    const body = (draft[post.id] || '').trim();
    if (!body) return;
    const { data: saved, error } = await supabase.from('board_comments').insert({ post_id: post.id, user_id: uid, body }).select('status').single();
    if (error) return setMsg((m) => ({ ...m, [post.id]: /too many/.test(error.message) ? 'You have several messages waiting. Please wait for approval.' : 'Could not send your message.' }));
    setDraft((d) => ({ ...d, [post.id]: '' }));
    setMsg((m) => ({ ...m, [post.id]: saved && saved.status === 'approved' ? '' : 'Thanks! Your message will show after the Dealora team approves it.' }));
    await load();
  };

  // Reviews of a coupon that is on the board are shown right under that coupon.
  const couponOnBoard = new Set(posts.filter((p) => p.kind === 'coupon' && data.coupons[p.coupon_id]).map((p) => p.coupon_id));
  const reviewsFor = (cid) => posts.filter((p) => p.kind === 'review' && data.subs[p.submission_id] && data.subs[p.submission_id].coupon_id === cid).map((p) => data.subs[p.submission_id]);

  const items = posts.map((p) => {
    if (p.kind === 'coupon' && !data.coupons[p.coupon_id]) return null;
    if ((p.kind === 'rec' || p.kind === 'review') && !data.subs[p.submission_id]) return null;
    if (p.kind === 'review' && data.subs[p.submission_id].coupon_id && couponOnBoard.has(data.subs[p.submission_id].coupon_id)) return null; // shown under its coupon
    return p;
  }).filter(Boolean);

  return (
    <div className="board" aria-label="Community board">
      <div className="board-head">
        <div><b>Community Board</b><span>News, new deals, reviews and questions from the Dealora team</span></div>
        {stats && (
          <div className="counter" aria-label="Community size">
            <span><b>{Number(stats.members).toLocaleString('en')}</b> member{Number(stats.members) === 1 ? '' : 's'}</span>
            {Number(stats.verified) > 0 && <span><b>{Number(stats.verified).toLocaleString('en')}</b> Verified</span>}
          </div>
        )}
      </div>
      <div className="board-feed">
        {ready && items.length === 0 && <p className="empty" style={{ margin: 0 }}>Nothing posted yet. Check back soon.</p>}
        {!ready && <p className="empty" style={{ margin: 0 }}>Loading…</p>}
        {items.map((p) => {
          const cs = comments.filter((c) => c.post_id === p.id);
          const pc = counts.filter((c) => c.post_id === p.id);
          const total = pc.reduce((a, c) => a + c.votes, 0);
          const myPending = mine.pending.filter((c) => c.post_id === p.id);
          const open = p.status === 'published';
          const sub = p.submission_id ? data.subs[p.submission_id] : null;
          const cp = p.kind === 'coupon' ? data.coupons[p.coupon_id] : null;
          return (
            <div className="msg" key={p.id}>
              <div className="bubble">
                <div className="meta"><b>Dealora Team</b> <span className="kindtag">{KIND[p.kind] || 'News'}</span>{p.pinned && <span className="kindtag">Pinned</span>} · {ago(p.created_at)}</div>

                {cp && (<><MiniCoupon d={cp} unlocked={!!uid} />
                  {reviewsFor(cp.id).length > 0 && <div className="replies">{reviewsFor(cp.id).map((r) => <Review key={r.id} r={r} />)}</div>}</>)}
                {p.kind === 'rec' && sub && <div className="mini"><RecCard r={sub} unlocked={!!uid} /></div>}
                {p.kind === 'review' && sub && (<><div className="ttl">Review of {sub.store}</div><div className="replies"><Review r={sub} /></div></>)}

                {!cp && !sub && <div className="ttl">{p.title}</div>}
                {!cp && !sub && p.body && <p>{p.body}</p>}

                {p.poll_options && (
                  <div className="poll">
                    {p.poll_options.map((o, i) => {
                      const v = (pc.find((c) => c.choice === i) || { votes: 0 }).votes;
                      const pct = total ? Math.round((v / total) * 100) : 0;
                      const chosen = mine.votes[p.id] === i;
                      return (
                        <button key={i} type="button" className={'opt' + (chosen ? ' on' : '')} disabled={!uid || !open} onClick={() => vote(p, i)} aria-pressed={chosen}>
                          <span className="bar" style={{ width: pct + '%' }} />
                          <span className="lab">{o}{chosen ? ' ✓' : ''}</span><span className="pct">{pct}%</span>
                        </button>
                      );
                    })}
                    <small>{total} vote{total === 1 ? '' : 's'}{!uid ? ' · ' : ''}{!uid && <Link href="/signup" style={{ color: 'var(--brand)' }}>Sign up free to vote</Link>}{uid && !open ? ' · Voting is closed' : ''}</small>
                  </div>
                )}

                {cs.length > 0 && (
                  <div className="replies">
                    {cs.map((c) => <div key={c.id}><b>{c.author_name ? '@' + c.author_name : 'Member'}</b>{c.author_verified && <span className="badge verified" style={{ marginLeft: 6 }}>Verified User</span>} {c.body}</div>)}
                  </div>
                )}
                {myPending.map((c, i) => <div className="replies pend" key={i}>Your reply is waiting for approval: {c.body}</div>)}

                {p.replies_open && open && <small>{p.chat_mode === 'free' ? 'Free chat: messages show right away. Please follow the Community Rules.' : 'Messages are shown after the Dealora team approves them.'}</small>}
                {p.replies_open && open && (uid ? (
                  <div className="replyform">
                    <input maxLength={300} placeholder="Write a message…" aria-label="Message" value={draft[p.id] || ''} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); reply(p); } }} />
                    <button type="button" className="btn btn-solid" onClick={() => reply(p)}>Send</button>
                  </div>
                ) : <small><Link href="/signup" style={{ color: 'var(--brand)', fontWeight: 600 }}>Sign up free</Link> to reply.</small>)}
                {msg[p.id] && <small>{msg[p.id]}</small>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
