// Supabase Edge Function (Deno): verify a store receipt, upsert subscriptions.
// Runs with the service role — the ONLY writer of the subscriptions table.
//
// STATUS: stub. Receipt verification is the remaining work:
//   - apple: App Store Server API (JWS transaction verification)
//   - google: Play Developer API purchases.subscriptionsv2.get
// Both need store credentials in function secrets, never in the client.

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: userData, error: userErr } = await createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  ).auth.getUser();
  if (userErr || !userData.user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { store, receipt } = await req.json();
  if (store !== 'apple' && store !== 'google') {
    return Response.json({ error: 'unknown store' }, { status: 422 });
  }

  // TODO(iap): real verification. Until then this function rejects everything —
  // fail closed, nobody gets paid features from an unverified receipt.
  const verified: null | { originalTransactionId: string; expiresAt: string } = null;
  void receipt;
  if (!verified) {
    return Response.json({ error: 'receipt verification not implemented' }, { status: 422 });
  }

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userData.user.id,
    tier: 'paid',
    store,
    original_transaction_id: verified.originalTransactionId,
    expires_at: verified.expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ tier: 'paid', watermark_free: true });
});
