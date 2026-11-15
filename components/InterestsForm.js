'use client';
import { cname, sortedCountries } from '../lib/regions';
import { useCategories } from '../lib/useCategories';

export const SAVE_FOR = ['Saving on everyday shopping', 'Big purchases (electronics, furniture)', 'Travel and trips', 'Eating out and food delivery', 'Gifts and holidays', 'Treating myself'];
export const WHAT_MATTERS = ['Highest % off', 'Free shipping', 'Cashback', 'Coupons for specific stores', 'Limited-time flash deals'];
export const HOW_SHOP = [['online', 'Mostly online'], ['store', 'Mostly in stores'], ['both', 'Both']];
export const FREQUENCY = [['weekly', 'Every week'], ['monthly', 'A few times a month'], ['rarely', 'Occasionally']];

export const EMPTY_INTERESTS = { categories: [], saveFor: [], whatMatters: [], stores: '', how: '', frequency: '', country: '', area: '' };

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// Questions a Verified member answers so we can prepare a personal page of the best coupons for them.
export default function InterestsForm({ value, onChange }) {
  const v = { ...EMPTY_INTERESTS, ...(value || {}) };
  const { names: catNames } = useCategories();
  const set = (k, val) => onChange({ ...v, [k]: val });
  return (
    <div className="interests">
      <fieldset>
        <legend>Which categories do you use coupons for?</legend>
        <div className="checks">
          {catNames.map((c) => (
            <label key={c}><input type="checkbox" checked={v.categories.includes(c)} onChange={() => set('categories', toggle(v.categories, c))} /> {c}</label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>What do you usually save on?</legend>
        <div className="checks">
          {SAVE_FOR.map((c) => (
            <label key={c}><input type="checkbox" checked={v.saveFor.includes(c)} onChange={() => set('saveFor', toggle(v.saveFor, c))} /> {c}</label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>What matters most in a deal?</legend>
        <div className="checks">
          {WHAT_MATTERS.map((c) => (
            <label key={c}><input type="checkbox" checked={v.whatMatters.includes(c)} onChange={() => set('whatMatters', toggle(v.whatMatters, c))} /> {c}</label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="iv-stores">Your favorite stores or brands</label>
      <input id="iv-stores" maxLength={300} placeholder="e.g. Nike, Amazon, Booking.com" value={v.stores} onChange={(e) => set('stores', e.target.value)} />
      <div className="two">
        <div>
          <label htmlFor="iv-how">How do you shop?</label>
          <select id="iv-how" value={v.how} onChange={(e) => set('how', e.target.value)}>
            <option value="">Choose…</option>
            {HOW_SHOP.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="iv-freq">How often do you use coupons?</label>
          <select id="iv-freq" value={v.frequency} onChange={(e) => set('frequency', e.target.value)}>
            <option value="">Choose…</option>
            {FREQUENCY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="two">
        <div>
          <label htmlFor="iv-country">Where do you shop from?</label>
          <select id="iv-country" value={v.country} onChange={(e) => set('country', e.target.value)}>
            <option value="">Choose…</option>
            {sortedCountries().map((c) => <option key={c} value={c}>{cname(c)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="iv-area">Area or city (optional)</label>
          <input id="iv-area" maxLength={60} value={v.area} onChange={(e) => set('area', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
