'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { CATEGORIES } from './regions';

// The categories come from the database (the admin manages them). Until they load, the built-in list is shown.
export function useCategories() {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort').order('name');
    setRows(data || []); setReady(true);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const names = rows.length ? rows.map((r) => r.name) : CATEGORIES;
  return { rows, names, ready, reload };
}
