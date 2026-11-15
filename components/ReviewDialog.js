'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

export default function ReviewDialog({ coupon, onClose, auth, reviews }) {
  const [rating, setRating] = useState(5);
  const [report, setReport] = useState('worked');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (coupon) { setMsg({ type: '', text: '' }); setBody(''); } }, [coupon]);
  if (!coupon) return null;

  const list = reviews.filter((r) => r.coupon_id === coupon.id);
  const avg = list.filter((r) => r.rating).length ? list.reduce((a, r) => a + (r.rating || 0), 0) / list.filter((r) => r.rating).length : 0;

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (report !== 'expired' && !body.trim()) return setMsg({ type: 'err', text: 'Please write a short review.' });
    setBusy(true);
    const { error } = await supabase.from('submissions').insert({
      user_id: auth.user.id, kind: 'review', coupon_id: coupon.id, store: coupon.store,
      rating, report, body: body.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: 'Could not submit right now. Please try again.' });
    setBody('');
    setMsg({ type: 'ok', text: 'Thank you! Your review will appear after the Dealora team approves it.' });
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Reviews" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reviews for {coupon.store}</h3>
        <p>{list.length ? `${list.length} approved review${list.length > 1 ? 's' : ''}${avg ? ', average ' + avg.toFixed(1) + ' of 5' : ''}` : 'No reviews yet. Be the first.'}</p>
        <div>
          {list.map((r) => (
            <div className="rv" key={r.id}>
              {r.rating && <span className="stars">{stars(r.rating)}</span>}{' '}
              {r.author_name && <b>@{r.author_name}</b>}{' '}{r.author_verified && <span className="badge verified">Verified User</span>}{' '}
              {r.report === 'expired' && <span className="pill no">Reported expired</span>}
              {r.report === 'failed' && <span className="pill no">Did not work</span>}
              {r.body && <p>{r.body}</p>}
            </div>
          ))}
        </div>
        {auth.user ? (
          <form onSubmit={submit} style={{ marginTop: 16 }}>
            <label htmlFor="rv-rate">Your rating</label>
            <select id="rv-rate" value={rating} onChange={(e) => setRating(+e.target.value)}>
              <option value={5}>5 – Worked great</option><option value={4}>4</option><option value={3}>3</option><option value={2}>2</option><option value={1}>1 – Did not work</option>
            </select>
            <label htmlFor="rv-status">Coupon status</label>
            <select id="rv-status" value={report} onChange={(e) => setReport(e.target.value)}>
              <option value="worked">It worked</option><option value="failed">It did not work</option><option value="expired">Expired</option>
            </select>
            <label htmlFor="rv-text">Your review</label>
            <textarea id="rv-text" maxLength={500} placeholder="Did the code work? Any tips?" value={body} onChange={(e) => setBody(e.target.value)} />
            {msg.text && <div className={msg.type === 'ok' ? 'dlg-msg' : 'err'}>{msg.text}</div>}
            <div className="dlg-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-solid" type="submit" disabled={busy}>Submit for review</button>
            </div>
          </form>
        ) : (
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            <Link className="btn btn-solid" href="/signup">Sign up free to review</Link>
          </div>
        )}
      </div>
    </div>
  );
}
