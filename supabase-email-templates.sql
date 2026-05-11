-- Email Templates table for SAMA 2.0
-- Run this in your Supabase SQL Editor.
--
-- Backs the admin "Mejl → Mallar" tab. Each row is one email type (kind)
-- with editable subject, markdown body, and a list of variables that can
-- be substituted at render time. The /api/admin/email/templates routes
-- read/update by `kind` (primary key) and never insert new rows from the
-- UI, so the seed at the bottom of this file must run for the editor to
-- have anything to show. Re-running the file is safe — existing rows are
-- kept untouched.

CREATE TABLE IF NOT EXISTS email_templates (
  kind          text        PRIMARY KEY,
  name          text        NOT NULL,
  subject       text        NOT NULL DEFAULT '',
  body_markdown text        NOT NULL DEFAULT '',
  variables     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  description   text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Admin-only table: the API uses the Supabase service-role client (see
-- lib/admin-guard.ts), which bypasses RLS. Enabling RLS with no policies
-- locks the table to service-role access.
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

INSERT INTO email_templates (kind, name, subject, body_markdown, variables, description)
VALUES
  (
    'registration',
    'Registreringsmail',
    'Välkommen till {{brand_name}}',
    E'Hej {{first_name}},\n\nTack för att du registrerat dig hos {{brand_name}}!\n\nLogga in på {{login_url}} när du vill komma igång.\n\nVänliga hälsningar,\n{{brand_name}}-teamet',
    '[
      {"name":"first_name","description":"Användarens förnamn","sample":"Anna"},
      {"name":"brand_name","description":"Varumärkesnamn","sample":"Successifier"},
      {"name":"login_url","description":"Länk till inloggning","sample":"https://app.successifier.com"}
    ]'::jsonb,
    'Skickas när en ny kund registrerar sig.'
  ),
  (
    'weekly_status',
    'Veckostatus',
    'Veckorapport från {{brand_name}}',
    E'Hej {{first_name}},\n\nHär kommer din veckorapport.\n\n## Highlights\n\n{{highlights}}\n\nFortsatt fin vecka!',
    '[
      {"name":"first_name","description":"Användarens förnamn","sample":"Anna"},
      {"name":"brand_name","description":"Varumärkesnamn","sample":"Successifier"},
      {"name":"highlights","description":"Veckans highlights","sample":"3 nya artiklar publicerade, 12 % fler besökare."}
    ]'::jsonb,
    'Skickas måndagar 08:00 till opt-in-kunder.'
  ),
  (
    'reactivation',
    'Återaktivering',
    'Vi saknar dig på {{brand_name}}',
    E'Hej {{first_name}},\n\nVi har inte sett dig på ett tag. Det finns nya förslag som väntar på dig.\n\nLogga in: {{login_url}}',
    '[
      {"name":"first_name","description":"Användarens förnamn","sample":"Anna"},
      {"name":"brand_name","description":"Varumärkesnamn","sample":"Successifier"},
      {"name":"login_url","description":"Länk till inloggning","sample":"https://app.successifier.com"}
    ]'::jsonb,
    'Skickas till kunder som varit inaktiva en längre period. Utskickslogik behöver byggas i backend.'
  ),
  (
    'social_posts',
    'Sociala posts',
    'Förslag på sociala posts denna vecka',
    E'Hej {{first_name}},\n\nHär är denna veckas förslag på sociala posts.\n\n{{posts}}',
    '[
      {"name":"first_name","description":"Användarens förnamn","sample":"Anna"},
      {"name":"posts","description":"Lista av föreslagna posts","sample":"Post 1: ...\nPost 2: ..."}
    ]'::jsonb,
    'Skickas måndagar 09:00 till opt-in-kunder.'
  ),
  (
    'password_reset',
    'Lösenordsåterställning',
    '',
    E'_Den här mallen hanteras av Supabase Auth och kan inte redigeras härifrån._\n\nRedigera istället i Supabase Dashboard → Authentication → Email Templates.',
    '[]'::jsonb,
    'Hanteras av Supabase Auth. Visas här som referens.'
  )
ON CONFLICT (kind) DO NOTHING;
