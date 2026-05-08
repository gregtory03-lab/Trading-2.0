import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePlatformSetting<T = unknown>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!active) return;
      if (!error && data && data.value !== null && data.value !== undefined) {
        setValue(data.value as T);
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`platform_settings:${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_settings', filter: `key=eq.${key}` },
        (payload) => {
          const newRow = (payload.new as { value?: T } | null);
          if (newRow && newRow.value !== undefined && newRow.value !== null) {
            setValue(newRow.value as T);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [key]);

  return { value, loading };
}
