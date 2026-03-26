import { supabase } from "@/lib/supabase";
import { ServiceError } from "./service-error";

const DEFAULT_TTL_MS = 10_000; // 10 seconds
const RETRY_DELAY_MS = 100;
const MAX_RETRIES = 50; // 50 * 100ms = 5s max wait

async function acquireLock(key: string, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Clean up expired locks first
    const { error: cleanupError } = await supabase
      .from("locks")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (cleanupError) {
      console.error(`[lock] cleanup error for "${key}":`, cleanupError.message);
    }

    // Try to insert our lock
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const { error } = await supabase
      .from("locks")
      .insert({ key, expires_at: expiresAt });

    if (!error) {
      return;
    }

    // 23505 = unique violation → lock held by someone else
    if (error.code === "23505") {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    // Unexpected error — likely table doesn't exist
    console.error(
      `[lock] unexpected error for "${key}":`,
      error.code,
      error.message,
    );
    throw new ServiceError(`Lock error (${error.code}): ${error.message}`, 500);
  }

  console.error(`[lock] timeout acquiring "${key}"`);
  throw new ServiceError(
    `Lock timeout: could not acquire "${key}" after ${MAX_RETRIES * RETRY_DELAY_MS}ms`,
    503,
  );
}

async function releaseLock(key: string): Promise<void> {
  const { error } = await supabase.from("locks").delete().eq("key", key);
  if (error) {
    console.error(`[lock] release error for "${key}":`, error.message);
  }
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  await acquireLock(key, ttlMs);
  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}
