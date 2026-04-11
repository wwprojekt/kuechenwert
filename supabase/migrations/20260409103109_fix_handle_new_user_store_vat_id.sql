CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_type TEXT;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Check user_type from registration metadata
  _user_type := NEW.raw_user_meta_data->>'user_type';
  
  -- IMPORTANT: ALL new users start as 'seller'.
  -- Dealers only get the 'dealer' role AFTER admin approval via approve_dealer_application().
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'seller');
  
  -- If dealer registration, create dealer_application with status 'pending'
  IF _user_type = 'dealer' THEN
    INSERT INTO public.dealer_applications (
      user_id,
      company_name,
      company_address,
      company_postal_code,
      company_city,
      country,
      contact_person_name,
      contact_person_position,
      phone,
      website,
      legal_form,
      founded_year,
      vat_id,
      status
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Unbekannt'),
      COALESCE(NEW.raw_user_meta_data->>'company_address', '-'),
      COALESCE(NEW.raw_user_meta_data->>'company_postal_code', '00000'),
      COALESCE(NEW.raw_user_meta_data->>'company_city', '-'),
      COALESCE(NEW.raw_user_meta_data->>'country', 'DE'),
      COALESCE(NEW.raw_user_meta_data->>'contact_person_name',
               CONCAT_WS(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')),
      NEW.raw_user_meta_data->>'contact_person_position',
      COALESCE(NEW.raw_user_meta_data->>'phone', '-'),
      NEW.raw_user_meta_data->>'website',
      NEW.raw_user_meta_data->>'legal_form',
      CASE 
        WHEN NEW.raw_user_meta_data->>'founded_year' IS NOT NULL 
             AND NEW.raw_user_meta_data->>'founded_year' ~ '^\d+$'
        THEN (NEW.raw_user_meta_data->>'founded_year')::integer
        ELSE NULL
      END,
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'vat_id', '')), ''),
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;