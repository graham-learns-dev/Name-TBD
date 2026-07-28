// Supabase Edge Function (Deno): full account deletion (App Store requirement,
// in-app button in Profile). All app tables cascade from auth.users (001_init.sql),
// so deleting the auth user removes profiles, subscriptions, user_programs and
// logged_sets in one statement.

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';

  const { data: userData, error: userErr } = await createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  ).auth.getUser();
  if (userErr || !userData.user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
});
