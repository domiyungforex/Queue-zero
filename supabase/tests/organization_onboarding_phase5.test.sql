begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(
  has_function_privilege(
    'authenticated',
    'public.onboard_organization_workspace_v2(uuid,text,public.organization_type,text,text,text,text[],text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users can invoke controlled organization onboarding'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.onboard_organization_workspace_v2(uuid,text,public.organization_type,text,text,text,text[],text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot create organization profiles'
);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"phase5_owner"}', true);
select onboard_organization_workspace_v2(
  '51000000-0000-4000-8000-000000000001', 'North University', 'UNIVERSITY_SCHOOL',
  'UNIVERSITY', 'North University Limited', null, array['STUDENT_SERVICES','ADMISSIONS'],
  'NG', 'Africa/Lagos', 'Main campus', 'Lagos'
) as university_workspace \gset
select onboard_organization_workspace_v2(
  '51000000-0000-4000-8000-000000000002', 'North Clinic', 'HOSPITAL_CLINIC',
  'CLINIC', 'North Clinic Limited', null, array['RECEPTION','CONSULTATION'],
  'NG', 'Africa/Lagos', 'Main branch', 'Lagos'
) as clinic_workspace \gset
select onboard_organization_workspace_v2(
  '51000000-0000-4000-8000-000000000003', 'North Finance', 'BANK_FINANCIAL',
  'MICROFINANCE_BANK', 'North Finance Limited', 'Ada Representative',
  array['CUSTOMER_SERVICE','ACCOUNT_OPENING','DEPOSITS','WITHDRAWALS','CARD_SERVICES','LOAN_ENQUIRIES','COMPLAINTS','DOCUMENT_VERIFICATION'],
  'NG', 'Africa/Lagos', 'Central branch', 'Lagos'
) as bank_workspace \gset
select onboard_organization_workspace_v2(
  '51000000-0000-4000-8000-000000000004', 'North Salon', 'SALON_BARBERSHOP',
  'SALON', 'North Salon Limited', null, array['WALK_IN_SERVICE'],
  'NG', 'Africa/Lagos', 'Studio', 'Lagos'
) as salon_workspace \gset
select onboard_organization_workspace_v2(
  '51000000-0000-4000-8000-000000000005', 'North Agency', 'GOVERNMENT_OFFICE',
  'GOVERNMENT_AGENCY', 'North Public Agency', null, array['GENERAL_ENQUIRIES','DOCUMENT_SERVICES'],
  'NG', 'Africa/Lagos', 'Public office', 'Lagos'
) as government_workspace \gset
select onboard_organization_workspace_v2(
  '51000000-0000-4000-8000-000000000006', 'North Company', 'COMPANY_OTHER',
  'COMPANY', 'North Company Limited', null, array['CUSTOM_SERVICE'],
  'NG', 'Africa/Lagos', 'Head office', 'Lagos'
) as company_workspace \gset

select is((select count(*) from organization_workspace_profiles), 6::bigint, 'every organization category persists one typed profile');
select is((select count(*) from business_members where clerk_user_id = 'phase5_owner'), 6::bigint, 'all categories reuse the existing membership system');
select is((select count(*) from queues where business_id in (:'university_workspace', :'clinic_workspace', :'bank_workspace', :'salon_workspace', :'government_workspace', :'company_workspace')), 0::bigint, 'template selection never creates live queues');
select is((select institution_type from businesses where id = :'university_workspace'), 'UNIVERSITY', 'education subtype configures the existing institution foundation');
select is((select count(*) from organization_units where organization_id = :'university_workspace' and slug = 'administration'), 1::bigint, 'education onboarding preserves institution units');
select is((select legal_name from organization_workspace_profiles where business_id = :'bank_workspace'), 'North Finance Limited', 'bank legal name is persisted');
select is((select authorized_representative_name from organization_workspace_profiles where business_id = :'bank_workspace'), 'Ada Representative', 'bank authorized representative is persisted');
select is((select verification_status::text from organization_workspace_profiles where business_id = :'bank_workspace'), 'UNVERIFIED', 'client onboarding never self-verifies a bank');
select is((select service_templates from organization_workspace_profiles where business_id = :'bank_workspace'), array['ACCOUNT_OPENING','CARD_SERVICES','COMPLAINTS','CUSTOMER_SERVICE','DEPOSITS','DOCUMENT_VERIFICATION','LOAN_ENQUIRIES','WITHDRAWALS']::text[], 'bank service templates are normalized without creating queues');

select is(
  onboard_organization_workspace_v2(
    '51000000-0000-4000-8000-000000000003', 'Ignored retry', 'BANK_FINANCIAL',
    'COMMERCIAL_BANK', 'Ignored legal name', 'Ignored representative', array['CUSTOMER_SERVICE'],
    'GH', 'Africa/Accra', 'Ignored branch', 'Accra'
  ),
  :'bank_workspace'::uuid,
  'organization profile onboarding is idempotent by actor and request key'
);
select is((select count(*) from organization_workspace_profiles where business_id = :'bank_workspace'), 1::bigint, 'retry does not duplicate the organization profile');
select is((select count(*) from locations where business_id = :'bank_workspace'), 1::bigint, 'retry does not duplicate the branch');

select create_queue(
  '52000000-0000-4000-8000-000000000001', :'bank_workspace',
  (select id from locations where business_id = :'bank_workspace'),
  'Customer service', null, 300, 3, false, false
) as bank_queue \gset
select is((select status::text from queues where id = :'bank_queue'), 'paused', 'an unverified bank queue is created safely in paused state');
select throws_ok(
  format('select set_queue_status(%L,%L,1,''open'')', :'bank_queue', :'bank_workspace'),
  'QZ010',
  'Organization verification required before public activation',
  'unverified bank cannot activate its public queue'
);

set local role service_role;
update public.organization_workspace_profiles set verification_status = 'VERIFIED' where business_id = :'bank_workspace';
reset role;
select is(
  set_queue_status(:'bank_queue', :'bank_workspace', 1, 'open'),
  :'bank_queue'::uuid,
  'verified bank can activate its configured queue'
);

select create_queue(
  '52000000-0000-4000-8000-000000000002', :'clinic_workspace',
  (select id from locations where business_id = :'clinic_workspace'),
  'Reception', null, 300, 3, false, false
) as clinic_queue \gset
select is((select status::text from queues where id = :'clinic_queue'), 'open', 'non-bank organization queues retain existing activation behavior');

select throws_ok(
  $$select onboard_organization_workspace_v2(
    '53000000-0000-4000-8000-000000000001', 'Invalid bank', 'BANK_FINANCIAL',
    'COMMERCIAL_BANK', 'Invalid Bank Limited', null, array['CUSTOMER_SERVICE'],
    'NG', 'Africa/Lagos', 'Branch', 'Lagos'
  )$$,
  '22023',
  'Invalid organization profile details',
  'bank onboarding requires an authorized representative'
);
select throws_ok(
  $$select onboard_organization_workspace_v2(
    '53000000-0000-4000-8000-000000000002', 'Invalid clinic', 'HOSPITAL_CLINIC',
    'CLINIC', 'Invalid Clinic Limited', null, array['ACCOUNT_OPENING'],
    'NG', 'Africa/Lagos', 'Branch', 'Lagos'
  )$$,
  '22023',
  'Invalid organization profile details',
  'templates cannot cross organization categories'
);

set local role authenticated;
select is((select count(*) from organization_workspace_profiles), 6::bigint, 'owner can read profiles for authorized workspaces');
select throws_ok(
  format('update organization_workspace_profiles set verification_status=''VERIFIED'' where business_id=%L', :'clinic_workspace'),
  '42501',
  null,
  'organization owners cannot self-verify affiliation'
);
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"phase5_outsider"}', true);
set local role authenticated;
select is((select count(*) from organization_workspace_profiles), 0::bigint, 'profile RLS prevents cross-tenant reads');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"phase5_legacy_owner"}', true);
select onboard_organization_workspace(
  '54000000-0000-4000-8000-000000000001', 'Legacy organization', 'COMPANY_OTHER',
  'GH', 'Africa/Accra', 'Main', 'Accra'
) as legacy_workspace \gset
select is((select workspace_ownership::text from businesses where id = :'legacy_workspace'), 'ORGANIZATION', 'existing organization onboarding RPC remains available');
select is((select count(*) from organization_workspace_profiles where business_id = :'legacy_workspace'), 0::bigint, 'legacy workflow is preserved without inventing profile data');

select * from finish();
rollback;
