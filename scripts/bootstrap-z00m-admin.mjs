import { createClient } from '@supabase/supabase-js';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const url = required('SUPABASE_URL');
const adminKey = process.env.SUPABASE_SECRET_KEY || required('SUPABASE_SERVICE_ROLE_KEY');
const email = required('BOOTSTRAP_ADMIN_EMAIL').trim().toLowerCase();
const password = required('BOOTSTRAP_ADMIN_PASSWORD');

const supabase = createClient(url, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

const matches = (listed.users ?? []).filter((user) => user.email?.trim().toLowerCase() === email);
if (matches.length > 1) {
  throw new Error(`Refusing bootstrap: found ${matches.length} Auth users for the configured email.`);
}

let user;
let createdOrReused;
if (matches.length === 0) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { app_name: 'Z00m', display_name: 'Z00m Admin' },
  });
  if (error || !data.user) throw error ?? new Error('Auth user creation returned no user.');
  user = data.user;
  createdOrReused = 'created';
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(matches[0].id, {
    password,
    email_confirm: true,
    user_metadata: { ...matches[0].user_metadata, app_name: 'Z00m', display_name: 'Z00m Admin' },
  });
  if (error || !data.user) throw error ?? new Error('Auth user update returned no user.');
  user = data.user;
  createdOrReused = 'reused';
}

console.log(JSON.stringify({
  status: 'pass',
  createdOrReused,
  email: user.email,
  emailConfirmed: Boolean(user.email_confirmed_at),
  userId: user.id,
}));
