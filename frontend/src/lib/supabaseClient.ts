import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const LOCAL_WORLD_STATE_KEY = 'spatial_world_state';

const createLocalChannel = (topic: string) => {
  const cleanup: Array<() => void> = [];
  const eventName = `spatial-local-broadcast:${topic}`;
  const channelId = Math.random().toString(36).slice(2);
  const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(eventName) : null;
  const receiveMessage = (detail: any, filter: { event?: string }, callback: (payload: any) => void) => {
    if (!detail || detail.senderId === channelId) return;
    if (filter.event === '*' || detail.event === filter.event) {
      callback({ payload: detail.payload });
    }
  };
  let channel: any;

  channel = {
    topic: `realtime:${topic}`,
    on(type: string, filter: { event?: string }, callback: (payload: any) => void) {
      if (type === 'broadcast' && typeof window !== 'undefined') {
        const handler = (event: Event) => {
          receiveMessage((event as CustomEvent).detail, filter, callback);
        };
        const broadcastHandler = (event: MessageEvent) => {
          receiveMessage(event.data, filter, callback);
        };
        window.addEventListener(eventName, handler);
        cleanup.push(() => window.removeEventListener(eventName, handler));
        broadcastChannel?.addEventListener('message', broadcastHandler);
        cleanup.push(() => broadcastChannel?.removeEventListener('message', broadcastHandler));
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
        const detail = { event: message.event, payload: message.payload, senderId: channelId };
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
        broadcastChannel?.postMessage(detail);
      }
      return Promise.resolve('ok');
    },
    unsubscribe() {
      cleanup.splice(0).forEach(remove => remove());
      broadcastChannel?.close();
      return Promise.resolve('ok');
    },
  };

  return channel;
};

const localSupabase = {
  channel: (topic: string) => createLocalChannel(topic),
  removeChannel: (channel: { unsubscribe?: () => Promise<string> }) => channel.unsubscribe?.() ?? Promise.resolve('ok'),
  functions: {
    invoke: async (_name: string, options?: { body?: any }) => {
      const body = options?.body ?? {};
      if (body.action === 'save_state') {
        window.localStorage.setItem(LOCAL_WORLD_STATE_KEY, JSON.stringify(body.state));
        return { data: { state: body.state, updatedAt: new Date().toISOString() }, error: null };
      }
      if (body.action === 'upload_media') {
        return { data: { url: body.dataUrl, path: 'local-preview', contentType: 'application/octet-stream' }, error: null };
      }

      const stored = window.localStorage.getItem(LOCAL_WORLD_STATE_KEY);
      return {
        data: { state: stored ? JSON.parse(stored) : null, updatedAt: null },
        error: null,
      };
    },
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: { message: 'Supabase storage is not configured locally.' } }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
      createSignedUrl: async () => ({ data: null, error: { message: 'Supabase storage is not configured locally.' } }),
    }),
  },
};

export const supabase = (
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : localSupabase
) as ReturnType<typeof createClient>;
