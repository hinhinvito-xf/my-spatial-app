import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const createLocalChannel = (topic: string) => {
  const cleanup: Array<() => void> = [];
  const eventName = `spatial-local-broadcast:${topic}`;
  const channelId = Math.random().toString(36).slice(2);
  let channel: any;

  channel = {
    topic: `realtime:${topic}`,
    on(type: string, filter: { event?: string }, callback: (payload: any) => void) {
      if (type === 'broadcast' && typeof window !== 'undefined') {
        const handler = (event: Event) => {
          const detail = (event as CustomEvent).detail;
          if (detail.senderId === channelId) return;
          if (filter.event === '*' || detail.event === filter.event) {
            callback({ payload: detail.payload });
          }
        };
        window.addEventListener(eventName, handler);
        cleanup.push(() => window.removeEventListener(eventName, handler));
      }
      return channel;
    },
    subscribe(callback?: (status: string) => void) {
      setTimeout(() => callback?.('SUBSCRIBED'), 0);
      return channel;
    },
    presenceState() {
      return {};
    },
    track() {
      return Promise.resolve('ok');
    },
    send(message: { type: string; event: string; payload?: unknown }) {
      if (message.type === 'broadcast' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventName, {
          detail: { event: message.event, payload: message.payload, senderId: channelId },
        }));
      }
      return Promise.resolve('ok');
    },
    unsubscribe() {
      cleanup.splice(0).forEach(remove => remove());
      return Promise.resolve('ok');
    },
  };

  return channel;
};

const localSupabase = {
  channel: (topic: string) => createLocalChannel(topic),
  removeChannel: (channel: { unsubscribe?: () => Promise<string> }) => channel.unsubscribe?.() ?? Promise.resolve('ok'),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: { message: 'Supabase storage is not configured locally.' } }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    }),
  },
};

export const supabase = (
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : localSupabase
) as ReturnType<typeof createClient>;
