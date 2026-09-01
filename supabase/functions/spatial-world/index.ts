import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://my-spatial-app.vercel.app",
  "http://localhost:3000",
]);

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://my-spatial-app.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});

const WORLD_ID = "global";
const MAP_SIZE = 200;
const STORAGE_BUCKET = "spatial_media";
const DEFAULT_STAFF_CRITERIA = { nameContains: "staff", password: "staff123" };
const ADMIN_PASSWORD_SHA256 =
  Deno.env.get("SPATIAL_ADMIN_PASSWORD_SHA256") ||
  "d7100eddb3a0ff83df51873ce1019317e9e4ae9695e5b65140fff0372d59d726";

const defaultMap = () => ({
  width: MAP_SIZE,
  height: MAP_SIZE,
  tiles: Array.from({ length: MAP_SIZE }, (_, y) =>
    Array.from({ length: MAP_SIZE }, (_, x) => (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1 ? 1 : 0))
  ),
  spawnPoints: [],
  objects: [],
});

const defaultState = () => ({
  mapData: defaultMap(),
  staffCriteria: DEFAULT_STAFF_CRITERIA,
  backgroundImage: null,
  interactiveObjects: [],
});

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });

const adminClient = () => {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const secretKey = secretKeys ? JSON.parse(secretKeys).default : undefined;
  const key = secretKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing Supabase admin key.");

  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const asNumber = (value: unknown, fallback: number) => {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(-10000, Math.min(10000, next));
};

const sanitizeMapData = (value: any) => {
  const fallback = defaultMap();
  if (!value || value.width !== MAP_SIZE || value.height !== MAP_SIZE || !Array.isArray(value.tiles)) return fallback;
  if (value.tiles.length !== MAP_SIZE) return fallback;

  const tiles = value.tiles.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== MAP_SIZE) return Array.from({ length: MAP_SIZE }, () => 0);
    return row.map((tile) => (tile === 1 ? 1 : 0));
  });

  return { width: MAP_SIZE, height: MAP_SIZE, tiles, spawnPoints: [], objects: [] };
};

const sanitizeUrl = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  return value.length <= 7_000_000 ? value : null;
};

const sanitizeStaffCriteria = (value: any) => {
  const nameContains = typeof value?.nameContains === "string"
    ? value.nameContains.trim().slice(0, 80)
    : "";
  const password = typeof value?.password === "string" ? value.password.trim().slice(0, 120) : "";
  return {
    nameContains: nameContains || DEFAULT_STAFF_CRITERIA.nameContains,
    password: password || DEFAULT_STAFF_CRITERIA.password,
  };
};

const sanitizeObjects = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const allowedTypes = new Set(["image", "video", "document", "iframe", "notice"]);

  return value.slice(0, 200).flatMap((item: any) => {
    if (!item || typeof item !== "object") return [];
    const src = sanitizeUrl(item.src);
    if (!src || typeof item.id !== "string" || !allowedTypes.has(item.type)) return [];

    return [{
      id: item.id,
      type: item.type,
      x: asNumber(item.x, 20),
      y: asNumber(item.y, 20),
      width: Math.max(1, Math.min(40, asNumber(item.width, 6))),
      height: Math.max(1, Math.min(40, asNumber(item.height, 4))),
      src,
      title: typeof item.title === "string" ? item.title.slice(0, 180) : undefined,
    }];
  });
};

const sanitizeState = (value: any) => ({
  mapData: sanitizeMapData(value?.mapData),
  staffCriteria: sanitizeStaffCriteria(value?.staffCriteria),
  backgroundImage: sanitizeUrl(value?.backgroundImage),
  interactiveObjects: sanitizeObjects(value?.interactiveObjects),
});

const loadState = async () => {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("spatial_world_states")
    .select("state, updated_at")
    .eq("id", WORLD_ID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const state = defaultState();
    const { data: inserted, error: insertError } = await supabase
      .from("spatial_world_states")
      .upsert({ id: WORLD_ID, state, updated_at: new Date().toISOString() })
      .select("state, updated_at")
      .single();
    if (insertError) throw insertError;
    return { state: sanitizeState(inserted.state), updatedAt: inserted.updated_at };
  }

  return { state: sanitizeState(data.state), updatedAt: data.updated_at };
};

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const requireAdmin = async (body: any, origin: string | null) => {
  if (typeof body?.adminPassword !== "string" || await sha256(body.adminPassword) !== ADMIN_PASSWORD_SHA256) {
    return json({ error: "Admin password is incorrect." }, 403, origin);
  }
  return null;
};

const saveState = async (body: any, origin: string | null) => {
  const denied = await requireAdmin(body, origin);
  if (denied) return denied;

  const supabase = adminClient();
  const state = sanitizeState(body.state);
  const { data, error } = await supabase
    .from("spatial_world_states")
    .upsert({ id: WORLD_ID, state, updated_at: new Date().toISOString() })
    .select("state, updated_at")
    .single();

  if (error) throw error;
  return json({ state: sanitizeState(data.state), updatedAt: data.updated_at }, 200, origin);
};

const dataUrlToBytes = (dataUrl: string) => {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Expected a data URL.");

  const contentType = match[1] || "application/octet-stream";
  const raw = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return { bytes, contentType };
};

const cleanFileName = (fileName: unknown) =>
  String(fileName || "upload.bin").replace(/[^a-zA-Z0-9.\-_]/g, "").slice(0, 120) || "upload.bin";

const createUploadUrl = async (body: any, origin: string | null) => {
  const denied = await requireAdmin(body, origin);
  if (denied) return denied;

  const folder = body.kind === "background" ? "bg" : "objects";
  const path = `${folder}/${Date.now()}_${crypto.randomUUID()}_${cleanFileName(body.fileName)}`;
  const supabase = adminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);

  if (error || !data?.token) throw error || new Error("Signed upload token was not created.");

  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return json({ path, token: data.token, url: publicData.publicUrl, contentType: body.contentType || null }, 200, origin);
};

const uploadMedia = async (body: any, origin: string | null) => {
  const denied = await requireAdmin(body, origin);
  if (denied) return denied;
  if (typeof body.dataUrl !== "string" || body.dataUrl.length > 8_000_000) {
    return json({ error: "File is missing or too large." }, 400, origin);
  }

  const { bytes, contentType } = dataUrlToBytes(body.dataUrl);
  const folder = body.kind === "background" ? "bg" : "objects";
  const path = `${folder}/${Date.now()}_${crypto.randomUUID()}_${cleanFileName(body.fileName)}`;
  const supabase = adminClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return json({ url: data.publicUrl, path, contentType }, 200, origin);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    if (req.method === "GET") return json(await loadState(), 200, origin);

    const body = await req.json().catch(() => ({}));
    if (body.action === "get_state") return json(await loadState(), 200, origin);
    if (body.action === "save_state") return await saveState(body, origin);
    if (body.action === "create_upload_url") return await createUploadUrl(body, origin);
    if (body.action === "upload_media") return await uploadMedia(body, origin);

    return json({ error: "Unknown action." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return json({ error: message }, 500, origin);
  }
});
