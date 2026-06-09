


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."analyze_or_patterns_for_migration"() RETURNS TABLE("ingredient_a" "text", "ingredient_b" "text", "suggested_relationship" "text", "confidence" numeric, "occurrence_count" bigint, "reasoning" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    ingredient_a,
    ingredient_b,
    CASE 
      WHEN always_equivalent THEN 'equivalent'
      WHEN ever_equivalent = false THEN 'substitute'
      ELSE 'context_dependent'
    END as suggested_relationship,
    avg_confidence as confidence,
    occurrence_count,
    CASE 
      WHEN always_equivalent THEN 'Always marked as equivalent in ' || occurrence_count || ' recipes'
      WHEN ever_equivalent = false THEN 'Always has a primary choice in ' || occurrence_count || ' recipes'
      ELSE 'Varies by recipe context - needs manual review'
    END as reasoning
  FROM or_pattern_analysis
  WHERE occurrence_count >= 2  -- Only patterns seen multiple times
  ORDER BY occurrence_count DESC;
$$;


ALTER FUNCTION "public"."analyze_or_patterns_for_migration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_extraction_results"("p_book_id" "uuid", "p_test_run_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_test_run_id uuid := gen_random_uuid();
  v_archived_count integer;
BEGIN
  INSERT INTO recipe_extraction_history (
    test_run_id,
    test_run_notes,
    original_queue_id,
    book_id,
    filename,
    extraction_position,
    extraction_version,
    gold_standard_recipe_id,
    gold_standard_title,
    pass0_data,
    pass1_data,
    pass2_data,
    pass3_data,
    pass4_data,
    pass0_cost_usd,
    pass1_cost_usd,
    pass2_cost_usd,
    pass3_cost_usd,
    pass4_cost_usd,
    cost_usd,
    processing_time_ms,
    status,
    error_message,
    extracted_title,
    extracted_ingredient_count,
    extracted_instruction_count,
    gold_ingredient_count,
    gold_instruction_count,
    ingredient_count_match,
    instruction_count_match
  )
  SELECT
    v_test_run_id,
    p_test_run_notes,
    q.id,
    q.book_id,
    q.filename,
    q.extraction_position,
    q.extraction_version,
    rim.recipe_id,
    r.title,
    q.pass0_data,
    q.pass1_data,
    q.pass2_data,
    q.pass3_data,
    q.pass4_data,
    q.pass0_cost_usd,
    q.pass1_cost_usd,
    q.pass2_cost_usd,
    q.pass3_cost_usd,
    q.pass4_cost_usd,
    q.cost_usd,
    q.processing_time_ms,
    q.status,
    q.error_message,
    q.pass3_data->'recipe'->'title'->>'text',
    jsonb_array_length(COALESCE(q.pass3_data->'recipe'->'ingredients', '[]'::jsonb)),
    jsonb_array_length(COALESCE(q.pass3_data->'recipe'->'instructions', '[]'::jsonb)),
    jsonb_array_length(COALESCE(r.ingredients::jsonb, '[]'::jsonb)),
    jsonb_array_length(COALESCE(r.instructions::jsonb, '[]'::jsonb)),
    jsonb_array_length(COALESCE(q.pass3_data->'recipe'->'ingredients', '[]'::jsonb)) = 
      jsonb_array_length(COALESCE(r.ingredients::jsonb, '[]'::jsonb)),
    jsonb_array_length(COALESCE(q.pass3_data->'recipe'->'instructions', '[]'::jsonb)) = 
      jsonb_array_length(COALESCE(r.instructions::jsonb, '[]'::jsonb))
  FROM recipe_extraction_queue q
  LEFT JOIN recipe_image_mapping rim ON rim.filename = q.filename 
    AND rim.recipe_order = CASE 
      WHEN q.extraction_position IN ('left', 'full_page') THEN 1 
      WHEN q.extraction_position = 'right' THEN 2 
      ELSE 1 
    END
  LEFT JOIN recipes r ON r.id = rim.recipe_id AND r.is_gold_standard = true
  WHERE q.book_id = p_book_id
    AND q.pass3_data IS NOT NULL
    AND q.status IN ('extracted', 'verified', 'needs_review');
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  RAISE NOTICE 'Archived % recipes to test_run_id %', v_archived_count, v_test_run_id;
  
  RETURN v_test_run_id;
END;
$$;


ALTER FUNCTION "public"."archive_extraction_results"("p_book_id" "uuid", "p_test_run_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."are_mutual_followers"("user_id_1" "uuid", "user_id_2" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM follows 
    WHERE follower_id = user_id_1 AND following_id = user_id_2
  ) AND EXISTS (
    SELECT 1 FROM follows 
    WHERE follower_id = user_id_2 AND following_id = user_id_1
  );
END;
$$;


ALTER FUNCTION "public"."are_mutual_followers"("user_id_1" "uuid", "user_id_2" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_next_suggested_date"("p_last_purchased" "date", "p_frequency" "text", "p_frequency_days" integer DEFAULT NULL::integer) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF p_last_purchased IS NULL THEN
    RETURN CURRENT_DATE;
  END IF;
  
  RETURN CASE p_frequency
    WHEN 'weekly' THEN p_last_purchased + INTERVAL '7 days'
    WHEN 'biweekly' THEN p_last_purchased + INTERVAL '14 days'
    WHEN 'monthly' THEN p_last_purchased + INTERVAL '1 month'
    WHEN 'custom' THEN p_last_purchased + (p_frequency_days || ' days')::INTERVAL
    ELSE p_last_purchased
  END;
END;
$$;


ALTER FUNCTION "public"."calculate_next_suggested_date"("p_last_purchased" "date", "p_frequency" "text", "p_frequency_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_next_suggested_date"("p_last_purchased" "date", "p_frequency" "text", "p_frequency_days" integer) IS 'Calculate next purchase date based on frequency';



CREATE OR REPLACE FUNCTION "public"."calculate_recipe_cost"("recipe_uuid" "uuid") RETURNS TABLE("recipe_id" "uuid", "total_cost" numeric, "cost_per_serving" numeric, "ingredient_count" integer, "missing_prices" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  recipe_servings INTEGER;
  total_recipe_cost DECIMAL(10,2) := 0;
  ingredient_total INTEGER := 0;
  missing_price_count INTEGER := 0;
BEGIN
  -- Get recipe servings
  SELECT servings INTO recipe_servings
  FROM recipes
  WHERE id = recipe_uuid;
  
  -- If recipe not found, return nulls
  IF recipe_servings IS NULL THEN
    RETURN QUERY SELECT 
      recipe_uuid,
      NULL::DECIMAL(10,2),
      NULL::DECIMAL(10,2),
      0,
      0;
    RETURN;
  END IF;
  
  -- Calculate total cost from ingredients
  SELECT 
    COALESCE(SUM(
      -- Use average of min/max if range exists, otherwise just min
      CASE 
        WHEN i.estimated_cost_max_per_100g IS NOT NULL 
        THEN ((i.estimated_cost_per_100g + i.estimated_cost_max_per_100g) / 2)
        ELSE i.estimated_cost_per_100g
      END 
      * 
      -- Convert ingredient quantity to 100g units
      CASE 
        WHEN ri.quantity_amount IS NOT NULL AND ri.quantity_unit IS NOT NULL
        THEN (ri.quantity_amount / 100.0)  -- Simplified - assumes grams for now
        ELSE 1  -- Default multiplier if no quantity info
      END
    ), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE i.estimated_cost_per_100g IS NULL)
  INTO total_recipe_cost, ingredient_total, missing_price_count
  FROM recipe_ingredients ri
  LEFT JOIN ingredients i ON ri.ingredient_id = i.id
  WHERE ri.recipe_id = recipe_uuid;
  
  -- Return results
  RETURN QUERY SELECT 
    recipe_uuid,
    total_recipe_cost,
    CASE 
      WHEN recipe_servings > 0 
      THEN ROUND(total_recipe_cost / recipe_servings, 2)
      ELSE NULL
    END AS cost_per_serving,
    ingredient_total,
    missing_price_count;
END;
$$;


ALTER FUNCTION "public"."calculate_recipe_cost"("recipe_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_recipe_cost"("recipe_uuid" "uuid") IS 'Calculates total cost and cost per serving for a recipe';



CREATE OR REPLACE FUNCTION "public"."can_add_dish_to_meal"("p_meal_id" "uuid", "p_user_id" "uuid", "p_dish_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("can_add" boolean, "reason" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_meal_status TEXT;
  v_meal_created_at TIMESTAMP WITH TIME ZONE;
  v_is_participant BOOLEAN;
  v_participant_status TEXT;
  v_dish_already_in_meal BOOLEAN;
  v_dish_in_other_meal BOOLEAN;
BEGIN
  -- Get meal info
  SELECT meal_status, created_at 
  INTO v_meal_status, v_meal_created_at
  FROM posts 
  WHERE id = p_meal_id AND post_type = 'meal';
  
  -- Meal doesn't exist
  IF v_meal_status IS NULL THEN
    RETURN QUERY SELECT false, 'Meal not found';
    RETURN;
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM meal_participants 
    WHERE meal_id = p_meal_id AND user_id = p_user_id
  ), rsvp_status
  INTO v_is_participant, v_participant_status
  FROM meal_participants 
  WHERE meal_id = p_meal_id AND user_id = p_user_id;
  
  IF NOT COALESCE(v_is_participant, false) THEN
    RETURN QUERY SELECT false, 'User is not a participant in this meal';
    RETURN;
  END IF;
  
  -- Check participant status
  IF v_participant_status NOT IN ('accepted', 'maybe') THEN
    RETURN QUERY SELECT false, 'User must accept or maybe the meal invitation first';
    RETURN;
  END IF;
  
  -- Check 1-month limit for completed meals
  IF v_meal_status = 'completed' AND v_meal_created_at < NOW() - INTERVAL '1 month' THEN
    RETURN QUERY SELECT false, 'Cannot add dishes to meals older than 1 month';
    RETURN;
  END IF;
  
  -- If dish_id provided, check if it's already in this meal or another meal
  IF p_dish_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM dish_courses WHERE dish_id = p_dish_id AND meal_id = p_meal_id
    ) INTO v_dish_already_in_meal;
    
    IF v_dish_already_in_meal THEN
      RETURN QUERY SELECT false, 'Dish is already in this meal';
      RETURN;
    END IF;
    
    SELECT EXISTS (
      SELECT 1 FROM dish_courses WHERE dish_id = p_dish_id AND meal_id != p_meal_id
    ) INTO v_dish_in_other_meal;
    
    IF v_dish_in_other_meal THEN
      RETURN QUERY SELECT false, 'Dish is already part of another meal';
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT true, 'OK';
END;
$$;


ALTER FUNCTION "public"."can_add_dish_to_meal"("p_meal_id" "uuid", "p_user_id" "uuid", "p_dish_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_add_dish_to_meal"("p_meal_id" "uuid", "p_user_id" "uuid", "p_dish_id" "uuid") IS 'Validates if a user can add a dish to a meal';



CREATE OR REPLACE FUNCTION "public"."can_edit_meal"("p_meal_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_host BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM meal_participants 
    WHERE meal_id = p_meal_id 
      AND user_id = p_user_id 
      AND role = 'host'
  ) INTO v_is_host;
  
  RETURN v_is_host;
END;
$$;


ALTER FUNCTION "public"."can_edit_meal"("p_meal_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_edit_meal"("p_meal_id" "uuid", "p_user_id" "uuid") IS 'Check if user can edit a meal (must be host)';



CREATE OR REPLACE FUNCTION "public"."create_default_home_space"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_space_id UUID;
BEGIN
  -- Create the Home space
  INSERT INTO spaces (name, emoji, created_by, is_default)
  VALUES ('Home', '🏠', p_user_id, true)
  RETURNING id INTO v_space_id;
  
  -- Add user as owner
  INSERT INTO space_members (space_id, user_id, role, status, joined_at)
  VALUES (v_space_id, p_user_id, 'owner', 'accepted', NOW());
  
  -- Create default settings
  INSERT INTO space_settings (space_id)
  VALUES (v_space_id);
  
  -- Set as active space
  INSERT INTO user_active_space (user_id, active_space_id)
  VALUES (p_user_id, v_space_id)
  ON CONFLICT (user_id) DO UPDATE SET active_space_id = v_space_id;
  
  RETURN v_space_id;
END;
$$;


ALTER FUNCTION "public"."create_default_home_space"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_default_home_space"("p_user_id" "uuid") IS 'Creates a default Home space for a new user with owner membership and default settings';



CREATE OR REPLACE FUNCTION "public"."create_default_pantry_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_pantry_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_pantry_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estimate_ingredient_grams"("p_quantity_amount" numeric, "p_quantity_unit" "text", "p_ingredient_id" "uuid", "p_original_text" "text" DEFAULT NULL::"text", "p_embedded_grams" numeric DEFAULT NULL::numeric, "p_embedded_ml" numeric DEFAULT NULL::numeric) RETURNS TABLE("grams" numeric, "confidence" numeric, "conversion_method" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_unit TEXT;
  v_g_per_cup NUMERIC;
  v_g_per_tbsp NUMERIC;
  v_g_per_tsp NUMERIC;
  v_g_per_whole NUMERIC;
  v_weight_small NUMERIC;
  v_weight_medium NUMERIC;
  v_weight_large NUMERIC;
  v_density NUMERIC;  -- g per ml, derived from g_per_cup
BEGIN

  -- ── Priority 1: Embedded grams from chef ──
  IF p_embedded_grams IS NOT NULL AND p_embedded_grams > 0 THEN
    RETURN QUERY SELECT
      ROUND(p_embedded_grams, 1),
      0.95::NUMERIC,
      'embedded_grams'::TEXT;
    RETURN;
  END IF;

  -- ── Priority 1b: Embedded ml (assume density ≈ 1.0) ──
  IF p_embedded_ml IS NOT NULL AND p_embedded_ml > 0 THEN
    RETURN QUERY SELECT
      ROUND(p_embedded_ml, 1),
      0.85::NUMERIC,
      'embedded_ml'::TEXT;
    RETURN;
  END IF;

  -- If no quantity, can't calculate
  IF p_quantity_amount IS NULL OR p_quantity_amount = 0 THEN
    RETURN QUERY SELECT NULL::NUMERIC, 0::NUMERIC, 'none'::TEXT;
    RETURN;
  END IF;

  -- Normalize the unit to lowercase, trim
  v_unit := lower(trim(COALESCE(p_quantity_unit, '')));

  -- ── Priority 2: Weight units (direct math) ──
  IF v_unit IN ('g', 'gram', 'grams') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount, 1),
      0.95::NUMERIC,
      'weight_g'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('kg', 'kilogram', 'kilograms') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 1000, 1),
      0.95::NUMERIC,
      'weight_kg'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('oz', 'ounce', 'ounces') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 28.3495, 1),
      0.90::NUMERIC,
      'weight_oz'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('lb', 'lbs', 'pound', 'pounds') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 453.592, 1),
      0.90::NUMERIC,
      'weight_lb'::TEXT;
    RETURN;
  END IF;

  -- Load ingredient reference data (if we have an ingredient)
  IF p_ingredient_id IS NOT NULL THEN
    SELECT
      i.g_per_cup, i.g_per_tbsp, i.g_per_tsp, i.g_per_whole,
      i.typical_weight_small_g, i.typical_weight_medium_g, i.typical_weight_large_g
    INTO
      v_g_per_cup, v_g_per_tbsp, v_g_per_tsp, v_g_per_whole,
      v_weight_small, v_weight_medium, v_weight_large
    FROM ingredients i
    WHERE i.id = p_ingredient_id;
  END IF;

  -- ── Priority 3: Volume units ──

  -- Cup
  IF v_unit IN ('cup', 'cups') THEN
    IF v_g_per_cup IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_cup, 1),
        0.80::NUMERIC,
        'volume_cup'::TEXT;
      RETURN;
    ELSE
      -- Water density fallback: 1 cup ≈ 237ml ≈ 237g
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 236.6, 1),
        0.50::NUMERIC,
        'volume_cup_water_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Tablespoon
  IF v_unit IN ('tbsp', 'tablespoon', 'tablespoons') THEN
    IF v_g_per_tbsp IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_tbsp, 1),
        0.80::NUMERIC,
        'volume_tbsp'::TEXT;
      RETURN;
    ELSIF v_g_per_cup IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_cup / 16.0, 1),
        0.75::NUMERIC,
        'volume_tbsp_derived'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 14.8, 1),
        0.50::NUMERIC,
        'volume_tbsp_water_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Teaspoon
  IF v_unit IN ('tsp', 'teaspoon', 'teaspoons') THEN
    IF v_g_per_tsp IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_tsp, 1),
        0.80::NUMERIC,
        'volume_tsp'::TEXT;
      RETURN;
    ELSIF v_g_per_cup IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_cup / 48.0, 1),
        0.75::NUMERIC,
        'volume_tsp_derived'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 4.9, 1),
        0.50::NUMERIC,
        'volume_tsp_water_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Quart
  IF v_unit IN ('qt', 'quart', 'quarts') THEN
    IF v_g_per_cup IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_cup * 4.0, 1),
        0.75::NUMERIC,
        'volume_qt_derived'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 946.4, 1),
        0.50::NUMERIC,
        'volume_qt_water_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ml
  IF v_unit IN ('ml', 'milliliter', 'milliliters') THEN
    IF v_g_per_cup IS NOT NULL THEN
      v_density := v_g_per_cup / 236.588;
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_density, 1),
        0.75::NUMERIC,
        'volume_ml_density'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount, 1),
        0.50::NUMERIC,
        'volume_ml_water_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- fl oz
  IF v_unit IN ('fl oz', 'fluid ounce', 'fluid ounces') THEN
    IF v_g_per_cup IS NOT NULL THEN
      v_density := v_g_per_cup / 236.588;
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 29.574 * v_density, 1),
        0.75::NUMERIC,
        'volume_floz_density'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 29.574, 1),
        0.50::NUMERIC,
        'volume_floz_water_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Priority 4: Container units ──
  -- Pattern: "15-ounce can", "28-ounce can", etc.
  -- Extract oz from the unit string
  IF v_unit LIKE '%ounce%can%' OR v_unit LIKE '%oz%can%' THEN
    DECLARE
      v_container_oz NUMERIC;
    BEGIN
      -- Extract number from strings like "15-ounce can", "14.5-ounce can"
      v_container_oz := (regexp_match(v_unit, '([0-9]+\.?[0-9]*)'))[1]::NUMERIC;
      IF v_container_oz IS NOT NULL THEN
        RETURN QUERY SELECT
          ROUND(p_quantity_amount * v_container_oz * 28.3495, 1),
          0.75::NUMERIC,
          'container_oz'::TEXT;
        RETURN;
      END IF;
    END;
  END IF;

  IF v_unit IN ('can', 'cans') THEN
    -- Default can: 400g (common 14-15oz can)
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 400, 1),
      0.40::NUMERIC,
      'container_can_default'::TEXT;
    RETURN;
  END IF;

  -- ── Priority 5: Size-based (small/medium/large) ──
  IF v_unit IN ('small') THEN
    IF v_weight_small IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_small, 1),
        0.60::NUMERIC,
        'size_small'::TEXT;
      RETURN;
    ELSIF v_weight_medium IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_medium * 0.7, 1),
        0.50::NUMERIC,
        'size_small_estimated'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_unit IN ('medium') THEN
    IF v_weight_medium IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_medium, 1),
        0.60::NUMERIC,
        'size_medium'::TEXT;
      RETURN;
    ELSIF v_g_per_whole IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_whole, 1),
        0.55::NUMERIC,
        'size_medium_from_whole'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_unit IN ('large', 'extra-large', 'jumbo') THEN
    IF v_weight_large IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_large, 1),
        0.60::NUMERIC,
        'size_large'::TEXT;
      RETURN;
    ELSIF v_weight_medium IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_medium * 1.3, 1),
        0.50::NUMERIC,
        'size_large_estimated'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Priority 6: Descriptive units ──
  IF v_unit IN ('clove', 'cloves') THEN
    IF v_g_per_whole IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_whole, 1),
        0.55::NUMERIC,
        'descriptive_clove'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 3.0, 1),
        0.40::NUMERIC,
        'descriptive_clove_default'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_unit IN ('bunch', 'bunches', 'medium bunch') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 100.0, 1),
      0.40::NUMERIC,
      'descriptive_bunch'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('sprig', 'sprigs') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 2.0, 1),
      0.40::NUMERIC,
      'descriptive_sprig'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('stalk', 'stalks') THEN
    IF v_g_per_whole IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_whole, 1),
        0.55::NUMERIC,
        'descriptive_stalk'::TEXT;
      RETURN;
    ELSE
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * 40.0, 1),
        0.40::NUMERIC,
        'descriptive_stalk_default'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_unit IN ('head', 'heads') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 600.0, 1),
      0.35::NUMERIC,
      'descriptive_head'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('slice', 'slices') THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 20.0, 1),
      0.35::NUMERIC,
      'descriptive_slice'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('inch') THEN
    -- Typically ginger: 1 inch ≈ 10g
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 10.0, 1),
      0.35::NUMERIC,
      'descriptive_inch'::TEXT;
    RETURN;
  END IF;

  IF v_unit IN ('piece', 'pieces') THEN
    IF v_g_per_whole IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_whole, 1),
        0.50::NUMERIC,
        'descriptive_piece'::TEXT;
      RETURN;
    ELSIF v_weight_medium IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_medium, 1),
        0.45::NUMERIC,
        'descriptive_piece_from_medium'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Priority 7: Uncountable ──
  IF v_unit IN ('pinch', 'dash', 'to taste', '') AND p_quantity_amount <= 1 THEN
    RETURN QUERY SELECT
      ROUND(p_quantity_amount * 0.5, 1),
      0.20::NUMERIC,
      'uncountable'::TEXT;
    RETURN;
  END IF;

  -- ── Priority 8: Count (empty/whole unit — countable items) ──
  IF v_unit IN ('', 'whole') THEN
    IF v_g_per_whole IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_g_per_whole, 1),
        0.65::NUMERIC,
        'count_whole'::TEXT;
      RETURN;
    ELSIF v_weight_medium IS NOT NULL THEN
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_medium, 1),
        0.60::NUMERIC,
        'count_medium'::TEXT;
      RETURN;
    ELSIF v_weight_large IS NOT NULL THEN
      -- For items like eggs where "large" is default
      RETURN QUERY SELECT
        ROUND(p_quantity_amount * v_weight_large, 1),
        0.55::NUMERIC,
        'count_large_fallback'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── Fallback: No conversion possible ──
  RETURN QUERY SELECT NULL::NUMERIC, 0::NUMERIC, 'none'::TEXT;
  RETURN;

END;
$$;


ALTER FUNCTION "public"."estimate_ingredient_grams"("p_quantity_amount" numeric, "p_quantity_unit" "text", "p_ingredient_id" "uuid", "p_original_text" "text", "p_embedded_grams" numeric, "p_embedded_ml" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."estimate_ingredient_grams"("p_quantity_amount" numeric, "p_quantity_unit" "text", "p_ingredient_id" "uuid", "p_original_text" "text", "p_embedded_grams" numeric, "p_embedded_ml" numeric) IS 'Converts quantity + unit + ingredient reference data → estimated grams. Priority: embedded_grams > weight_units > volume × density > container > size > descriptive > count. Returns (grams, confidence 0.0–1.0, conversion_method). Pure calculation — reads from ingredients table for density/weight data.';



CREATE OR REPLACE FUNCTION "public"."expand_storage_synonyms"("p_token" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN CASE LOWER(p_token)
    WHEN 'frozen'        THEN ARRAY['frozen', 'freezer']
    WHEN 'freezer'       THEN ARRAY['freezer', 'frozen']
    WHEN 'fridge'        THEN ARRAY['fridge', 'refrigerated', 'cold']
    WHEN 'refrigerated'  THEN ARRAY['refrigerated', 'fridge', 'cold']
    WHEN 'cold'          THEN ARRAY['cold', 'fridge', 'refrigerated']
    WHEN 'shelf'         THEN ARRAY['shelf', 'pantry', 'cupboard']
    WHEN 'cupboard'      THEN ARRAY['cupboard', 'pantry', 'shelf']
    WHEN 'pantry'        THEN ARRAY['pantry', 'shelf', 'cupboard']
    WHEN 'counter'       THEN ARRAY['counter', 'room', 'temp']
    ELSE ARRAY[p_token]
  END;
END;
$$;


ALTER FUNCTION "public"."expand_storage_synonyms"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_book_pages_text"("p_book_id" "uuid", "p_start_page" integer, "p_end_page" integer) RETURNS TABLE("page_number" integer, "page_type" "text", "title_text" "text", "body_text" "text", "has_ingredients_list" boolean, "has_photo" boolean, "photo_description" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bps.page_number,
    bps.page_type,
    bps.title_text,
    bps.body_text,
    bps.has_ingredients_list,
    bps.has_photo,
    bps.photo_description
  FROM book_page_scans bps
  WHERE bps.book_id = p_book_id
    AND bps.page_number >= p_start_page
    AND bps.page_number <= p_end_page
  ORDER BY bps.page_number;
END;
$$;


ALTER FUNCTION "public"."get_book_pages_text"("p_book_id" "uuid", "p_start_page" integer, "p_end_page" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_improvement_opportunities"() RETURNS TABLE("issue_type" "text", "occurrence_count" bigint, "avg_accuracy_impact" numeric, "example_recipes" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH issue_analysis AS (
    SELECT 
      UNNEST(critical_errors || warnings) as issue,
      overall_accuracy,
      gold_standard_recipe_id
    FROM recipe_extraction_comparison
  )
  SELECT 
    CASE 
      WHEN issue LIKE '%ingredient%' THEN 'Ingredient Issues'
      WHEN issue LIKE '%instruction%' THEN 'Instruction Issues'
      WHEN issue LIKE '%fraction%' THEN 'Fraction Issues'
      WHEN issue LIKE '%paraphras%' THEN 'Paraphrasing Issues'
      WHEN issue LIKE '%count%' THEN 'Count Issues'
      ELSE 'Other Issues'
    END as issue_type,
    COUNT(*)::BIGINT as occurrence_count,
    ROUND(AVG(overall_accuracy), 3) as avg_accuracy_impact,
    ARRAY_AGG(DISTINCT r.title)::TEXT[] as example_recipes
  FROM issue_analysis ia
  JOIN recipes r ON r.id = ia.gold_standard_recipe_id
  GROUP BY issue_type
  ORDER BY occurrence_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_improvement_opportunities"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_improvement_opportunities"() IS 'Identify common failure patterns to prioritize prompt improvements';



CREATE OR REPLACE FUNCTION "public"."get_meal_dishes"("p_meal_id" "uuid") RETURNS TABLE("dish_id" "uuid", "dish_title" "text", "dish_user_id" "uuid", "dish_rating" numeric, "dish_photos" "jsonb", "dish_created_at" timestamp with time zone, "recipe_id" "uuid", "recipe_title" "text", "recipe_image_url" "text", "course_type" "text", "is_main_dish" boolean, "course_order" integer, "contributor_username" "text", "contributor_display_name" "text", "contributor_avatar_url" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as dish_id,
    d.title as dish_title,
    d.user_id as dish_user_id,
    d.rating as dish_rating,
    d.photos as dish_photos,
    d.created_at as dish_created_at,
    d.recipe_id,
    r.title as recipe_title,
    r.image_url as recipe_image_url,
    dc.course_type,
    dc.is_main_dish,
    dc.course_order,
    up.username as contributor_username,
    up.display_name as contributor_display_name,
    up.avatar_url as contributor_avatar_url
  FROM dish_courses dc
  JOIN posts d ON d.id = dc.dish_id
  LEFT JOIN recipes r ON r.id = d.recipe_id
  LEFT JOIN user_profiles up ON up.id = d.user_id
  WHERE dc.meal_id = p_meal_id
  ORDER BY 
    CASE dc.course_type
      WHEN 'appetizer' THEN 1
      WHEN 'main' THEN 2
      WHEN 'side' THEN 3
      WHEN 'dessert' THEN 4
      WHEN 'drink' THEN 5
      WHEN 'other' THEN 6
    END,
    dc.is_main_dish DESC,
    dc.course_order,
    d.created_at;
END;
$$;


ALTER FUNCTION "public"."get_meal_dishes"("p_meal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meal_participants"("p_meal_id" "uuid") RETURNS TABLE("participant_id" "uuid", "user_id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "subscription_tier" "text", "role" "text", "rsvp_status" "text", "dish_count" bigint, "invited_at" timestamp with time zone, "responded_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    RETURN QUERY
    SELECT
      mp.id as participant_id,
      mp.user_id,
      up.username,
      up.display_name,
      up.avatar_url,
      up.subscription_tier,
      mp.role,
      mp.rsvp_status,
      (
        SELECT COUNT(*)
        FROM dish_courses dc
        JOIN posts d ON d.id = dc.dish_id
        WHERE dc.meal_id = p_meal_id
          AND d.user_id = mp.user_id
      ) as dish_count,
      mp.invited_at,
      mp.responded_at
    FROM meal_participants mp
    JOIN user_profiles up ON up.id = mp.user_id
    WHERE mp.meal_id = p_meal_id
    ORDER BY
      mp.role = 'host' DESC,
      mp.rsvp_status = 'accepted' DESC,
      mp.invited_at;
  END;
  $$;


ALTER FUNCTION "public"."get_meal_participants"("p_meal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meal_plan_items"("p_meal_id" "uuid") RETURNS TABLE("id" "uuid", "meal_id" "uuid", "course_type" "text", "placeholder_name" "text", "is_main_dish" boolean, "claimed_by" "uuid", "claimed_at" timestamp with time zone, "claimer_username" "text", "claimer_display_name" "text", "claimer_avatar_url" "text", "recipe_id" "uuid", "recipe_title" "text", "recipe_image_url" "text", "dish_id" "uuid", "dish_title" "text", "dish_rating" numeric, "completed_at" timestamp with time zone, "created_at" timestamp with time zone, "created_by" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    mdp.id,
    mdp.meal_id,
    mdp.course_type,
    mdp.placeholder_name,
    mdp.is_main_dish,
    mdp.claimed_by,
    mdp.claimed_at,
    claimer.username as claimer_username,
    claimer.display_name as claimer_display_name,
    claimer.avatar_url as claimer_avatar_url,
    mdp.recipe_id,
    r.title as recipe_title,
    r.image_url as recipe_image_url,
    mdp.dish_id,
    dish.title as dish_title,
    dish.rating as dish_rating,
    mdp.completed_at,
    mdp.created_at,
    mdp.created_by
  FROM meal_dish_plans mdp
  LEFT JOIN user_profiles claimer ON claimer.id = mdp.claimed_by
  LEFT JOIN recipes r ON r.id = mdp.recipe_id
  LEFT JOIN posts dish ON dish.id = mdp.dish_id
  WHERE mdp.meal_id = p_meal_id
  ORDER BY 
    CASE mdp.course_type
      WHEN 'appetizer' THEN 1
      WHEN 'main' THEN 2
      WHEN 'side' THEN 3
      WHEN 'dessert' THEN 4
      WHEN 'drink' THEN 5
      ELSE 6
    END,
    mdp.is_main_dish DESC,
    mdp.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_meal_plan_items"("p_meal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meal_plan_summary"("p_meal_id" "uuid") RETURNS TABLE("total_items" bigint, "claimed_items" bigint, "unclaimed_items" bigint, "with_recipe" bigint, "completed" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_items,
    COUNT(*) FILTER (WHERE claimed_by IS NOT NULL)::BIGINT as claimed_items,
    COUNT(*) FILTER (WHERE claimed_by IS NULL AND dish_id IS NULL)::BIGINT as unclaimed_items,
    COUNT(*) FILTER (WHERE recipe_id IS NOT NULL)::BIGINT as with_recipe,
    COUNT(*) FILTER (WHERE dish_id IS NOT NULL)::BIGINT as completed
  FROM meal_dish_plans
  WHERE meal_id = p_meal_id;
END;
$$;


ALTER FUNCTION "public"."get_meal_plan_summary"("p_meal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recipe_instructions_with_sections"("p_recipe_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'section_id', s.id,
      'section_title', s.section_title,
      'section_description', s.section_description,
      'section_order', s.section_order,
      'estimated_time_min', s.estimated_time_min,
      'steps', (
        SELECT json_agg(
          json_build_object(
            'step_id', st.id,
            'step_number', st.step_number,
            'instruction', st.instruction,
            'is_optional', st.is_optional,
            'is_time_sensitive', st.is_time_sensitive
          ) ORDER BY st.step_number
        )
        FROM instruction_steps st
        WHERE st.section_id = s.id
      )
    ) ORDER BY s.section_order
  ) INTO result
  FROM instruction_sections s
  WHERE s.recipe_id = p_recipe_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_recipe_instructions_with_sections"("p_recipe_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recipe_with_annotations"("p_recipe_id" "uuid", "p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'recipe', row_to_json(r.*),
    'annotations', (
      SELECT json_agg(row_to_json(a.*))
      FROM recipe_annotations a
      WHERE a.recipe_id = p_recipe_id 
        AND a.user_id = p_user_id
    ),
    'preferences', (
      SELECT row_to_json(p.*)
      FROM user_recipe_preferences p
      WHERE p.recipe_id = p_recipe_id 
        AND p.user_id = p_user_id
      LIMIT 1
    )
  ) INTO result
  FROM recipes r
  WHERE r.id = p_recipe_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_recipe_with_annotations"("p_recipe_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recipe_with_ingredients"("p_recipe_id" "uuid") RETURNS TABLE("recipe_title" "text", "ingredient_name" "text", "original_text" "text", "quantity_amount" numeric, "quantity_unit" "text", "preparation" "text", "sequence_order" integer, "match_confidence" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    r.title,
    i.name,
    ri.original_text,
    ri.quantity_amount,
    ri.quantity_unit,
    ri.preparation,
    ri.sequence_order,
    ri.match_confidence
  FROM recipe_ingredients ri
  JOIN recipes r ON r.id = ri.recipe_id
  LEFT JOIN ingredients i ON i.id = ri.ingredient_id
  WHERE ri.recipe_id = p_recipe_id
  ORDER BY ri.sequence_order;
$$;


ALTER FUNCTION "public"."get_recipe_with_ingredients"("p_recipe_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_related_posts"("p_post_id" "uuid") RETURNS TABLE("related_post_id" "uuid", "relationship_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN pr.post_id_1 = p_post_id THEN pr.post_id_2
      ELSE pr.post_id_1
    END as related_post_id,
    pr.relationship_type
  FROM post_relationships pr
  WHERE pr.post_id_1 = p_post_id OR pr.post_id_2 = p_post_id;
END;
$$;


ALTER FUNCTION "public"."get_related_posts"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_recent_meals"("p_user_id" "uuid", "p_limit" integer DEFAULT 10) RETURNS TABLE("meal_id" "uuid", "title" "text", "meal_status" "text", "meal_time" timestamp with time zone, "dish_count" bigint, "participant_count" bigint, "created_at" timestamp with time zone, "user_role" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as meal_id,
    m.title,
    m.meal_status,
    m.meal_time,
    (SELECT COUNT(*) FROM dish_courses dc WHERE dc.meal_id = m.id) as dish_count,
    (SELECT COUNT(*) FROM meal_participants mp WHERE mp.meal_id = m.id AND mp.rsvp_status = 'accepted') as participant_count,
    m.created_at,
    mp.role as user_role
  FROM posts m
  JOIN meal_participants mp ON mp.meal_id = m.id AND mp.user_id = p_user_id
  WHERE m.post_type = 'meal'
    AND mp.rsvp_status IN ('accepted', 'maybe')
    AND (
      m.meal_status = 'planning'
      OR (m.meal_status = 'completed' AND m.created_at > NOW() - INTERVAL '1 month')
    )
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_user_recent_meals"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_recent_meals"("p_user_id" "uuid", "p_limit" integer) IS 'Get meals user can add dishes to (planning or completed < 1 month)';



CREATE OR REPLACE FUNCTION "public"."get_user_space_ids"("p_user_id" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT space_id FROM space_members 
  WHERE user_id = p_user_id AND status = 'accepted';
$$;


ALTER FUNCTION "public"."get_user_space_ids"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, username, display_name)
  VALUES (
    new.id,
    new.email,
    new.email,
    split_part(new.email, '@', 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(user_profiles.username, EXCLUDED.username),
    display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_followers_count"("user_id" "uuid", "increment_by" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_profiles
  SET followers_count = GREATEST(0, followers_count + increment_by)
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."increment_followers_count"("user_id" "uuid", "increment_by" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_following_count"("user_id" "uuid", "increment_by" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_profiles
  SET following_count = GREATEST(0, following_count + increment_by)
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."increment_following_count"("user_id" "uuid", "increment_by" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_reference_fulfilled"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE recipe_references
  SET is_fulfilled = TRUE
  WHERE referenced_recipe_id = NEW.id
    AND is_fulfilled = FALSE;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_reference_fulfilled"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_recipe_nutrition"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recipe_nutrition_computed;
END;
$$;


ALTER FUNCTION "public"."refresh_recipe_nutrition"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_recipe_nutrition"() IS 'Refreshes the cached nutrition data. Safe to call anytime — uses CONCURRENTLY so the view stays readable during refresh. Call after changing ingredients, recipe_ingredients, or nutrition reference data.';



CREATE OR REPLACE FUNCTION "public"."search_ingredients"("query_text" "text") RETURNS TABLE("id" "uuid", "name" "text", "plural_name" "text", "family" "text", "ingredient_type" "text", "typical_unit" "text", "typical_store_section" "text", "score" real)
    LANGUAGE "sql" STABLE
    AS $$
  WITH q AS (
    SELECT LOWER(TRIM(query_text)) AS qt
  )
  SELECT
    i.id,
    i.name,
    i.plural_name,
    i.family,
    i.ingredient_type,
    i.typical_unit,
    i.typical_store_section,
    GREATEST(
      -- Tier 1: exact match (case-insensitive)
      CASE 
        WHEN LOWER(i.name) = (SELECT qt FROM q) THEN 2.0
        WHEN LOWER(COALESCE(i.plural_name, '')) = (SELECT qt FROM q) THEN 2.0
        ELSE 0.0
      END,
      -- Tier 2: substring starts at position 0 (case-insensitive)
      CASE 
        WHEN LOWER(i.name) LIKE (SELECT qt FROM q) || '%' THEN 1.5
        WHEN LOWER(COALESCE(i.plural_name, '')) LIKE (SELECT qt FROM q) || '%' THEN 1.5
        ELSE 0.0
      END,
      -- Tier 4: substring anywhere (case-insensitive ILIKE; outranks prefix-only via score 1.0 vs 0.95)
      CASE 
        WHEN i.name ILIKE '%' || (SELECT qt FROM q) || '%' THEN 1.0
        WHEN i.plural_name ILIKE '%' || (SELECT qt FROM q) || '%' THEN 1.0
        ELSE 0.0
      END,
      -- Tier 3: prefix match — query is a prefix of ingredient name
      -- (covers "cori" → "Coriander" before similarity threshold kicks in;
      -- score 0.95 so true-substring hits at Tier 4 still win)
      CASE 
        WHEN LOWER(i.name) LIKE (SELECT qt FROM q) || '%' 
          AND LENGTH((SELECT qt FROM q)) >= 3 THEN 0.95
        WHEN LOWER(COALESCE(i.plural_name, '')) LIKE (SELECT qt FROM q) || '%' 
          AND LENGTH((SELECT qt FROM q)) >= 3 THEN 0.95
        ELSE 0.0
      END,
      -- Tier 5: trigram similarity (fallback for typos and longer-query fuzzy)
      similarity(i.name, query_text),
      similarity(COALESCE(i.plural_name, ''), query_text)
    ) AS score
  FROM ingredients i
  WHERE
    i.name ILIKE '%' || query_text || '%'
    OR i.plural_name ILIKE '%' || query_text || '%'
    OR similarity(i.name, query_text) > 0.25
    OR similarity(COALESCE(i.plural_name, ''), query_text) > 0.25
  ORDER BY 
    score DESC, 
    LENGTH(i.name) ASC,
    i.name ASC
  LIMIT 20;
$$;


ALTER FUNCTION "public"."search_ingredients"("query_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_ingredients"("query_text" "text") IS 'Phase 8C-Shared-CP2b.1. Tiered fuzzy ingredient autocomplete: exact (2.0) > substring-starts-with (1.5) > substring-anywhere (1.0) > prefix-3char-min (0.95) > similarity (0.25-1.0). Tiebreak by name length ASC then name ASC. Top 20. Used by GroceryListDetailScreen add-item sheet.';



CREATE OR REPLACE FUNCTION "public"."search_supplies"("query_text" "text", "p_space_id" "uuid") RETURNS TABLE("supply_id" "uuid", "rank" real, "match_count" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  tokens TEXT[];
  expanded_tokens TEXT[] := ARRAY[]::TEXT[];
  raw_token TEXT;
  expanded_synonyms TEXT[];
  ts_query_str TEXT;
BEGIN
  tokens := regexp_split_to_array(LOWER(TRIM(query_text)), '\s+');
  tokens := ARRAY(SELECT t FROM unnest(tokens) AS t WHERE t <> '');

  IF array_length(tokens, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR raw_token IN SELECT unnest(tokens)
  LOOP
    expanded_synonyms := expand_storage_synonyms(raw_token);
    -- Append :* prefix wildcard to each synonym so partial-word matches fire.
    -- E.g. 'oliv' becomes 'oliv:*' which matches tsvector lexemes 'olive', 'olives', etc.
    expanded_tokens := array_append(
      expanded_tokens,
      '(' || array_to_string(
        ARRAY(SELECT t || ':*' FROM unnest(expanded_synonyms) AS t),
        ' | '
      ) || ')'
    );
  END LOOP;

  ts_query_str := array_to_string(expanded_tokens, ' & ');

  RETURN QUERY
  WITH all_candidate_supplies AS (
    -- Pre-filter: supplies in the space, NOT archived.
    -- We compute the combined vector for ALL active supplies and let
    -- the tsquery @@ filter do the AND check. At F&F scale (hundreds
    -- of supplies per space), this is fine without further pre-filter.
    SELECT
      s.id AS s_id,
      (
        s.search_vector ||
        COALESCE(
          (SELECT setweight(to_tsvector('simple',
                  string_agg(
                    COALESCE(sl.variant_label, '') || ' ' ||
                    COALESCE(sl.brand, '')         || ' ' ||
                    COALESCE(sl.notes, '')         || ' ' ||
                    COALESCE(sl.storage_location, ''),
                    ' '
                  )), 'A')
           FROM supply_lots sl
           WHERE sl.supply_id = s.id AND sl.consumed_at IS NULL),
          ''::tsvector
        )
      ) AS combined_vector
    FROM supplies s
    WHERE s.space_id = p_space_id
      AND s.archived_at IS NULL
  )
  SELECT
    acs.s_id AS supply_id,
    ts_rank(acs.combined_vector, to_tsquery('simple', ts_query_str))::REAL AS rank,
    1 AS match_count
  FROM all_candidate_supplies acs
  WHERE acs.combined_vector @@ to_tsquery('simple', ts_query_str)
  ORDER BY ts_rank(acs.combined_vector, to_tsquery('simple', ts_query_str)) DESC;
END;
$$;


ALTER FUNCTION "public"."search_supplies"("query_text" "text", "p_space_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_supplies"("query_text" "text", "p_space_id" "uuid") IS 'D8R-Q56-Q57. Multi-token AND search across supply + lot dimensions, with storage synonym expansion. Fix #3 2026-05-13: removed restrictive pre-filter CTE; tsquery @@ on combined vector handles the AND check directly. Solves the multi-token AND case where some tokens match supply vector and others match lot vectors.';



CREATE OR REPLACE FUNCTION "public"."seed_default_views"("target_space_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_short_id UUID;
  v_medium_id UUID;
  v_long_id UUID;
  v_in_cart_id UUID;
BEGIN
  -- Skip if defaults already exist for this space
  IF EXISTS (SELECT 1 FROM views WHERE space_id = target_space_id AND is_default = true) THEN
    RETURN;
  END IF;

  -- Short List (urgency=today)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Short List', '🌙', true, 'aisle', 1)
  RETURNING id INTO v_short_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_short_id, 'urgency', ARRAY['today']);

  -- Medium List (urgency=this-week)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Medium List', '📅', true, 'aisle', 2)
  RETURNING id INTO v_medium_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_medium_id, 'urgency', ARRAY['this-week']);

  -- Long List (status=need, no urgency)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Long List', '📋', true, 'aisle', 3)
  RETURNING id INTO v_long_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_long_id, 'status', ARRAY['need']);

  -- In Cart (status=in_cart)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'In Cart', '🛒', true, 'flat', 4)
  RETURNING id INTO v_in_cart_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_in_cart_id, 'status', ARRAY['in_cart']);
END;
$$;


ALTER FUNCTION "public"."seed_default_views"("target_space_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."seed_default_views"("target_space_id" "uuid") IS '8R-UX6: creates the 4 default views for a space with the canonical UI names (Short / Medium / Long List + In Cart). Idempotent.';



CREATE OR REPLACE FUNCTION "public"."set_supply_lots_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_supply_lots_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_compute_search_vector"("p_supply_id" "uuid") RETURNS "tsvector"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  result TSVECTOR;
BEGIN
  SELECT
    setweight(to_tsvector('simple', COALESCE(s.custom_name, '')),                    'A') ||
    setweight(to_tsvector('simple', COALESCE(i.name, '')),                            'A') ||
    setweight(to_tsvector('simple', COALESCE(i.plural_name, '')),                    'A') ||
    setweight(to_tsvector('simple', COALESCE(i.family, '')),                          'B') ||
    setweight(to_tsvector('simple', COALESCE(i.ingredient_type, '')),                 'B') ||
    setweight(to_tsvector('simple',
      COALESCE(
        (SELECT string_agg(t.value, ' ')
         FROM supply_tags st
         JOIN tags t ON t.id = st.tag_id
         WHERE st.supply_id = s.id),
        '')),                                                                        'C')
  INTO result
  FROM supplies s
  LEFT JOIN ingredients i ON i.id = s.ingredient_id
  WHERE s.id = p_supply_id;

  RETURN COALESCE(result, ''::tsvector);
END;
$$;


ALTER FUNCTION "public"."supplies_compute_search_vector"("p_supply_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_refresh_on_ingredient_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (NEW.name IS DISTINCT FROM OLD.name OR
      NEW.plural_name IS DISTINCT FROM OLD.plural_name OR
      NEW.family IS DISTINCT FROM OLD.family OR
      NEW.ingredient_type IS DISTINCT FROM OLD.ingredient_type) THEN
    UPDATE supplies
    SET search_vector = supplies_compute_search_vector(id)
    WHERE ingredient_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."supplies_refresh_on_ingredient_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_refresh_on_supply_tag_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  affected_supply UUID;
BEGIN
  affected_supply := COALESCE(NEW.supply_id, OLD.supply_id);
  IF affected_supply IS NOT NULL THEN
    UPDATE supplies
    SET search_vector = supplies_compute_search_vector(id)
    WHERE id = affected_supply;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."supplies_refresh_on_supply_tag_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_search_vector_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result TSVECTOR;
BEGIN
  SELECT
    setweight(to_tsvector('simple', COALESCE(NEW.custom_name, '')),               'A') ||
    setweight(to_tsvector('simple', COALESCE(i.name, '')),                         'A') ||
    setweight(to_tsvector('simple', COALESCE(i.plural_name, '')),                 'A') ||
    setweight(to_tsvector('simple', COALESCE(i.family, '')),                       'B') ||
    setweight(to_tsvector('simple', COALESCE(i.ingredient_type, '')),              'B') ||
    setweight(to_tsvector('simple',
      COALESCE(
        (SELECT string_agg(t.value, ' ')
         FROM supply_tags st
         JOIN tags t ON t.id = st.tag_id
         WHERE st.supply_id = NEW.id),
        '')),                                                                     'C')
  INTO result
  FROM (SELECT 1) dummy
  LEFT JOIN ingredients i ON i.id = NEW.ingredient_id;

  NEW.search_vector := COALESCE(result, ''::tsvector);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."supplies_search_vector_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supply_lots_compute_search_vector"("p_variant_label" "text", "p_brand" "text", "p_notes" "text", "p_storage_location" "text") RETURNS "tsvector"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN
    setweight(to_tsvector('simple', COALESCE(p_variant_label, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(p_brand, '')),         'A') ||
    setweight(to_tsvector('simple', COALESCE(p_notes, '')),         'B') ||
    setweight(to_tsvector('simple', COALESCE(p_storage_location, '')), 'C');
END;
$$;


ALTER FUNCTION "public"."supply_lots_compute_search_vector"("p_variant_label" "text", "p_brand" "text", "p_notes" "text", "p_storage_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supply_lots_search_vector_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector := supply_lots_compute_search_vector(
    NEW.variant_label,
    NEW.brand,
    NEW.notes,
    NEW.storage_location
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."supply_lots_search_vector_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_books_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_books_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expiration_on_opened"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If item was just marked as opened
  IF NEW.is_opened = true AND OLD.is_opened = false THEN
    -- Set opened_date to today if not provided
    IF NEW.opened_date IS NULL THEN
      NEW.opened_date := CURRENT_DATE;
    END IF;
    
    -- Note: Expiration recalculation should be done in application code
    -- because it requires ingredient data (shelf_life_days_fridge_opened, etc.)
    -- This trigger just ensures opened_date is set
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_expiration_on_opened"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_follow_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_profiles SET followers_count = followers_count + 1 
    WHERE id = NEW.following_id;
    UPDATE user_profiles SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_profiles SET followers_count = followers_count - 1 
    WHERE id = OLD.following_id;
    UPDATE user_profiles SET following_count = following_count - 1 
    WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_follow_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_meal_dish_plans_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_meal_dish_plans_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_next_suggested_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If last_purchased or frequency changed, recalculate next date
  IF (NEW.last_purchased IS DISTINCT FROM OLD.last_purchased)
     OR (NEW.purchase_frequency IS DISTINCT FROM OLD.purchase_frequency)
     OR (NEW.frequency_days IS DISTINCT FROM OLD.frequency_days)
  THEN
    NEW.next_suggested_date := calculate_next_suggested_date(
      NEW.last_purchased,
      NEW.purchase_frequency,
      NEW.frequency_days
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_next_suggested_date"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_next_suggested_date"() IS 'Trigger to auto-calculate next_suggested_date';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_books_recipe_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_books 
    SET recipe_count = recipe_count + 1 
    WHERE user_id = NEW.user_id AND book_id = NEW.book_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_books 
    SET recipe_count = recipe_count - 1 
    WHERE user_id = OLD.user_id AND book_id = OLD.book_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_user_books_recipe_count"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_grocery_list_items_pre_cp2a_snapshot" (
    "id" "uuid",
    "user_id" "uuid",
    "ingredient_id" "uuid",
    "quantity_display" numeric,
    "unit_display" "text",
    "store_section" "text",
    "priority" "text",
    "added_from" "text",
    "recipe_id" "uuid",
    "source_pantry_item_id" "uuid",
    "is_in_cart" boolean,
    "checked_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "list_id" "uuid",
    "brand_preference" "text",
    "size_preference" "text",
    "priority_reason" "text",
    "custom_name" "text"
);


ALTER TABLE "public"."_grocery_list_items_pre_cp2a_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_grocery_lists_pre_cp3_snapshot" (
    "id" "uuid",
    "user_id" "uuid",
    "name" "text",
    "emoji" "text",
    "is_active" boolean,
    "is_template" boolean,
    "sort_order" integer,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "store_name" "text"
);


ALTER TABLE "public"."_grocery_lists_pre_cp3_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_ingredients_pre_cp1b_snapshot" (
    "id" "uuid",
    "typical_store_section" "text"
);


ALTER TABLE "public"."_ingredients_pre_cp1b_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_extraction_comparison" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_item_id" "uuid",
    "gold_standard_recipe_id" "uuid",
    "overall_accuracy" numeric,
    "title_score" numeric,
    "ingredients_score" numeric,
    "instructions_score" numeric,
    "structure_score" numeric,
    "title_weight" numeric DEFAULT 0.10,
    "ingredients_weight" numeric DEFAULT 0.50,
    "instructions_weight" numeric DEFAULT 0.30,
    "structure_weight" numeric DEFAULT 0.10,
    "ingredient_matches" "jsonb",
    "instruction_matches" "jsonb",
    "total_ingredients_extracted" integer,
    "total_ingredients_gold_standard" integer,
    "exact_ingredient_matches" integer,
    "semantic_ingredient_matches" integer,
    "partial_ingredient_matches" integer,
    "missing_ingredients" integer,
    "extra_ingredients" integer,
    "total_instructions_extracted" integer,
    "total_instructions_gold_standard" integer,
    "exact_instruction_matches" integer,
    "paraphrased_instructions" integer,
    "missing_instructions" integer,
    "extra_instructions" integer,
    "critical_errors" "text"[],
    "warnings" "text"[],
    "recommendations" "text"[],
    "recommended_action" "text",
    "comparison_model" "text",
    "comparison_version" "text" DEFAULT 'v2_pass4'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description_score" numeric,
    "notes_score" numeric,
    "cross_references_score" numeric,
    "description_matches" boolean DEFAULT false,
    "notes_in_gold" boolean DEFAULT false,
    "notes_extracted" boolean DEFAULT false,
    "cross_refs_in_gold" boolean DEFAULT false,
    "cross_refs_extracted" boolean DEFAULT false,
    CONSTRAINT "recipe_extraction_comparison_recommended_action_check" CHECK (("recommended_action" = ANY (ARRAY['accept'::"text", 'review'::"text", 'reject'::"text"]))),
    CONSTRAINT "valid_accuracy" CHECK ((("overall_accuracy" >= (0)::numeric) AND ("overall_accuracy" <= (1)::numeric))),
    CONSTRAINT "valid_scores" CHECK (((("title_score" >= (0)::numeric) AND ("title_score" <= (1)::numeric)) AND (("ingredients_score" >= (0)::numeric) AND ("ingredients_score" <= (1)::numeric)) AND (("instructions_score" >= (0)::numeric) AND ("instructions_score" <= (1)::numeric)) AND (("structure_score" >= (0)::numeric) AND ("structure_score" <= (1)::numeric))))
);


ALTER TABLE "public"."recipe_extraction_comparison" OWNER TO "postgres";


COMMENT ON TABLE "public"."recipe_extraction_comparison" IS 'Detailed comparison results when extracted recipes are compared against gold standards';



COMMENT ON COLUMN "public"."recipe_extraction_comparison"."overall_accuracy" IS 'Weighted overall accuracy score (0-1)';



COMMENT ON COLUMN "public"."recipe_extraction_comparison"."ingredient_matches" IS 'Array of objects with per-ingredient comparison details';



COMMENT ON COLUMN "public"."recipe_extraction_comparison"."instruction_matches" IS 'Array of objects with per-instruction comparison details';



COMMENT ON COLUMN "public"."recipe_extraction_comparison"."recommended_action" IS 'accept (>=0.95), review (0.85-0.94), reject (<0.85)';



CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "parent_recipe_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "ingredients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "instructions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "prep_time_min" integer,
    "cook_time_min" integer,
    "servings" integer DEFAULT 4,
    "meal_type" "text"[],
    "dietary_tags" "text"[],
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source_author" "text",
    "source_name" "text",
    "source_type" "text",
    "chef_id" "uuid",
    "image_url" "text",
    "recipe_type" "text",
    "inactive_time_min" integer DEFAULT 0,
    "difficulty_level" "text" DEFAULT 'medium'::"text",
    "easier_than_looks" boolean DEFAULT false,
    "cooking_methods" "text"[] DEFAULT '{}'::"text"[],
    "cuisine_types" "text"[] DEFAULT '{}'::"text"[],
    "make_ahead_friendly" boolean DEFAULT false,
    "book_id" "uuid",
    "page_number" integer,
    "chef_difficulty_label" "text",
    "chef_difficulty_level" "text",
    "ai_difficulty_level" "text",
    "ai_difficulty_score" numeric,
    "ai_difficulty_factors" "jsonb",
    "raw_extraction_data" "jsonb",
    "default_course" "text" DEFAULT 'main'::"text",
    "is_gold_standard" boolean DEFAULT false,
    "gold_standard_verified_by" "uuid",
    "gold_standard_verified_at" timestamp with time zone,
    "gold_standard_notes" "text",
    "recipe_notes" "text",
    "cross_references" "jsonb",
    "photo_page" integer,
    "supplementary_content" "jsonb" DEFAULT '{}'::"jsonb",
    "recipe_tags" "jsonb" DEFAULT '{}'::"jsonb",
    "extraction_confidence" "text",
    "extraction_uncertainties" "jsonb" DEFAULT '[]'::"jsonb",
    "hero_ingredients" "text"[] DEFAULT '{}'::"text"[],
    "vibe_tags" "text"[] DEFAULT '{}'::"text"[],
    "serving_temp" "text",
    "course_type" "text",
    "make_ahead_score" integer,
    "cooking_concept" "text",
    "instruction_sections" "jsonb",
    "times_cooked" integer DEFAULT 0,
    "source_url" "text",
    "external_source_id" "text",
    "source_domain" "text",
    "source_byline" "text",
    "source_credit" "text",
    "source_published_at" timestamp with time zone,
    "source_updated_at" timestamp with time zone,
    "source_extracted_at" timestamp with time zone,
    "source_authors" "text"[],
    CONSTRAINT "check_difficulty_level" CHECK (("difficulty_level" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "recipes_ai_difficulty_level_check" CHECK (("ai_difficulty_level" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "recipes_ai_difficulty_score_check" CHECK ((("ai_difficulty_score" >= (0)::numeric) AND ("ai_difficulty_score" <= (100)::numeric))),
    CONSTRAINT "recipes_chef_difficulty_level_check" CHECK (("chef_difficulty_level" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "recipes_default_course_check" CHECK (("default_course" = ANY (ARRAY['appetizer'::"text", 'main'::"text", 'side'::"text", 'dessert'::"text", 'drink'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recipes"."inactive_time_min" IS 'Inactive time (resting, marinating, chilling)';



COMMENT ON COLUMN "public"."recipes"."difficulty_level" IS 'Recipe difficulty: easy, medium, or advanced';



COMMENT ON COLUMN "public"."recipes"."easier_than_looks" IS 'Appears fancy but is actually easy (Ottolenghi SIMPLE style)';



COMMENT ON COLUMN "public"."recipes"."cooking_methods" IS 'Array of cooking methods used';



COMMENT ON COLUMN "public"."recipes"."cuisine_types" IS 'Array of cuisine types (supports fusion)';



COMMENT ON COLUMN "public"."recipes"."chef_difficulty_label" IS 'Chef''s original difficulty label';



COMMENT ON COLUMN "public"."recipes"."ai_difficulty_level" IS 'AI''s objective difficulty assessment';



COMMENT ON COLUMN "public"."recipes"."ai_difficulty_factors" IS 'Breakdown of difficulty factors';



COMMENT ON COLUMN "public"."recipes"."raw_extraction_data" IS 'Stores raw extraction data including recipe notes, ingredient swaps, and other unparsed text. Format: {source_url, source_site, scraped_at, raw_text}';



COMMENT ON COLUMN "public"."recipes"."default_course" IS 'Default course category when adding to meal (can be overridden)';



COMMENT ON COLUMN "public"."recipes"."is_gold_standard" IS 'Marks recipes that have been manually verified as accurate for testing extraction accuracy';



COMMENT ON COLUMN "public"."recipes"."gold_standard_verified_by" IS 'User who verified this recipe as gold standard';



COMMENT ON COLUMN "public"."recipes"."gold_standard_verified_at" IS 'Timestamp when recipe was verified as gold standard';



COMMENT ON COLUMN "public"."recipes"."gold_standard_notes" IS 'Notes about the verification process or any caveats';



COMMENT ON COLUMN "public"."recipes"."recipe_tags" IS 'Flexible metadata: simple_icons, qr_codes, footnotes, vibe, etc.';



COMMENT ON COLUMN "public"."recipes"."extraction_confidence" IS 'Overall extraction confidence: high, medium, low';



COMMENT ON COLUMN "public"."recipes"."extraction_uncertainties" IS 'Array of specific uncertain items with field path, issue, and alternatives';



COMMENT ON COLUMN "public"."recipes"."cooking_concept" IS 'Dish type classification: pasta, soup, salad, curry, roast, composed_plate, etc. Single value. Populated by AI during extraction or backfill.';



CREATE OR REPLACE VIEW "public"."accuracy_by_recipe" AS
 SELECT "r"."id" AS "recipe_id",
    "r"."title",
    "r"."page_number",
    "count"("c"."id") AS "comparison_count",
    "avg"("c"."overall_accuracy") AS "avg_accuracy",
    "max"("c"."overall_accuracy") AS "best_accuracy",
    "min"("c"."overall_accuracy") AS "worst_accuracy",
    "stddev"("c"."overall_accuracy") AS "accuracy_stddev",
    "avg"("c"."ingredients_score") AS "avg_ingredient_accuracy",
    "avg"("c"."instructions_score") AS "avg_instruction_accuracy",
    "count"(*) FILTER (WHERE ("c"."recommended_action" = 'accept'::"text")) AS "accept_count",
    "count"(*) FILTER (WHERE ("c"."recommended_action" = 'review'::"text")) AS "review_count",
    "count"(*) FILTER (WHERE ("c"."recommended_action" = 'reject'::"text")) AS "reject_count"
   FROM ("public"."recipes" "r"
     JOIN "public"."recipe_extraction_comparison" "c" ON (("c"."gold_standard_recipe_id" = "r"."id")))
  WHERE ("r"."is_gold_standard" = true)
  GROUP BY "r"."id", "r"."title", "r"."page_number"
  ORDER BY "r"."page_number";


ALTER VIEW "public"."accuracy_by_recipe" OWNER TO "postgres";


COMMENT ON VIEW "public"."accuracy_by_recipe" IS 'Aggregate accuracy statistics for each gold standard recipe across multiple test runs';



CREATE TABLE IF NOT EXISTS "public"."book_assembly_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "chunk_number" integer NOT NULL,
    "start_page" integer NOT NULL,
    "end_page" integer NOT NULL,
    "overlap_pages" integer DEFAULT 5,
    "recipes_found" integer,
    "recipe_ids" "uuid"[],
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "processing_time_ms" integer,
    "cost_usd" numeric(10,6),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "book_assembly_runs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."book_assembly_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "page_number_start" integer,
    "page_number_end" integer,
    "filename" "text",
    "content_type" "text" NOT NULL,
    "section_name" "text",
    "title" "text",
    "content_text" "text",
    "content_structured" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "notes" "text",
    "extraction_method" "text",
    "image_files" "text"[],
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "verification_changes" "text",
    "extraction_confidence" "text",
    "extraction_uncertainties" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."book_content" OWNER TO "postgres";


COMMENT ON COLUMN "public"."book_content"."extraction_method" IS 'How content was extracted: manual, Opus 4.5 with prompt v1.0, etc.';



COMMENT ON COLUMN "public"."book_content"."image_files" IS 'Array of source image filenames for multi-page content';



COMMENT ON COLUMN "public"."book_content"."is_verified" IS 'Whether a human has reviewed this content';



COMMENT ON COLUMN "public"."book_content"."verified_at" IS 'When the content was verified';



COMMENT ON COLUMN "public"."book_content"."verification_changes" IS 'Description of any corrections made during verification';



COMMENT ON COLUMN "public"."book_content"."extraction_confidence" IS 'Overall extraction confidence: high, medium, low';



COMMENT ON COLUMN "public"."book_content"."extraction_uncertainties" IS 'Array of specific uncertain items with field path, issue, and alternatives';



CREATE OR REPLACE VIEW "public"."book_content_summary" AS
 SELECT "book_id",
    "content_type",
    "count"(*) AS "count",
    "min"("page_number_start") AS "first_page",
    "max"(COALESCE("page_number_end", "page_number_start")) AS "last_page"
   FROM "public"."book_content"
  GROUP BY "book_id", "content_type"
  ORDER BY "book_id", ("min"("page_number_start"));


ALTER VIEW "public"."book_content_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_page_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "queue_item_id" "uuid",
    "page_number" integer,
    "page_side" "text",
    "filename" "text",
    "page_type" "text",
    "title_text" "text",
    "title_confidence" numeric(3,2),
    "body_text" "text",
    "intro_paragraph" "text",
    "has_ingredients_list" boolean DEFAULT false,
    "has_numbered_steps" boolean DEFAULT false,
    "has_section_header" boolean DEFAULT false,
    "section_header_text" "text",
    "estimated_word_count" integer,
    "has_photo" boolean DEFAULT false,
    "photo_description" "text",
    "photo_covers_full_page" boolean DEFAULT false,
    "photo_likely_recipe" "text",
    "scan_version" "text" DEFAULT 'v1'::"text",
    "processing_time_ms" integer,
    "cost_usd" numeric(10,6),
    "confidence_score" numeric(3,2),
    "raw_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "book_page_scans_page_side_check" CHECK (("page_side" = ANY (ARRAY['left'::"text", 'right'::"text"]))),
    CONSTRAINT "book_page_scans_page_type_check" CHECK (("page_type" = ANY (ARRAY['recipe_start'::"text", 'recipe_continuation'::"text", 'photo_only'::"text", 'photo_with_text'::"text", 'section_intro'::"text", 'toc'::"text", 'index'::"text", 'blank'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."book_page_scans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."book_recipe_assembly" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "recipe_title" "text" NOT NULL,
    "recipe_slug" "text",
    "start_page" integer,
    "end_page" integer,
    "page_scan_ids" "uuid"[],
    "description" "text",
    "servings" "text",
    "servings_number" integer,
    "prep_time_min" integer,
    "cook_time_min" integer,
    "total_time_min" integer,
    "ingredients" "jsonb",
    "instructions" "jsonb",
    "section_name" "text",
    "cuisine_types" "text"[],
    "dietary_tags" "text"[],
    "cooking_methods" "text"[],
    "photo_page_numbers" integer[],
    "primary_photo_page" integer,
    "cross_references" "jsonb",
    "notes" "text",
    "assembly_chunk" integer,
    "validated_by_overlap" boolean DEFAULT false,
    "assembly_confidence" numeric(3,2),
    "assembly_version" "text" DEFAULT 'v1'::"text",
    "status" "text" DEFAULT 'assembled'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "book_recipe_assembly_status_check" CHECK (("status" = ANY (ARRAY['assembled'::"text", 'validated'::"text", 'conflict'::"text", 'needs_review'::"text", 'approved'::"text", 'imported'::"text"])))
);


ALTER TABLE "public"."book_recipe_assembly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text",
    "isbn" "text",
    "isbn13" "text",
    "publisher" "text",
    "publication_year" integer,
    "cover_image_url" "text",
    "total_pages" integer,
    "is_verified" boolean DEFAULT false,
    "verification_source" "text",
    "style_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "chef_id" "uuid",
    "toc_data" "jsonb",
    "toc_image_path" "text",
    "toc_extracted_at" timestamp with time zone,
    CONSTRAINT "books_verification_source_check" CHECK (("verification_source" = ANY (ARRAY['isbn_api'::"text", 'manual_review'::"text", 'user_submitted'::"text"])))
);


ALTER TABLE "public"."books" OWNER TO "postgres";


COMMENT ON TABLE "public"."books" IS 'Normalized storage for cookbooks and recipe sources';



COMMENT ON COLUMN "public"."books"."style_metadata" IS 'Visual style data for future themed rendering';



CREATE TABLE IF NOT EXISTS "public"."chefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "bio" "text",
    "website" "text",
    "instagram" "text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "youtube" "text",
    "tiktok" "text",
    "twitter" "text",
    "substack" "text",
    "image_url" "text",
    "specialty" "text"[],
    "chef_type" "text"
);


ALTER TABLE "public"."chefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cooking_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "timer_history" "jsonb" DEFAULT '[]'::"jsonb",
    "steps_completed" integer DEFAULT 0,
    "total_steps" integer,
    "view_mode" "text" DEFAULT 'step_by_step'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cooking_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dish_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dish_id" "uuid" NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "course_type" "text" NOT NULL,
    "is_main_dish" boolean DEFAULT false NOT NULL,
    "course_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dish_courses_course_type_check" CHECK (("course_type" = ANY (ARRAY['appetizer'::"text", 'main'::"text", 'side'::"text", 'dessert'::"text", 'drink'::"text", 'other'::"text"]))),
    CONSTRAINT "main_dish_only_for_main_or_side" CHECK (((("is_main_dish" = true) AND ("course_type" = ANY (ARRAY['main'::"text", 'side'::"text"]))) OR ("is_main_dish" = false)))
);


ALTER TABLE "public"."dish_courses" OWNER TO "postgres";


COMMENT ON TABLE "public"."dish_courses" IS 'Categorizes dishes within meals (appetizer, main, side, dessert, drink)';



COMMENT ON COLUMN "public"."dish_courses"."is_main_dish" IS 'Distinguishes main dishes from side dishes for sorting';



COMMENT ON COLUMN "public"."dish_courses"."course_order" IS 'Custom ordering within course category';



CREATE TABLE IF NOT EXISTS "public"."eater_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "rater_user_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eater_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."eater_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_extraction_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid",
    "image_url" "text" NOT NULL,
    "filename" "text",
    "processing_order" integer,
    "status" "text" DEFAULT 'pending'::"text",
    "extracted_data" "jsonb",
    "detected_page_number" integer,
    "is_continuation" boolean DEFAULT false,
    "continues_from_queue_id" "uuid",
    "spread_contains" "text"[],
    "detected_image_bounds" "jsonb",
    "extracted_image_url" "text",
    "merged_into_recipe_id" "uuid",
    "error_message" "text",
    "processing_time_ms" integer,
    "cost_usd" numeric,
    "confidence_score" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "saved_at" timestamp with time zone,
    "has_page_discrepancy" boolean DEFAULT false,
    "scan_status" "text" DEFAULT 'pending'::"text",
    "scan_processed_at" timestamp with time zone,
    "test_results" "jsonb",
    "test_results_run1" "jsonb",
    "test_results_run2" "jsonb",
    "test_results_run3" "jsonb",
    "test_results_run4" "jsonb",
    "pass1_data" "jsonb",
    "pass2_data" "jsonb",
    "pass3_data" "jsonb",
    "pass4_data" "jsonb",
    "pass1_cost_usd" numeric,
    "pass2_cost_usd" numeric,
    "pass3_cost_usd" numeric,
    "pass4_cost_usd" numeric,
    "pass1_time_ms" integer,
    "pass2_time_ms" integer,
    "pass3_time_ms" integer,
    "pass4_time_ms" integer,
    "pass1_model" "text",
    "pass2_model" "text",
    "pass3_model" "text",
    "pass4_model" "text",
    "extraction_version" "text" DEFAULT 'v2_4pass'::"text",
    "pass0_data" "jsonb",
    "pass0_cost_usd" numeric,
    "pass0_time_ms" integer,
    "pass0_model" "text",
    "extraction_position" "text" DEFAULT 'full_page'::"text",
    "detected_features" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "recipe_extraction_queue_scan_status_check" CHECK (("scan_status" = ANY (ARRAY['pending'::"text", 'scanned'::"text", 'error'::"text"]))),
    CONSTRAINT "recipe_extraction_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'extracted'::"text", 'verified'::"text", 'error'::"text", 'needs_review'::"text"]))),
    CONSTRAINT "valid_extraction_position" CHECK (("extraction_position" = ANY (ARRAY['left'::"text", 'right'::"text", 'full_page'::"text", 'continuation'::"text"])))
);


ALTER TABLE "public"."recipe_extraction_queue" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recipe_extraction_queue"."pass1_data" IS 'First independent extraction (full JSON output)';



COMMENT ON COLUMN "public"."recipe_extraction_queue"."pass2_data" IS 'Second independent extraction (full JSON output)';



COMMENT ON COLUMN "public"."recipe_extraction_queue"."pass3_data" IS 'Reconciled extraction combining Pass 1 & 2';



COMMENT ON COLUMN "public"."recipe_extraction_queue"."pass4_data" IS 'Gold standard comparison results (optional, testing only)';



COMMENT ON COLUMN "public"."recipe_extraction_queue"."extraction_version" IS 'Version of extraction function used (e.g., v2_4pass)';



COMMENT ON COLUMN "public"."recipe_extraction_queue"."extraction_position" IS 'Position of recipe on page: left, right, full_page, continuation';



COMMENT ON COLUMN "public"."recipe_extraction_queue"."detected_features" IS 'Pass 0 detected features: has_simple_icons, has_qr_code, has_footnotes, has_spin_it, sub_recipe_count, etc.';



CREATE OR REPLACE VIEW "public"."extraction_accuracy_summary" AS
 SELECT "c"."id",
    "q"."filename",
    "r"."title" AS "gold_standard_title",
    "c"."overall_accuracy",
    "c"."title_score",
    "c"."ingredients_score",
    "c"."instructions_score",
    "c"."recommended_action",
    "array_length"("c"."critical_errors", 1) AS "critical_error_count",
    "array_length"("c"."warnings", 1) AS "warning_count",
    "c"."created_at"
   FROM (("public"."recipe_extraction_comparison" "c"
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."id" = "c"."queue_item_id")))
     JOIN "public"."recipes" "r" ON (("r"."id" = "c"."gold_standard_recipe_id")))
  ORDER BY "c"."overall_accuracy" DESC;


ALTER VIEW "public"."extraction_accuracy_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."extraction_accuracy_summary" IS 'Summary of extraction accuracy with recommendations';



CREATE TABLE IF NOT EXISTS "public"."recipe_image_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filename" "text" NOT NULL,
    "recipe_id" "uuid",
    "recipe_order" integer,
    "is_photo_only" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_image_mapping" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."extraction_comparison" AS
 WITH "extracted_recipes" AS (
         SELECT "q"."id" AS "queue_id",
            "q"."filename",
            "q"."extraction_position",
            "q"."extraction_version",
            "q"."status",
            "q"."processed_at",
            "q"."cost_usd",
            (("q"."pass3_data" -> 'recipe'::"text") ->> 'position'::"text") AS "extracted_position",
            ((("q"."pass3_data" -> 'recipe'::"text") -> 'title'::"text") ->> 'text'::"text") AS "extracted_title",
            (((("q"."pass3_data" -> 'recipe'::"text") -> 'page_number'::"text") ->> 'value'::"text"))::integer AS "extracted_page",
            ((("q"."pass3_data" -> 'recipe'::"text") -> 'servings'::"text") ->> 'text'::"text") AS "extracted_servings",
            (((("q"."pass3_data" -> 'recipe'::"text") -> 'servings'::"text") ->> 'number'::"text"))::integer AS "extracted_servings_num",
            ((("q"."pass3_data" -> 'recipe'::"text") -> 'description'::"text") ->> 'text'::"text") AS "extracted_description",
            ((("q"."pass3_data" -> 'recipe'::"text") -> 'notes'::"text") ->> 'text'::"text") AS "extracted_notes",
            ((("q"."pass3_data" -> 'recipe'::"text") ->> 'has_photo'::"text"))::boolean AS "extracted_has_photo",
            (("q"."pass3_data" -> 'recipe'::"text") ->> 'photo_location'::"text") AS "extracted_photo_location",
            (("q"."pass3_data" -> 'recipe'::"text") -> 'ingredients'::"text") AS "extracted_ingredients",
            (("q"."pass3_data" -> 'recipe'::"text") -> 'instructions'::"text") AS "extracted_instructions",
            (("q"."pass3_data" -> 'recipe'::"text") -> 'cross_references'::"text") AS "extracted_cross_refs",
            (("q"."pass3_data" -> 'recipe'::"text") ->> 'section_name'::"text") AS "extracted_section",
            ((("q"."pass3_data" -> 'reconciliation_summary'::"text") ->> 'fractions_verified'::"text"))::integer AS "fractions_verified",
            ((("q"."pass3_data" -> 'reconciliation_summary'::"text") ->> 'fractions_corrected'::"text"))::integer AS "fractions_corrected",
            ("q"."pass3_data" -> 'fraction_verification_checklist'::"text") AS "fraction_checklist",
            "rim"."recipe_id" AS "gold_standard_id"
           FROM ("public"."recipe_extraction_queue" "q"
             LEFT JOIN "public"."recipe_image_mapping" "rim" ON ((("rim"."filename" = "q"."filename") AND ("rim"."recipe_order" =
                CASE
                    WHEN ("q"."extraction_position" = ANY (ARRAY['left'::"text", 'full_page'::"text"])) THEN 1
                    WHEN ("q"."extraction_position" = 'right'::"text") THEN 2
                    ELSE 1
                END))))
          WHERE ("q"."pass3_data" IS NOT NULL)
        ), "gold_standards" AS (
         SELECT "r"."id" AS "recipe_id",
            "r"."title" AS "gold_title",
            "r"."page_number" AS "gold_page",
            "r"."servings" AS "gold_servings",
            "r"."description" AS "gold_description",
            "r"."is_gold_standard",
            "r"."gold_standard_notes",
            "r"."ingredients" AS "gold_ingredients",
            "r"."instructions" AS "gold_instructions",
            "r"."recipe_notes" AS "gold_recipe_notes",
            "r"."cross_references" AS "gold_cross_references",
            "r"."photo_page" AS "gold_photo_page",
            "r"."supplementary_content" AS "gold_supplementary_content"
           FROM "public"."recipes" "r"
          WHERE ("r"."is_gold_standard" = true)
        )
 SELECT "e"."queue_id",
    "e"."filename",
    "e"."extraction_position",
    "e"."extraction_version",
    "e"."status",
    "e"."processed_at",
    "e"."cost_usd",
    "e"."extracted_position",
    "e"."extracted_title",
    "e"."extracted_page",
    "e"."extracted_servings",
    "e"."extracted_servings_num",
    "e"."extracted_description",
    "e"."extracted_notes",
    "e"."extracted_has_photo",
    "e"."extracted_photo_location",
    "e"."extracted_ingredients",
    "e"."extracted_instructions",
    "e"."extracted_cross_refs",
    "e"."extracted_section",
    "e"."fractions_verified",
    "e"."fractions_corrected",
    "e"."fraction_checklist",
    "e"."gold_standard_id",
    "g"."gold_title",
    "g"."gold_page",
    "g"."gold_servings",
    "g"."gold_description",
    "g"."gold_ingredients",
    "g"."gold_instructions",
    "g"."gold_standard_notes",
    "g"."is_gold_standard",
    "g"."gold_recipe_notes",
    "g"."gold_cross_references",
    "g"."gold_photo_page",
    "g"."gold_supplementary_content"
   FROM ("extracted_recipes" "e"
     LEFT JOIN "gold_standards" "g" ON (("g"."recipe_id" = "e"."gold_standard_id")));


ALTER VIEW "public"."extraction_comparison" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."extraction_corrections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_id" "uuid",
    "recipe_id" "uuid",
    "field_path" "text" NOT NULL,
    "original_value" "text",
    "corrected_value" "text",
    "correction_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "extraction_corrections_correction_type_check" CHECK (("correction_type" = ANY (ARRAY['wrong'::"text", 'missing'::"text", 'extra'::"text", 'formatting'::"text", 'split'::"text", 'merge'::"text", 'continuation_error'::"text"])))
);


ALTER TABLE "public"."extraction_corrections" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."extraction_ingredient_comparison" AS
 SELECT "r"."title" AS "recipe_title",
    "r"."page_number",
    "q"."filename",
    'GOLD'::"text" AS "source",
    (("g_ing"."value" ->> 'sequence_order'::"text"))::integer AS "seq",
    ("g_ing"."value" ->> 'group_name'::"text") AS "group_name",
    ("g_ing"."value" ->> 'original_text'::"text") AS "ingredient_text",
    ("g_ing"."value" ->> 'quantity_amount'::"text") AS "qty",
    ("g_ing"."value" ->> 'quantity_unit'::"text") AS "unit",
    NULL::"text" AS "extraction_source",
    NULL::"text" AS "confidence",
    "q"."processed_at"
   FROM ((("public"."recipes" "r"
     JOIN "public"."recipe_image_mapping" "m" ON (("m"."recipe_id" = "r"."id")))
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."filename" = "m"."filename")))
     CROSS JOIN LATERAL "jsonb_array_elements"("r"."ingredients") "g_ing"("value"))
  WHERE (("r"."is_gold_standard" = true) AND ("m"."recipe_order" = 1))
UNION ALL
 SELECT "r"."title" AS "recipe_title",
    "r"."page_number",
    "q"."filename",
    'EXTRACTED'::"text" AS "source",
    (("e_ing"."value" ->> 'sequence_order'::"text"))::integer AS "seq",
    ("e_ing"."value" ->> 'group_name'::"text") AS "group_name",
    ("e_ing"."value" ->> 'original_text'::"text") AS "ingredient_text",
    ("e_ing"."value" ->> 'quantity_amount'::"text") AS "qty",
    ("e_ing"."value" ->> 'quantity_unit'::"text") AS "unit",
    ("e_ing"."value" ->> 'source'::"text") AS "extraction_source",
    ("e_ing"."value" ->> 'confidence'::"text") AS "confidence",
    "q"."processed_at"
   FROM ((("public"."recipes" "r"
     JOIN "public"."recipe_image_mapping" "m" ON (("m"."recipe_id" = "r"."id")))
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."filename" = "m"."filename")))
     CROSS JOIN LATERAL "jsonb_array_elements"(((("q"."pass3_data" -> 'recipes'::"text") -> 0) -> 'ingredients'::"text")) "e_ing"("value"))
  WHERE (("r"."is_gold_standard" = true) AND ("m"."recipe_order" = 1) AND ("q"."pass3_data" IS NOT NULL))
  ORDER BY 1, 4 DESC, 5;


ALTER VIEW "public"."extraction_ingredient_comparison" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."extraction_instruction_comparison" AS
 SELECT "r"."title" AS "recipe_title",
    "r"."page_number",
    "q"."filename",
    'GOLD'::"text" AS "source",
    (("g_step"."value" ->> 'step'::"text"))::integer AS "step_num",
    ("g_step"."value" ->> 'text'::"text") AS "instruction_text",
    "length"(("g_step"."value" ->> 'text'::"text")) AS "char_count",
    NULL::"text" AS "extraction_source",
    NULL::"text" AS "confidence",
    "q"."processed_at"
   FROM ((("public"."recipes" "r"
     JOIN "public"."recipe_image_mapping" "m" ON (("m"."recipe_id" = "r"."id")))
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."filename" = "m"."filename")))
     CROSS JOIN LATERAL "jsonb_array_elements"("r"."instructions") "g_step"("value"))
  WHERE (("r"."is_gold_standard" = true) AND ("m"."recipe_order" = 1))
UNION ALL
 SELECT "r"."title" AS "recipe_title",
    "r"."page_number",
    "q"."filename",
    'EXTRACTED'::"text" AS "source",
    (("e_step"."value" ->> 'step_number'::"text"))::integer AS "step_num",
    ("e_step"."value" ->> 'instruction'::"text") AS "instruction_text",
    "length"(("e_step"."value" ->> 'instruction'::"text")) AS "char_count",
    ("e_step"."value" ->> 'source'::"text") AS "extraction_source",
    ("e_step"."value" ->> 'confidence'::"text") AS "confidence",
    "q"."processed_at"
   FROM ((("public"."recipes" "r"
     JOIN "public"."recipe_image_mapping" "m" ON (("m"."recipe_id" = "r"."id")))
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."filename" = "m"."filename")))
     CROSS JOIN LATERAL "jsonb_array_elements"(((("q"."pass3_data" -> 'recipes'::"text") -> 0) -> 'instructions'::"text")) "e_step"("value"))
  WHERE (("r"."is_gold_standard" = true) AND ("m"."recipe_order" = 1) AND ("q"."pass3_data" IS NOT NULL))
  ORDER BY 1, 4 DESC, 5;


ALTER VIEW "public"."extraction_instruction_comparison" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."extraction_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "recipe_id" "uuid",
    "image_url" "text",
    "image_hash" "text",
    "extracted_data" "jsonb" NOT NULL,
    "user_corrections" "jsonb",
    "extraction_quality_rating" integer,
    "provider_used" "text" DEFAULT 'claude'::"text",
    "provider_model" "text" DEFAULT 'claude-sonnet-4-20250514'::"text",
    "processing_time_ms" integer,
    "cost_usd" numeric(10,6),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "extraction_logs_extraction_quality_rating_check" CHECK ((("extraction_quality_rating" >= 1) AND ("extraction_quality_rating" <= 5)))
);


ALTER TABLE "public"."extraction_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."extraction_logs" IS 'Track extraction quality for prompt improvement';



COMMENT ON COLUMN "public"."extraction_logs"."user_corrections" IS 'What user changed during review';



CREATE OR REPLACE VIEW "public"."extraction_statistics" AS
 SELECT "extraction_version",
    "count"(*) AS "total_extractions",
    "avg"((((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric) AS "avg_confidence",
    "avg"((("pass1_cost_usd" + "pass2_cost_usd") + COALESCE("pass3_cost_usd", (0)::numeric))) AS "avg_cost_usd",
    "avg"((("pass1_time_ms" + "pass2_time_ms") + COALESCE("pass3_time_ms", 0))) AS "avg_time_ms",
    "sum"((("pass1_cost_usd" + "pass2_cost_usd") + COALESCE("pass3_cost_usd", (0)::numeric))) AS "total_cost_usd",
    "count"(*) FILTER (WHERE ((((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric >= 0.95)) AS "high_confidence_count",
    "count"(*) FILTER (WHERE ((((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric < 0.8)) AS "low_confidence_count"
   FROM "public"."recipe_extraction_queue"
  WHERE ("pass3_data" IS NOT NULL)
  GROUP BY "extraction_version";


ALTER VIEW "public"."extraction_statistics" OWNER TO "postgres";


COMMENT ON VIEW "public"."extraction_statistics" IS 'Aggregate statistics by extraction version for performance tracking';



CREATE OR REPLACE VIEW "public"."extraction_summary" AS
 SELECT "r"."title" AS "recipe_title",
    "r"."page_number",
    "q"."filename",
    ( SELECT "count"(*) AS "count"
           FROM "jsonb_array_elements"("r"."ingredients") "jsonb_array_elements"("value")) AS "gold_ingredient_count",
    "jsonb_array_length"(((("q"."pass3_data" -> 'recipes'::"text") -> 0) -> 'ingredients'::"text")) AS "extracted_ingredient_count",
    ( SELECT "count"(*) AS "count"
           FROM "jsonb_array_elements"("r"."instructions") "jsonb_array_elements"("value")) AS "gold_instruction_count",
    "jsonb_array_length"(((("q"."pass3_data" -> 'recipes'::"text") -> 0) -> 'instructions'::"text")) AS "extracted_instruction_count",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM "jsonb_array_elements"("r"."ingredients") "jsonb_array_elements"("value")) = "jsonb_array_length"(((("q"."pass3_data" -> 'recipes'::"text") -> 0) -> 'ingredients'::"text"))) THEN '✓'::"text"
            ELSE '✗'::"text"
        END AS "ingredient_count_match",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM "jsonb_array_elements"("r"."instructions") "jsonb_array_elements"("value")) = "jsonb_array_length"(((("q"."pass3_data" -> 'recipes'::"text") -> 0) -> 'instructions'::"text"))) THEN '✓'::"text"
            ELSE '✗'::"text"
        END AS "instruction_count_match",
    "q"."confidence_score",
    "q"."cost_usd",
    "q"."processing_time_ms",
    "q"."processed_at"
   FROM (("public"."recipes" "r"
     JOIN "public"."recipe_image_mapping" "m" ON (("m"."recipe_id" = "r"."id")))
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."filename" = "m"."filename")))
  WHERE (("r"."is_gold_standard" = true) AND ("m"."recipe_order" = 1) AND ("q"."pass3_data" IS NOT NULL))
  ORDER BY "r"."page_number";


ALTER VIEW "public"."extraction_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_references" (
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."friend_references" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family" "text" NOT NULL,
    "ingredient_type" "text",
    "is_vegan" boolean,
    "is_vegetarian" boolean,
    "is_gluten_free" boolean,
    "is_dairy_free" boolean,
    "is_nut_free" boolean,
    "is_shellfish_free" boolean,
    "is_soy_free" boolean,
    "is_egg_free" boolean,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ingredient_category_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_common_units" (
    "ingredient_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "display_order" integer NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ingredient_common_units" OWNER TO "postgres";


COMMENT ON TABLE "public"."ingredient_common_units" IS 'Maps ingredients to their common units with display order';



CREATE TABLE IF NOT EXISTS "public"."ingredient_seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "region" "text" DEFAULT 'portland_or'::"text" NOT NULL,
    "seasonal_status" "text" DEFAULT 'local_seasonal'::"text" NOT NULL,
    "peak_start_month" smallint,
    "peak_end_month" smallint,
    "available_start_month" smallint,
    "available_end_month" smallint,
    "planting_start_month" smallint,
    "planting_end_month" smallint,
    "growing_start_month" smallint,
    "growing_end_month" smallint,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "confidence" "text" DEFAULT 'high'::"text" NOT NULL,
    "needs_review" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ingredient_seasons_available_end_month_check" CHECK ((("available_end_month" >= 1) AND ("available_end_month" <= 12))),
    CONSTRAINT "ingredient_seasons_available_start_month_check" CHECK ((("available_start_month" >= 1) AND ("available_start_month" <= 12))),
    CONSTRAINT "ingredient_seasons_confidence_check" CHECK (("confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "ingredient_seasons_growing_end_month_check" CHECK ((("growing_end_month" >= 1) AND ("growing_end_month" <= 12))),
    CONSTRAINT "ingredient_seasons_growing_start_month_check" CHECK ((("growing_start_month" >= 1) AND ("growing_start_month" <= 12))),
    CONSTRAINT "ingredient_seasons_peak_end_month_check" CHECK ((("peak_end_month" >= 1) AND ("peak_end_month" <= 12))),
    CONSTRAINT "ingredient_seasons_peak_start_month_check" CHECK ((("peak_start_month" >= 1) AND ("peak_start_month" <= 12))),
    CONSTRAINT "ingredient_seasons_planting_end_month_check" CHECK ((("planting_end_month" >= 1) AND ("planting_end_month" <= 12))),
    CONSTRAINT "ingredient_seasons_planting_start_month_check" CHECK ((("planting_start_month" >= 1) AND ("planting_start_month" <= 12))),
    CONSTRAINT "ingredient_seasons_seasonal_status_check" CHECK (("seasonal_status" = ANY (ARRAY['local_seasonal'::"text", 'local_year_round'::"text", 'imported'::"text", 'not_available'::"text"])))
);


ALTER TABLE "public"."ingredient_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_id" "uuid",
    "suggested_name" "text" NOT NULL,
    "suggested_plural" "text",
    "suggested_family" "text",
    "suggested_type" "text",
    "original_text" "text",
    "confidence" numeric,
    "status" "text" DEFAULT 'pending'::"text",
    "matched_ingredient_id" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ingredient_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'merged'::"text"])))
);


ALTER TABLE "public"."ingredient_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "plural_name" "text",
    "family" "text" NOT NULL,
    "calories_per_100g" integer,
    "protein_per_100g" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ingredient_type" "text",
    "ingredient_subtype" "text",
    "base_ingredient_id" "uuid",
    "form" "text",
    "typical_unit" "text",
    "typical_quantity" numeric,
    "typical_store_section" "text",
    "carbohydrates_per_100g" numeric,
    "fat_per_100g" numeric,
    "fiber_per_100g" numeric,
    "sugar_per_100g" numeric,
    "sodium_per_100g_mg" numeric,
    "estimated_cost_per_100g" numeric(10,2),
    "estimated_cost_max_per_100g" numeric(10,2),
    "last_price_update" timestamp with time zone DEFAULT "now"(),
    "typical_weight_small_g" numeric,
    "typical_weight_medium_g" numeric,
    "typical_weight_large_g" numeric,
    "default_storage_location" "text",
    "shelf_life_days_fridge" integer,
    "shelf_life_days_freezer" integer,
    "shelf_life_days_pantry" integer,
    "shelf_life_days_counter" integer,
    "requires_metric_conversion" boolean DEFAULT true,
    "shelf_life_days_fridge_opened" integer,
    "shelf_life_days_pantry_opened" integer,
    "is_base_ingredient" boolean DEFAULT false,
    "quick_add_priority" integer,
    "created_by" "text" DEFAULT 'manual'::"text",
    "nutrition_data_source" "text",
    "usda_fdc_id" "text",
    "g_per_cup" numeric,
    "g_per_tbsp" numeric,
    "g_per_tsp" numeric,
    "g_per_whole" numeric,
    "is_vegan" boolean,
    "is_vegetarian" boolean,
    "is_gluten_free" boolean,
    "is_dairy_free" boolean,
    "is_nut_free" boolean,
    "is_shellfish_free" boolean,
    "is_soy_free" boolean,
    "is_egg_free" boolean,
    "cooked_ratio" numeric,
    "vitamin_a_per_100g_mcg" numeric,
    "vitamin_c_per_100g_mg" numeric,
    "vitamin_d_per_100g_mcg" numeric,
    "vitamin_b12_per_100g_mcg" numeric,
    "folate_per_100g_mcg" numeric,
    "iron_per_100g_mg" numeric,
    "calcium_per_100g_mg" numeric,
    "potassium_per_100g_mg" numeric,
    "magnesium_per_100g_mg" numeric,
    "zinc_per_100g_mg" numeric,
    CONSTRAINT "ingredients_base_or_variant_not_both" CHECK ((NOT (("is_base_ingredient" = true) AND ("base_ingredient_id" IS NOT NULL)))),
    CONSTRAINT "ingredients_calcium_per_100g_mg_check" CHECK ((("calcium_per_100g_mg" IS NULL) OR ("calcium_per_100g_mg" >= (0)::numeric))),
    CONSTRAINT "ingredients_folate_per_100g_mcg_check" CHECK ((("folate_per_100g_mcg" IS NULL) OR ("folate_per_100g_mcg" >= (0)::numeric))),
    CONSTRAINT "ingredients_iron_per_100g_mg_check" CHECK ((("iron_per_100g_mg" IS NULL) OR ("iron_per_100g_mg" >= (0)::numeric))),
    CONSTRAINT "ingredients_magnesium_per_100g_mg_check" CHECK ((("magnesium_per_100g_mg" IS NULL) OR ("magnesium_per_100g_mg" >= (0)::numeric))),
    CONSTRAINT "ingredients_potassium_per_100g_mg_check" CHECK ((("potassium_per_100g_mg" IS NULL) OR ("potassium_per_100g_mg" >= (0)::numeric))),
    CONSTRAINT "ingredients_vitamin_a_per_100g_mcg_check" CHECK ((("vitamin_a_per_100g_mcg" IS NULL) OR ("vitamin_a_per_100g_mcg" >= (0)::numeric))),
    CONSTRAINT "ingredients_vitamin_b12_per_100g_mcg_check" CHECK ((("vitamin_b12_per_100g_mcg" IS NULL) OR ("vitamin_b12_per_100g_mcg" >= (0)::numeric))),
    CONSTRAINT "ingredients_vitamin_c_per_100g_mg_check" CHECK ((("vitamin_c_per_100g_mg" IS NULL) OR ("vitamin_c_per_100g_mg" >= (0)::numeric))),
    CONSTRAINT "ingredients_vitamin_d_per_100g_mcg_check" CHECK ((("vitamin_d_per_100g_mcg" IS NULL) OR ("vitamin_d_per_100g_mcg" >= (0)::numeric))),
    CONSTRAINT "ingredients_zinc_per_100g_mg_check" CHECK ((("zinc_per_100g_mg" IS NULL) OR ("zinc_per_100g_mg" >= (0)::numeric)))
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ingredients"."estimated_cost_per_100g" IS 'Estimated cost per 100g in USD (or min of range)';



COMMENT ON COLUMN "public"."ingredients"."estimated_cost_max_per_100g" IS 'Max cost per 100g for price ranges (nullable)';



COMMENT ON COLUMN "public"."ingredients"."typical_weight_small_g" IS 'Weight in grams for small size';



COMMENT ON COLUMN "public"."ingredients"."typical_weight_medium_g" IS 'Weight in grams for medium size (default for conversions)';



COMMENT ON COLUMN "public"."ingredients"."typical_weight_large_g" IS 'Weight in grams for large size';



COMMENT ON COLUMN "public"."ingredients"."default_storage_location" IS 'Typical storage: fridge, freezer, pantry, counter';



COMMENT ON COLUMN "public"."ingredients"."requires_metric_conversion" IS 'False for items like spices where metric tracking is not needed';



COMMENT ON COLUMN "public"."ingredients"."shelf_life_days_fridge_opened" IS 'Shelf life in days when opened and stored in fridge';



COMMENT ON COLUMN "public"."ingredients"."shelf_life_days_pantry_opened" IS 'Shelf life in days when opened and stored in pantry';



COMMENT ON COLUMN "public"."ingredients"."is_base_ingredient" IS 'TRUE if this is a base ingredient shown in quick-add (e.g., tomato, not cherry tomato)';



COMMENT ON COLUMN "public"."ingredients"."quick_add_priority" IS '1-10 ranking for quick-add display order, NULL = not in quick-add';



COMMENT ON COLUMN "public"."ingredients"."cooked_ratio" IS 'Multiplier for nutrition values when ingredient is typically used cooked/hydrated. E.g., rice raw = 365 cal/100g, cooked = 130 cal/100g → ratio = 0.36. NULL means no adjustment (ingredient used as-is). Applied in recipe_nutrition_computed view.';



COMMENT ON COLUMN "public"."ingredients"."vitamin_a_per_100g_mcg" IS 'Vitamin A, RAE (Retinol Activity Equivalents) per 100g, micrograms. USDA FDC nutrient 1106.';



COMMENT ON COLUMN "public"."ingredients"."vitamin_c_per_100g_mg" IS 'Vitamin C, total ascorbic acid per 100g, milligrams. USDA FDC nutrient 1162.';



COMMENT ON COLUMN "public"."ingredients"."vitamin_d_per_100g_mcg" IS 'Vitamin D (D2 + D3) per 100g, micrograms. USDA FDC nutrient 1114.';



COMMENT ON COLUMN "public"."ingredients"."vitamin_b12_per_100g_mcg" IS 'Vitamin B12 per 100g, micrograms. USDA FDC nutrient 1178.';



COMMENT ON COLUMN "public"."ingredients"."folate_per_100g_mcg" IS 'Folate, DFE (Dietary Folate Equivalents) per 100g, micrograms. USDA FDC nutrient 1190.';



COMMENT ON COLUMN "public"."ingredients"."iron_per_100g_mg" IS 'Iron, Fe per 100g, milligrams. USDA FDC nutrient 1089.';



COMMENT ON COLUMN "public"."ingredients"."calcium_per_100g_mg" IS 'Calcium, Ca per 100g, milligrams. USDA FDC nutrient 1087.';



COMMENT ON COLUMN "public"."ingredients"."potassium_per_100g_mg" IS 'Potassium, K per 100g, milligrams. USDA FDC nutrient 1092.';



COMMENT ON COLUMN "public"."ingredients"."magnesium_per_100g_mg" IS 'Magnesium, Mg per 100g, milligrams. USDA FDC nutrient 1090.';



COMMENT ON COLUMN "public"."ingredients"."zinc_per_100g_mg" IS 'Zinc, Zn per 100g, milligrams. USDA FDC nutrient 1095.';



CREATE TABLE IF NOT EXISTS "public"."instruction_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "section_title" "text" NOT NULL,
    "section_description" "text",
    "section_order" integer NOT NULL,
    "estimated_time_min" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."instruction_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instruction_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "step_number" integer NOT NULL,
    "instruction" "text" NOT NULL,
    "is_optional" boolean DEFAULT false,
    "is_time_sensitive" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."instruction_steps" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."low_confidence_extractions" AS
 SELECT "id",
    "filename",
    "status",
    (((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric AS "confidence",
    (((("pass3_data" -> 'recipes'::"text") -> 0) -> 'uncertainty_summary'::"text") ->> 'uncertain_fields'::"text") AS "uncertain_fields",
    (("pass1_cost_usd" + "pass2_cost_usd") + COALESCE("pass3_cost_usd", (0)::numeric)) AS "total_cost_usd",
    (("pass1_time_ms" + "pass2_time_ms") + COALESCE("pass3_time_ms", 0)) AS "total_time_ms"
   FROM "public"."recipe_extraction_queue"
  WHERE (("pass3_data" IS NOT NULL) AND ((((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric < 0.8))
  ORDER BY (((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric;


ALTER VIEW "public"."low_confidence_extractions" OWNER TO "postgres";


COMMENT ON VIEW "public"."low_confidence_extractions" IS 'Extractions with confidence < 0.8 that need manual review';



CREATE TABLE IF NOT EXISTS "public"."meal_dish_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "course_type" "text" NOT NULL,
    "placeholder_name" "text",
    "is_main_dish" boolean DEFAULT false NOT NULL,
    "claimed_by" "uuid",
    "claimed_at" timestamp with time zone,
    "recipe_id" "uuid",
    "dish_id" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_to" "uuid",
    "assigned_at" timestamp with time zone,
    "logged_meal_post_id" "uuid",
    CONSTRAINT "meal_dish_plans_course_type_check" CHECK (("course_type" = ANY (ARRAY['appetizer'::"text", 'main'::"text", 'side'::"text", 'dessert'::"text", 'drink'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."meal_dish_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meal_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'attendee'::"text" NOT NULL,
    "rsvp_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "meal_participants_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'attendee'::"text"]))),
    CONSTRAINT "meal_participants_rsvp_status_check" CHECK (("rsvp_status" = ANY (ARRAY['accepted'::"text", 'maybe'::"text", 'declined'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."meal_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."meal_participants" IS 'Tracks who is invited to and attending meals';



COMMENT ON COLUMN "public"."meal_participants"."role" IS 'Host has elevated permissions, attendees can add dishes';



COMMENT ON COLUMN "public"."meal_participants"."rsvp_status" IS 'Tracking invitation responses';



CREATE TABLE IF NOT EXISTS "public"."meal_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "photo_url" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meal_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."meal_photos" IS 'Photos added to meals by participants (separate from dish photos)';



COMMENT ON COLUMN "public"."meal_photos"."user_id" IS 'User who uploaded the photo - tracks accountability';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "recipe_id" "uuid",
    "meal_type" "text",
    "notes" "text",
    "rating" numeric(3,1),
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "cooked_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "modifications" "text",
    "cooking_method" character varying(50),
    "title" "text",
    "post_type" "text" DEFAULT 'dish'::"text",
    "parent_meal_id" "uuid",
    "meal_status" "text",
    "meal_time" timestamp with time zone,
    "meal_location" "text",
    "description" "text",
    "make_again" "text",
    "visibility" "text" DEFAULT 'everyone'::"text",
    "dish_name" "text",
    "lot_depletions" "jsonb",
    CONSTRAINT "chk_posts_visibility" CHECK ((("visibility" IS NULL) OR ("visibility" = ANY (ARRAY['everyone'::"text", 'followers'::"text", 'private'::"text", 'meal_tagged'::"text"])))),
    CONSTRAINT "posts_cooking_method_check" CHECK ((("cooking_method")::"text" = ANY (ARRAY['cook'::"text", 'bake'::"text", 'bbq'::"text", 'roast'::"text", 'grill'::"text", 'sauté'::"text", 'braise'::"text", 'fry'::"text", 'steam'::"text", 'slow_cook'::"text", 'soup'::"text", 'preserve'::"text", 'meal_prep'::"text", 'snack'::"text", 'eating_out'::"text", 'breakfast'::"text"]))),
    CONSTRAINT "posts_meal_status_check" CHECK (("meal_status" = ANY (ARRAY['planning'::"text", 'completed'::"text"]))),
    CONSTRAINT "posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['dish'::"text", 'meal'::"text", 'meal_event'::"text"]))),
    CONSTRAINT "posts_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."posts"."lot_depletions" IS 'D8R-Q44+Q52+Q53. Per-cook lot deduction record. Format: array of supply
   entries each containing: { supply_id, recipe_quantity, recipe_quantity_unit,
   status_before, status_after, lots_affected: [{lot_id, qty_deducted, ...,
   archived: boolean}], shortfall, shortfall_reason }. NULL when post is not a
   cook OR cook had no tracks_lots supplies in its recipe.';



CREATE OR REPLACE VIEW "public"."meals_with_details" AS
 SELECT "m"."id" AS "meal_id",
    "m"."user_id" AS "creator_id",
    "m"."title",
    "m"."meal_type",
    "m"."meal_status",
    "m"."meal_time",
    "m"."meal_location",
    "m"."description",
    "m"."photos",
    "m"."created_at",
    "count"(DISTINCT "dc"."dish_id") AS "dish_count",
    "count"(DISTINCT
        CASE
            WHEN ("mp"."rsvp_status" = 'accepted'::"text") THEN "mp"."user_id"
            ELSE NULL::"uuid"
        END) AS "participant_count",
    ( SELECT "meal_participants"."user_id"
           FROM "public"."meal_participants"
          WHERE (("meal_participants"."meal_id" = "m"."id") AND ("meal_participants"."role" = 'host'::"text"))
         LIMIT 1) AS "host_id",
    "array_agg"(DISTINCT "dc"."dish_id") FILTER (WHERE ("dc"."dish_id" IS NOT NULL)) AS "dish_ids",
    "array_agg"(DISTINCT "mp"."user_id") FILTER (WHERE ("mp"."rsvp_status" = 'accepted'::"text")) AS "participant_ids"
   FROM (("public"."posts" "m"
     LEFT JOIN "public"."dish_courses" "dc" ON (("dc"."meal_id" = "m"."id")))
     LEFT JOIN "public"."meal_participants" "mp" ON (("mp"."meal_id" = "m"."id")))
  WHERE ("m"."post_type" = 'meal'::"text")
  GROUP BY "m"."id", "m"."user_id", "m"."title", "m"."meal_type", "m"."meal_status", "m"."meal_time", "m"."meal_location", "m"."description", "m"."photos", "m"."created_at";


ALTER VIEW "public"."meals_with_details" OWNER TO "postgres";


COMMENT ON VIEW "public"."meals_with_details" IS 'Convenient view for fetching meal summaries with counts';



CREATE TABLE IF NOT EXISTS "public"."measurement_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit" character varying(50) NOT NULL,
    "display_singular" character varying(50) NOT NULL,
    "display_plural" character varying(50) NOT NULL,
    "unit_type" character varying(20) NOT NULL,
    "metric_g" numeric,
    "metric_ml" numeric,
    "aliases" "text"[],
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "has_metric_conversion" CHECK ((((("unit_type")::"text" = 'weight'::"text") AND ("metric_g" IS NOT NULL)) OR ((("unit_type")::"text" = 'volume'::"text") AND ("metric_ml" IS NOT NULL)) OR (("unit_type")::"text" <> ALL ((ARRAY['weight'::character varying, 'volume'::character varying])::"text"[])))),
    CONSTRAINT "valid_unit_type" CHECK ((("unit_type")::"text" = ANY ((ARRAY['weight'::character varying, 'volume'::character varying, 'count'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."measurement_units" OWNER TO "postgres";


COMMENT ON TABLE "public"."measurement_units" IS 'Standard units of measurement for ingredients';



CREATE TABLE IF NOT EXISTS "public"."or_pattern_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid",
    "recipe_title" "text",
    "original_text" "text" NOT NULL,
    "option1_name" "text",
    "option1_ingredient_id" "uuid",
    "option1_found" boolean,
    "option2_name" "text",
    "option2_ingredient_id" "uuid",
    "option2_found" boolean,
    "detected_as_equivalent" boolean,
    "primary_choice" "text",
    "parser_confidence" numeric(3,2),
    "decision_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."or_pattern_decisions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."migration_readiness" AS
 SELECT "count"(DISTINCT "id") AS "total_or_patterns_logged",
    "count"(DISTINCT "recipe_id") AS "recipes_with_or_patterns",
    "count"(DISTINCT ((LEAST("option1_name", "option2_name") || '-'::"text") || GREATEST("option1_name", "option2_name"))) AS "unique_patterns",
    "max"("created_at") AS "most_recent_pattern",
    "min"("created_at") AS "first_pattern",
        CASE
            WHEN ("count"(DISTINCT "id") >= 100) THEN '✅ Ready for Option B migration!'::"text"
            WHEN ("count"(DISTINCT "id") >= 50) THEN (('🔄 Getting close, '::"text" || (100 - "count"(DISTINCT "id"))) || ' more patterns needed'::"text")
            ELSE (('📊 Keep collecting: '::"text" || "count"(DISTINCT "id")) || '/100 patterns'::"text")
        END AS "status"
   FROM "public"."or_pattern_decisions";


ALTER VIEW "public"."migration_readiness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."need_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "need_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."need_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."need_tags" IS 'Need ↔ tag junction (Q39: split tables for FK-cascade ergonomics). Store routing, urgency, recipe attribution tags, etc.';



CREATE TABLE IF NOT EXISTS "public"."needs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "custom_name" "text",
    "status" "text" DEFAULT 'need'::"text" NOT NULL,
    "quantity_display" numeric,
    "unit_display" "text",
    "for_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "supply_id" "uuid",
    "added_by" "uuid",
    "added_from" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "need_has_identity" CHECK (((("ingredient_id" IS NOT NULL) AND ("custom_name" IS NULL)) OR (("ingredient_id" IS NULL) AND ("custom_name" IS NOT NULL)))),
    CONSTRAINT "needs_added_from_check" CHECK (("added_from" = ANY (ARRAY['recipe'::"text", 'supply_spawn'::"text", 'manual'::"text"]))),
    CONSTRAINT "needs_status_check" CHECK (("status" = ANY (ARRAY['need'::"text", 'in_cart'::"text", 'acquired'::"text"])))
);


ALTER TABLE "public"."needs" OWNER TO "postgres";


COMMENT ON TABLE "public"."needs" IS 'Transient household needs (Q5). Lifecycle: need → in_cart → acquired. Supply→need spawn on out transition (Q10β).';



COMMENT ON COLUMN "public"."needs"."quantity_display" IS 'Nullable. Recipe-sourced needs have quantity; supply-spawned needs may not (supplies track status, not quantity per Q15).';



COMMENT ON COLUMN "public"."needs"."for_user_ids" IS 'Inherited from parent supply on spawn (Q27). Same semantics as supplies.for_user_ids (Q37).';



COMMENT ON COLUMN "public"."needs"."supply_id" IS 'Back-pointer to spawning supply. NULL for manually-created or recipe-added needs. Enables edit-routing modal toggle (Q23/Q34).';



COMMENT ON COLUMN "public"."needs"."added_from" IS 'recipe = from recipe-add flow; supply_spawn = auto-created on supply→out; manual = user-added directly.';



CREATE TABLE IF NOT EXISTS "public"."needs_recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "need_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "recipe_quantity_amount" numeric,
    "recipe_quantity_unit" "text",
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."needs_recipes" OWNER TO "postgres";


COMMENT ON TABLE "public"."needs_recipes" IS 'Need ↔ recipe attribution (Q6). Multiple recipes can contribute to one need; display-merged at view time per Q28/Q36.';



COMMENT ON COLUMN "public"."needs_recipes"."recipe_id" IS 'FK CASCADE: if recipe deleted, attribution row deleted but the need itself survives.';



CREATE OR REPLACE VIEW "public"."or_pattern_analysis" AS
 SELECT LEAST("option1_name", "option2_name") AS "ingredient_a",
    GREATEST("option1_name", "option2_name") AS "ingredient_b",
    "count"(*) AS "occurrence_count",
    "avg"("parser_confidence") AS "avg_confidence",
    "bool_or"("detected_as_equivalent") AS "ever_equivalent",
    "bool_and"("detected_as_equivalent") AS "always_equivalent",
    "string_agg"(DISTINCT "decision_reason", '; '::"text") AS "reasons"
   FROM "public"."or_pattern_decisions"
  WHERE (("option1_name" IS NOT NULL) AND ("option2_name" IS NOT NULL))
  GROUP BY LEAST("option1_name", "option2_name"), GREATEST("option1_name", "option2_name")
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."or_pattern_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "participant_user_id" "uuid",
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "external_name" "text",
    CONSTRAINT "chk_participant_identity" CHECK ((("participant_user_id" IS NOT NULL) OR ("external_name" IS NOT NULL))),
    CONSTRAINT "post_participants_role_check" CHECK (("role" = ANY (ARRAY['sous_chef'::"text", 'ate_with'::"text", 'host'::"text"]))),
    CONSTRAINT "post_participants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."post_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."post_participants" IS 'Tracks who cooked/ate with whom on each post';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "username" "text" NOT NULL,
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "location" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "followers_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_visibility" "text" DEFAULT 'followers'::"text",
    CONSTRAINT "user_profiles_default_visibility_check" CHECK (("default_visibility" = ANY (ARRAY['everyone'::"text", 'followers'::"text", 'private'::"text"]))),
    CONSTRAINT "user_profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'premium'::"text", 'professional'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pending_participant_approvals" AS
 SELECT "pp"."id",
    "pp"."post_id",
    "pp"."participant_user_id",
    "pp"."role",
    "pp"."invited_by_user_id",
    "pp"."created_at",
    "p"."title" AS "post_title",
    "p"."cooking_method",
    "p"."created_at" AS "post_created_at",
    "inviter"."display_name" AS "inviter_name",
    "inviter"."username" AS "inviter_username"
   FROM (("public"."post_participants" "pp"
     JOIN "public"."posts" "p" ON (("pp"."post_id" = "p"."id")))
     JOIN "public"."user_profiles" "inviter" ON (("pp"."invited_by_user_id" = "inviter"."id")))
  WHERE ("pp"."status" = 'pending'::"text");


ALTER VIEW "public"."pending_participant_approvals" OWNER TO "postgres";


COMMENT ON VIEW "public"."pending_participant_approvals" IS 'Helper view for showing pending cooking partner requests';



CREATE TABLE IF NOT EXISTS "public"."space_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "space_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "space_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."space_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."space_members" IS 'Tracks who belongs to each space and their role';



COMMENT ON COLUMN "public"."space_members"."role" IS 'owner=full control, member=can add/delete items, guest=can add only';



COMMENT ON COLUMN "public"."space_members"."status" IS 'pending=invited but not accepted, accepted=active member, declined=rejected invite';



CREATE TABLE IF NOT EXISTS "public"."spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" DEFAULT '🏠'::"text",
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."spaces" IS 'Shared contexts for pantries, grocery lists, and cooking';



COMMENT ON COLUMN "public"."spaces"."emoji" IS 'Emoji icon displayed with space name';



COMMENT ON COLUMN "public"."spaces"."is_default" IS 'True for auto-created personal Home space';



CREATE OR REPLACE VIEW "public"."pending_space_invitations" AS
 SELECT "sm"."id" AS "invitation_id",
    "sm"."space_id",
    "s"."name" AS "space_name",
    "s"."emoji" AS "space_emoji",
    "sm"."user_id" AS "invited_user_id",
    "invited_user"."username" AS "invited_username",
    "invited_user"."display_name" AS "invited_display_name",
    "sm"."invited_by",
    "inviter"."username" AS "inviter_username",
    "inviter"."display_name" AS "inviter_display_name",
    "sm"."role" AS "invited_role",
    "sm"."invited_at",
    "sm"."status"
   FROM ((("public"."space_members" "sm"
     JOIN "public"."spaces" "s" ON (("s"."id" = "sm"."space_id")))
     JOIN "public"."user_profiles" "invited_user" ON (("invited_user"."id" = "sm"."user_id")))
     LEFT JOIN "public"."user_profiles" "inviter" ON (("inviter"."id" = "sm"."invited_by")))
  WHERE ("sm"."status" = 'pending'::"text");


ALTER VIEW "public"."pending_space_invitations" OWNER TO "postgres";


COMMENT ON VIEW "public"."pending_space_invitations" IS 'Shows all pending space invitations with user details';



CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id_1" "uuid" NOT NULL,
    "post_id_2" "uuid" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_duplicate_relationships" CHECK (("post_id_1" < "post_id_2")),
    CONSTRAINT "post_relationships_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['dish_pair'::"text", 'meal_group'::"text"])))
);


ALTER TABLE "public"."post_relationships" OWNER TO "postgres";


COMMENT ON TABLE "public"."post_relationships" IS 'Links related posts (dishes in a meal, cooking partners)';



COMMENT ON COLUMN "public"."post_relationships"."relationship_type" IS '''dish_pair'' for cooking partners, ''meal_group'' for dishes in meals';



CREATE TABLE IF NOT EXISTS "public"."posts_backup_pre_7i" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "recipe_id" "uuid",
    "meal_type" "text",
    "notes" "text",
    "rating" numeric(3,1),
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "cooked_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "modifications" "text",
    "cooking_method" character varying(50),
    "title" "text",
    "post_type" "text" DEFAULT 'dish'::"text",
    "parent_meal_id" "uuid",
    "meal_status" "text",
    "meal_time" timestamp with time zone,
    "meal_location" "text",
    "description" "text",
    "make_again" "text",
    "visibility" "text" DEFAULT 'everyone'::"text",
    "dish_name" "text",
    CONSTRAINT "chk_posts_visibility" CHECK ((("visibility" IS NULL) OR ("visibility" = ANY (ARRAY['everyone'::"text", 'followers'::"text", 'private'::"text", 'meal_tagged'::"text"])))),
    CONSTRAINT "posts_cooking_method_check" CHECK ((("cooking_method")::"text" = ANY (ARRAY['cook'::"text", 'bake'::"text", 'bbq'::"text", 'roast'::"text", 'grill'::"text", 'sauté'::"text", 'braise'::"text", 'fry'::"text", 'steam'::"text", 'slow_cook'::"text", 'soup'::"text", 'preserve'::"text", 'meal_prep'::"text", 'snack'::"text", 'eating_out'::"text", 'breakfast'::"text"]))),
    CONSTRAINT "posts_meal_status_check" CHECK (("meal_status" = ANY (ARRAY['planning'::"text", 'completed'::"text"]))),
    CONSTRAINT "posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['dish'::"text", 'meal'::"text"]))),
    CONSTRAINT "posts_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))))
);


ALTER TABLE "public"."posts_backup_pre_7i" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "field_type" "text" NOT NULL,
    "field_id" "text",
    "field_index" integer,
    "original_value" "text" NOT NULL,
    "annotated_value" "text" NOT NULL,
    "annotation_type" "text" DEFAULT 'edit'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_extraction_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_run_id" "uuid" NOT NULL,
    "test_run_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "test_run_notes" "text",
    "original_queue_id" "uuid",
    "book_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "extraction_position" "text" DEFAULT 'full_page'::"text",
    "extraction_version" "text" NOT NULL,
    "gold_standard_recipe_id" "uuid",
    "gold_standard_title" "text",
    "pass0_data" "jsonb",
    "pass1_data" "jsonb",
    "pass2_data" "jsonb",
    "pass3_data" "jsonb",
    "pass4_data" "jsonb",
    "pass0_cost_usd" numeric,
    "pass1_cost_usd" numeric,
    "pass2_cost_usd" numeric,
    "pass3_cost_usd" numeric,
    "pass4_cost_usd" numeric,
    "cost_usd" numeric,
    "processing_time_ms" integer,
    "status" "text",
    "error_message" "text",
    "extracted_title" "text",
    "extracted_ingredient_count" integer,
    "extracted_instruction_count" integer,
    "gold_ingredient_count" integer,
    "gold_instruction_count" integer,
    "ingredient_count_match" boolean,
    "instruction_count_match" boolean,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_extraction_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_extraction_test_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_name" "text" NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"(),
    "original_queue_id" "uuid",
    "filename" "text",
    "extraction_position" "text",
    "extraction_version" "text",
    "pass0_data" "jsonb",
    "pass1_data" "jsonb",
    "pass2_data" "jsonb",
    "pass3_data" "jsonb",
    "pass1_model" "text",
    "pass2_model" "text",
    "pass3_model" "text",
    "cost_usd" numeric,
    "processing_time_ms" integer
);


ALTER TABLE "public"."recipe_extraction_test_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_extraction_verification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "queue_item_id" "uuid",
    "recipe_index" integer,
    "phase1_title_seen" "text",
    "phase1_ingredient_count" integer,
    "phase1_instruction_count" integer,
    "phase1_fractions_visible" "jsonb",
    "phase1_concerns" "jsonb",
    "phase2_extracted_at" timestamp with time zone,
    "phase2_cost_usd" numeric(10,6),
    "title_match" boolean,
    "count_match" boolean,
    "all_fractions_present" boolean,
    "missing_fractions" "jsonb",
    "invented_ingredients" "jsonb",
    "quantity_concerns" "jsonb",
    "paraphrasing_detected" "jsonb",
    "overall_confidence" numeric(3,2),
    "status" "text",
    "issues_found" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pass1_confidence" numeric,
    "pass2_confidence" numeric,
    "pass3_confidence" numeric,
    "reconciliation_method" "text",
    "conflicts_found" integer DEFAULT 0,
    "conflicts_resolved" integer DEFAULT 0,
    "exact_matches" integer DEFAULT 0,
    "semantic_matches" integer DEFAULT 0,
    "gold_standard_comparison" "jsonb",
    "gold_standard_accuracy" numeric,
    "reconciliation_notes" "jsonb",
    CONSTRAINT "recipe_extraction_verification_status_check" CHECK (("status" = ANY (ARRAY['verified'::"text", 'needs_review'::"text", 'failed'::"text", 'extracted'::"text"])))
);


ALTER TABLE "public"."recipe_extraction_verification" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recipe_extraction_verification"."pass1_confidence" IS 'Confidence score from first independent extraction';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."pass2_confidence" IS 'Confidence score from second independent extraction';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."pass3_confidence" IS 'Confidence score from reconciled extraction';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."reconciliation_method" IS 'Method used for reconciliation (e.g., semantic_alignment)';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."conflicts_found" IS 'Number of conflicts found between Pass 1 and Pass 2';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."conflicts_resolved" IS 'Number of conflicts successfully resolved by Pass 3';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."exact_matches" IS 'Number of fields with exact match between Pass 1 and Pass 2';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."semantic_matches" IS 'Number of fields with semantic match between Pass 1 and Pass 2';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."gold_standard_comparison" IS 'Detailed comparison against gold standard (Pass 4 output)';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."gold_standard_accuracy" IS 'Overall accuracy score when compared to gold standard';



COMMENT ON COLUMN "public"."recipe_extraction_verification"."reconciliation_notes" IS 'Detailed notes about how conflicts were resolved';



CREATE TABLE IF NOT EXISTS "public"."recipe_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid",
    "ingredient_id" "uuid",
    "original_text" "text" NOT NULL,
    "match_confidence" numeric(3,2),
    "match_method" "text",
    "match_notes" "text",
    "needs_review" boolean DEFAULT false,
    "quantity_amount" numeric,
    "quantity_unit" "text",
    "preparation" "text",
    "standard_amount" numeric,
    "standard_unit" "text",
    "sequence_order" integer,
    "optional_confidence" numeric(3,2) DEFAULT 0.50,
    "substitute_confidence" numeric(3,2) DEFAULT 0.50,
    "prep_time_min" integer,
    "cook_time_min" integer,
    "inactive_time_min" integer,
    "advance_notice_min" integer,
    "timing_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_time_min" integer GENERATED ALWAYS AS (((COALESCE("prep_time_min", 0) + COALESCE("cook_time_min", 0)) + COALESCE("inactive_time_min", 0))) STORED,
    "quantity_confidence" numeric,
    "embedded_grams" numeric,
    "embedded_ml" numeric,
    "quantity_parse_metadata" "jsonb",
    "ingredient_role" "text" DEFAULT 'core'::"text",
    "nutrition_multiplier" numeric DEFAULT 1.0,
    "ingredient_classification" "text" DEFAULT 'secondary'::"text",
    "flavor_tags" "text"[] DEFAULT '{}'::"text"[],
    "ingredient_state" "text",
    CONSTRAINT "recipe_ingredients_advance_notice_min_check" CHECK (("advance_notice_min" >= 0)),
    CONSTRAINT "recipe_ingredients_cook_time_min_check" CHECK (("cook_time_min" >= 0)),
    CONSTRAINT "recipe_ingredients_inactive_time_min_check" CHECK (("inactive_time_min" >= 0)),
    CONSTRAINT "recipe_ingredients_ingredient_state_check" CHECK ((("ingredient_state" IS NULL) OR ("ingredient_state" = ANY (ARRAY['raw'::"text", 'cooked'::"text"])))),
    CONSTRAINT "recipe_ingredients_match_confidence_check" CHECK ((("match_confidence" >= (0)::numeric) AND ("match_confidence" <= (1)::numeric))),
    CONSTRAINT "recipe_ingredients_match_method_check" CHECK (("match_method" = ANY (ARRAY['exact'::"text", 'fuzzy'::"text", 'partial'::"text", 'manual'::"text", 'none'::"text", 'alias'::"text", 'prefix_strip'::"text", 'suffix_strip'::"text", 'prefix_alias'::"text", 'or_primary'::"text", 'or_alias'::"text", 'deplural_s'::"text", 'deplural_es'::"text", 'deplural_ies'::"text", 'haiku_classify'::"text"]))),
    CONSTRAINT "recipe_ingredients_optional_confidence_check" CHECK ((("optional_confidence" >= (0)::numeric) AND ("optional_confidence" <= (1)::numeric))),
    CONSTRAINT "recipe_ingredients_prep_time_min_check" CHECK (("prep_time_min" >= 0)),
    CONSTRAINT "recipe_ingredients_substitute_confidence_check" CHECK ((("substitute_confidence" >= (0)::numeric) AND ("substitute_confidence" <= (1)::numeric)))
);


ALTER TABLE "public"."recipe_ingredients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recipe_ingredients"."quantity_confidence" IS 'Parsing confidence 0.0–1.0. Used by nutrition calculation view. 0.0 = unmeasurable (to taste), 1.0 = exact number.';



COMMENT ON COLUMN "public"."recipe_ingredients"."embedded_grams" IS 'Chef-provided gram weight extracted from original_text (e.g., "½ cup (67g) hazelnuts" → 67). Highest confidence for nutrition math.';



COMMENT ON COLUMN "public"."recipe_ingredients"."embedded_ml" IS 'Chef-provided ml volume extracted from original_text (e.g., "¼ cup/60ml olive oil" → 60). Convert via density for nutrition.';



COMMENT ON COLUMN "public"."recipe_ingredients"."quantity_parse_metadata" IS 'Full parsing provenance: format_type, range_min/max, qualifier, compound breakdown, notes. Diagnostic + future nutrition range feature.';



COMMENT ON COLUMN "public"."recipe_ingredients"."ingredient_role" IS 'Role of this ingredient in the recipe. Values: core (default), frying_medium, garnish, marinade, brine. Used for nutrition adjustment.';



COMMENT ON COLUMN "public"."recipe_ingredients"."nutrition_multiplier" IS 'Multiplier applied to nutrition calculation (0.0-1.0). Default 1.0 = full nutrition counted. Frying oil might be 0.10 (10% absorbed). Garnish might be 0.0 (excluded). Applied in the nutrition view.';



COMMENT ON COLUMN "public"."recipe_ingredients"."ingredient_state" IS 'How the recipe specifies this ingredient. ''raw'' = dry/uncooked weight (most common). ''cooked'' = post-cooking weight or canned-equivalent. NULL = treat as raw. Only meaningful when the referenced ingredient.cooked_ratio IS NOT NULL. Added in Phase 10A to fix unconditional cooked_ratio application in recipe_nutrition_computed view.';



CREATE OR REPLACE VIEW "public"."recipe_filters" AS
 SELECT "id",
    "title",
    "prep_time_min",
    "cook_time_min",
    "inactive_time_min",
    (COALESCE("prep_time_min", 0) + COALESCE("cook_time_min", 0)) AS "active_time_min",
    ((COALESCE("prep_time_min", 0) + COALESCE("cook_time_min", 0)) + COALESCE("inactive_time_min", 0)) AS "total_time_min",
    "servings",
    "difficulty_level",
    "easier_than_looks",
    "cooking_methods",
    "cuisine_types",
    "make_ahead_friendly",
    "recipe_type",
    "dietary_tags",
    ( SELECT "count"(*) AS "count"
           FROM "public"."recipe_ingredients"
          WHERE ("recipe_ingredients"."recipe_id" = "r"."id")) AS "ingredient_count",
        CASE
            WHEN ("array_length"("cooking_methods", 1) = 1) THEN true
            ELSE false
        END AS "is_one_pot",
    "chef_id",
    "image_url",
    "created_at",
    "updated_at"
   FROM "public"."recipes" "r"
  WHERE ("is_public" = true);


ALTER VIEW "public"."recipe_filters" OWNER TO "postgres";


COMMENT ON VIEW "public"."recipe_filters" IS 'Pre-calculated filter values for recipe browsing';



CREATE OR REPLACE VIEW "public"."recipe_ingredient_nutrition" AS
 SELECT "ri"."recipe_id",
    "ri"."id" AS "recipe_ingredient_id",
    "ri"."original_text",
    "ri"."quantity_amount",
    "ri"."quantity_unit",
    "ri"."sequence_order",
    "ri"."ingredient_role",
    "ri"."nutrition_multiplier",
    "i"."name" AS "ingredient_name",
    "i"."calories_per_100g",
    "i"."cooked_ratio",
    "conv"."grams" AS "estimated_grams",
    "conv"."confidence" AS "gram_confidence",
    "conv"."conversion_method",
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."calories_per_100g" IS NOT NULL)) THEN "round"((((("conv"."grams" * ("i"."calories_per_100g")::numeric) * COALESCE("i"."cooked_ratio", 1.0)) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0))
            ELSE NULL::numeric
        END AS "calories",
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."protein_per_100g" IS NOT NULL)) THEN "round"((((("conv"."grams" * "i"."protein_per_100g") * COALESCE("i"."cooked_ratio", 1.0)) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0), 1)
            ELSE NULL::numeric
        END AS "protein_g",
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."fat_per_100g" IS NOT NULL)) THEN "round"((((("conv"."grams" * "i"."fat_per_100g") * COALESCE("i"."cooked_ratio", 1.0)) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0), 1)
            ELSE NULL::numeric
        END AS "fat_g",
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."carbohydrates_per_100g" IS NOT NULL)) THEN "round"((((("conv"."grams" * "i"."carbohydrates_per_100g") * COALESCE("i"."cooked_ratio", 1.0)) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0), 1)
            ELSE NULL::numeric
        END AS "carbs_g"
   FROM (("public"."recipe_ingredients" "ri"
     LEFT JOIN "public"."ingredients" "i" ON (("i"."id" = "ri"."ingredient_id")))
     LEFT JOIN LATERAL "public"."estimate_ingredient_grams"("ri"."quantity_amount", "ri"."quantity_unit", "ri"."ingredient_id", "ri"."original_text", "ri"."embedded_grams", "ri"."embedded_ml") "conv"("grams", "confidence", "conversion_method") ON (true));


ALTER VIEW "public"."recipe_ingredient_nutrition" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recipe_ingredients_detail" AS
 SELECT "ri"."id",
    "ri"."recipe_id",
    "ri"."ingredient_id",
    "ri"."original_text",
    "ri"."match_confidence",
    "ri"."match_method",
    "ri"."match_notes",
    "ri"."needs_review",
    "ri"."quantity_amount",
    "ri"."quantity_unit",
    "ri"."preparation",
    "ri"."standard_amount",
    "ri"."standard_unit",
    "ri"."sequence_order",
    "ri"."optional_confidence",
    "ri"."substitute_confidence",
    "ri"."prep_time_min",
    "ri"."cook_time_min",
    "ri"."inactive_time_min",
    "ri"."advance_notice_min",
    "ri"."timing_notes",
    "ri"."created_at",
    "ri"."updated_at",
    "ri"."total_time_min",
    "r"."title" AS "recipe_title",
    "r"."chef_id",
    "i"."name" AS "ingredient_name",
    "i"."plural_name" AS "ingredient_plural",
    "i"."family" AS "ingredient_family",
    "i"."ingredient_type",
    "i"."ingredient_subtype",
    "i"."calories_per_100g",
    "i"."protein_per_100g"
   FROM (("public"."recipe_ingredients" "ri"
     JOIN "public"."recipes" "r" ON (("r"."id" = "ri"."recipe_id")))
     LEFT JOIN "public"."ingredients" "i" ON (("i"."id" = "ri"."ingredient_id")))
  ORDER BY "r"."title", "ri"."sequence_order";


ALTER VIEW "public"."recipe_ingredients_detail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid",
    "media_type" "text",
    "url" "text",
    "description" "text",
    "location_on_page" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recipe_media_media_type_check" CHECK (("media_type" = ANY (ARRAY['qr_code'::"text", 'url'::"text", 'youtube'::"text", 'instagram'::"text", 'video'::"text", 'podcast'::"text", 'tiktok'::"text"])))
);


ALTER TABLE "public"."recipe_media" OWNER TO "postgres";


COMMENT ON TABLE "public"."recipe_media" IS 'QR codes, videos, and other media linked to recipes';



CREATE MATERIALIZED VIEW "public"."recipe_nutrition_computed" AS
 SELECT "r"."id" AS "recipe_id",
    "r"."title",
    "r"."servings",
    ("round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."calories_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * ("i"."calories_per_100g")::numeric) *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END)))::integer AS "total_calories",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."protein_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."protein_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_protein_g",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."fat_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."fat_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_fat_g",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."carbohydrates_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."carbohydrates_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_carbs_g",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."fiber_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."fiber_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_fiber_g",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."sugar_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."sugar_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_sugar_g",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."sodium_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."sodium_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 0) AS "total_sodium_mg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."vitamin_a_per_100g_mcg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."vitamin_a_per_100g_mcg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_vitamin_a_mcg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."vitamin_c_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."vitamin_c_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_vitamin_c_mg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."vitamin_d_per_100g_mcg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."vitamin_d_per_100g_mcg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_vitamin_d_mcg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."vitamin_b12_per_100g_mcg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."vitamin_b12_per_100g_mcg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_vitamin_b12_mcg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."folate_per_100g_mcg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."folate_per_100g_mcg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_folate_mcg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."iron_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."iron_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_iron_mg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."calcium_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."calcium_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_calcium_mg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."potassium_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."potassium_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_potassium_mg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."magnesium_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."magnesium_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_magnesium_mg",
    "round"("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."zinc_per_100g_mg" IS NOT NULL)) THEN (((("conv"."grams" * "i"."zinc_per_100g_mg") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END), 1) AS "total_zinc_mg",
    ("round"(("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."calories_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * ("i"."calories_per_100g")::numeric) *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END) / (NULLIF("r"."servings", 0))::numeric)))::integer AS "cal_per_serving",
    "round"(("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."protein_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."protein_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END) / (NULLIF("r"."servings", 0))::numeric), 1) AS "protein_per_serving_g",
    "round"(("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."fat_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."fat_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END) / (NULLIF("r"."servings", 0))::numeric), 1) AS "fat_per_serving_g",
    "round"(("sum"(
        CASE
            WHEN (("conv"."grams" IS NOT NULL) AND ("i"."carbohydrates_per_100g" IS NOT NULL)) THEN (((("conv"."grams" * "i"."carbohydrates_per_100g") *
            CASE
                WHEN ("ri"."ingredient_state" = 'cooked'::"text") THEN COALESCE("i"."cooked_ratio", 1.0)
                ELSE 1.0
            END) * COALESCE("ri"."nutrition_multiplier", 1.0)) / 100.0)
            ELSE (0)::numeric
        END) / (NULLIF("r"."servings", 0))::numeric), 1) AS "carbs_per_serving_g",
    "bool_and"(COALESCE("i"."is_vegan", "type_rule"."is_vegan", "family_rule"."is_vegan", false)) AS "is_vegan",
    "bool_and"(COALESCE("i"."is_vegetarian", "type_rule"."is_vegetarian", "family_rule"."is_vegetarian", false)) AS "is_vegetarian",
    "bool_and"(COALESCE("i"."is_gluten_free", "type_rule"."is_gluten_free", "family_rule"."is_gluten_free", false)) AS "is_gluten_free",
    "bool_and"(COALESCE("i"."is_dairy_free", "type_rule"."is_dairy_free", "family_rule"."is_dairy_free", false)) AS "is_dairy_free",
    "bool_and"(COALESCE("i"."is_nut_free", "type_rule"."is_nut_free", "family_rule"."is_nut_free", false)) AS "is_nut_free",
    "bool_and"(COALESCE("i"."is_shellfish_free", "type_rule"."is_shellfish_free", "family_rule"."is_shellfish_free", false)) AS "is_shellfish_free",
    "bool_and"(COALESCE("i"."is_soy_free", "type_rule"."is_soy_free", "family_rule"."is_soy_free", false)) AS "is_soy_free",
    "bool_and"(COALESCE("i"."is_egg_free", "type_rule"."is_egg_free", "family_rule"."is_egg_free", false)) AS "is_egg_free",
    "count"("ri"."id") AS "total_ingredients",
    "count"("ri"."ingredient_id") AS "matched_ingredients",
    "count"("i"."calories_per_100g") AS "ingredients_with_nutrition",
    "count"("conv"."grams") FILTER (WHERE ("conv"."grams" IS NOT NULL)) AS "ingredients_with_grams",
    "round"("avg"("conv"."confidence"), 2) AS "avg_confidence",
    "round"("min"("conv"."confidence"), 2) AS "min_confidence",
    "round"(((("count"("i"."calories_per_100g"))::numeric / (NULLIF("count"("ri"."id"), 0))::numeric) * 100.0), 0) AS "nutrition_coverage_pct",
        CASE
            WHEN (("avg"("conv"."confidence") >= 0.75) AND ((("count"("i"."calories_per_100g"))::numeric / (NULLIF("count"("ri"."id"), 0))::numeric) >= 0.90)) THEN 'high_confidence'::"text"
            WHEN (("avg"("conv"."confidence") >= 0.55) AND ((("count"("i"."calories_per_100g"))::numeric / (NULLIF("count"("ri"."id"), 0))::numeric) >= 0.70)) THEN 'good_estimate'::"text"
            WHEN (("avg"("conv"."confidence") >= 0.35) AND ((("count"("i"."calories_per_100g"))::numeric / (NULLIF("count"("ri"."id"), 0))::numeric) >= 0.50)) THEN 'rough_estimate'::"text"
            ELSE 'incomplete'::"text"
        END AS "quality_label"
   FROM ((((("public"."recipes" "r"
     JOIN "public"."recipe_ingredients" "ri" ON (("ri"."recipe_id" = "r"."id")))
     LEFT JOIN "public"."ingredients" "i" ON (("i"."id" = "ri"."ingredient_id")))
     LEFT JOIN "public"."ingredient_category_rules" "type_rule" ON ((("type_rule"."family" = "i"."family") AND ("type_rule"."ingredient_type" = "i"."ingredient_type") AND ("type_rule"."ingredient_type" IS NOT NULL))))
     LEFT JOIN "public"."ingredient_category_rules" "family_rule" ON ((("family_rule"."family" = "i"."family") AND ("family_rule"."ingredient_type" IS NULL))))
     LEFT JOIN LATERAL "public"."estimate_ingredient_grams"("ri"."quantity_amount", "ri"."quantity_unit", "ri"."ingredient_id", "ri"."original_text", "ri"."embedded_grams", "ri"."embedded_ml") "conv"("grams", "confidence", "conversion_method") ON (true))
  GROUP BY "r"."id", "r"."title", "r"."servings"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."recipe_nutrition_computed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid",
    "image_url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "caption" "text",
    "page_number" integer,
    "source_queue_id" "uuid",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_references" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_recipe_id" "uuid",
    "reference_text" "text" NOT NULL,
    "referenced_page_number" integer,
    "referenced_recipe_name" "text",
    "referenced_recipe_id" "uuid",
    "reference_type" "text",
    "is_fulfilled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recipe_references_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['ingredient'::"text", 'technique'::"text", 'variation'::"text", 'note'::"text", 'serving_suggestion'::"text", 'picture'::"text", 'note_reference'::"text"])))
);


ALTER TABLE "public"."recipe_references" OWNER TO "postgres";


COMMENT ON TABLE "public"."recipe_references" IS 'Cross-references between recipes (see page X)';



COMMENT ON COLUMN "public"."recipe_references"."is_fulfilled" IS 'True when referenced recipe exists';



CREATE TABLE IF NOT EXISTS "public"."recipe_source_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "external_source_id" "text",
    "source_domain" "text",
    "source_note_id" "text" NOT NULL,
    "note_type" "text",
    "author_name" "text",
    "author_external_id" "text",
    "message" "text" NOT NULL,
    "parent_source_note_id" "text",
    "is_recommended" boolean DEFAULT false,
    "recommendations_count" integer DEFAULT 0,
    "replies_count" integer DEFAULT 0,
    "source_created_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_source_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_step_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "step_number" integer NOT NULL,
    "note_text" "text",
    "voice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_step_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes_backup_20250122" (
    "id" "uuid",
    "user_id" "uuid",
    "parent_recipe_id" "uuid",
    "title" "text",
    "description" "text",
    "ingredients" "jsonb",
    "instructions" "jsonb",
    "prep_time_min" integer,
    "cook_time_min" integer,
    "servings" integer,
    "meal_type" "text"[],
    "dietary_tags" "text"[],
    "is_public" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "source_author" "text",
    "source_name" "text",
    "source_type" "text",
    "chef_id" "uuid",
    "image_url" "text",
    "recipe_type" "text",
    "inactive_time_min" integer,
    "difficulty_level" "text",
    "easier_than_looks" boolean,
    "cooking_methods" "text"[],
    "cuisine_types" "text"[],
    "make_ahead_friendly" boolean,
    "book_id" "uuid",
    "page_number" integer,
    "chef_difficulty_label" "text",
    "chef_difficulty_level" "text",
    "ai_difficulty_level" "text",
    "ai_difficulty_score" numeric,
    "ai_difficulty_factors" "jsonb",
    "raw_extraction_data" "jsonb",
    "default_course" "text"
);


ALTER TABLE "public"."recipes_backup_20250122" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes_backup_minimal_completion" (
    "id" "uuid",
    "user_id" "uuid",
    "parent_recipe_id" "uuid",
    "title" "text",
    "description" "text",
    "ingredients" "jsonb",
    "instructions" "jsonb",
    "prep_time_min" integer,
    "cook_time_min" integer,
    "servings" integer,
    "meal_type" "text"[],
    "dietary_tags" "text"[],
    "is_public" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "source_author" "text",
    "source_name" "text",
    "source_type" "text",
    "chef_id" "uuid",
    "image_url" "text",
    "recipe_type" "text",
    "inactive_time_min" integer,
    "difficulty_level" "text",
    "easier_than_looks" boolean,
    "cooking_methods" "text"[],
    "cuisine_types" "text"[],
    "make_ahead_friendly" boolean,
    "book_id" "uuid",
    "page_number" integer,
    "chef_difficulty_label" "text",
    "chef_difficulty_level" "text",
    "ai_difficulty_level" "text",
    "ai_difficulty_score" numeric,
    "ai_difficulty_factors" "jsonb",
    "raw_extraction_data" "jsonb",
    "default_course" "text",
    "is_gold_standard" boolean,
    "gold_standard_verified_by" "uuid",
    "gold_standard_verified_at" timestamp with time zone,
    "gold_standard_notes" "text",
    "recipe_notes" "text",
    "cross_references" "jsonb",
    "photo_page" integer,
    "supplementary_content" "jsonb"
);


ALTER TABLE "public"."recipes_backup_minimal_completion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes_backup_schema_migration" (
    "id" "uuid",
    "user_id" "uuid",
    "parent_recipe_id" "uuid",
    "title" "text",
    "description" "text",
    "ingredients" "jsonb",
    "instructions" "jsonb",
    "prep_time_min" integer,
    "cook_time_min" integer,
    "servings" integer,
    "meal_type" "text"[],
    "dietary_tags" "text"[],
    "is_public" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "source_author" "text",
    "source_name" "text",
    "source_type" "text",
    "chef_id" "uuid",
    "image_url" "text",
    "recipe_type" "text",
    "inactive_time_min" integer,
    "difficulty_level" "text",
    "easier_than_looks" boolean,
    "cooking_methods" "text"[],
    "cuisine_types" "text"[],
    "make_ahead_friendly" boolean,
    "book_id" "uuid",
    "page_number" integer,
    "chef_difficulty_label" "text",
    "chef_difficulty_level" "text",
    "ai_difficulty_level" "text",
    "ai_difficulty_score" numeric,
    "ai_difficulty_factors" "jsonb",
    "raw_extraction_data" "jsonb",
    "default_course" "text",
    "is_gold_standard" boolean,
    "gold_standard_verified_by" "uuid",
    "gold_standard_verified_at" timestamp with time zone,
    "gold_standard_notes" "text",
    "recipe_notes" "text",
    "cross_references" "jsonb",
    "photo_page" integer,
    "supplementary_content" "jsonb"
);


ALTER TABLE "public"."recipes_backup_schema_migration" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recipes_with_subs" AS
 SELECT "r"."id",
    "r"."title",
    "r"."book_id",
    "r"."page_number",
    "r"."recipe_tags",
    "r"."parent_recipe_id",
    COALESCE("json_agg"("json_build_object"('id', "sub"."id", 'title', "sub"."title")) FILTER (WHERE ("sub"."id" IS NOT NULL)), '[]'::json) AS "sub_recipes"
   FROM ("public"."recipes" "r"
     LEFT JOIN "public"."recipes" "sub" ON (("sub"."parent_recipe_id" = "r"."id")))
  WHERE ("r"."parent_recipe_id" IS NULL)
  GROUP BY "r"."id", "r"."title", "r"."book_id", "r"."page_number", "r"."recipe_tags", "r"."parent_recipe_id";


ALTER VIEW "public"."recipes_with_subs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."reconciliation_performance" AS
 SELECT "v"."queue_item_id",
    "q"."filename",
    "v"."pass1_confidence",
    "v"."pass2_confidence",
    "v"."pass3_confidence",
    "v"."exact_matches",
    "v"."semantic_matches",
    "v"."conflicts_found",
    "v"."conflicts_resolved",
        CASE
            WHEN ("v"."conflicts_found" > 0) THEN "round"(((("v"."conflicts_resolved")::numeric / ("v"."conflicts_found")::numeric) * (100)::numeric), 1)
            ELSE 100.0
        END AS "conflict_resolution_rate",
    "v"."gold_standard_accuracy",
    "v"."status"
   FROM ("public"."recipe_extraction_verification" "v"
     JOIN "public"."recipe_extraction_queue" "q" ON (("q"."id" = "v"."queue_item_id")))
  WHERE ("v"."pass3_confidence" IS NOT NULL)
  ORDER BY "v"."created_at" DESC;


ALTER VIEW "public"."reconciliation_performance" OWNER TO "postgres";


COMMENT ON VIEW "public"."reconciliation_performance" IS 'Track how well Pass 3 reconciles conflicts between Pass 1 and Pass 2';



CREATE TABLE IF NOT EXISTS "public"."regions" (
    "slug" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "state" "text",
    "latitude" numeric,
    "longitude" numeric,
    "usda_zone" "text",
    "timezone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "default_expiration_fridge_days" integer DEFAULT 7,
    "default_expiration_freezer_days" integer DEFAULT 90,
    "default_expiration_pantry_days" integer DEFAULT 365,
    "default_expiration_counter_days" integer DEFAULT 3,
    "low_stock_threshold" numeric DEFAULT 2,
    "critical_stock_threshold" numeric DEFAULT 0,
    "settings_json" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expiration_falloff_days" integer DEFAULT 14
);


ALTER TABLE "public"."space_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."space_settings" IS 'Configuration for each space - only owners can edit';



COMMENT ON COLUMN "public"."space_settings"."expiration_falloff_days" IS 'Days past expiration_date at which non-freezer pantry items auto-soft-delete (set discarded_at, discarded_reason=''expired''). Default 14. The job that applies this runs in 8A-CP4.';



CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "custom_name" "text",
    "status" "text" DEFAULT 'in_stock'::"text" NOT NULL,
    "for_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "brands" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "added_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tracking_mode" "text" DEFAULT 'restock'::"text" NOT NULL,
    "storage_location" "text",
    "archived_at" timestamp with time zone,
    "is_priority" boolean DEFAULT false NOT NULL,
    "usage_level" smallint DEFAULT 5 NOT NULL,
    "tracks_lots" boolean DEFAULT false NOT NULL,
    "search_vector" "tsvector",
    "last_confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "low_list_target" "text" DEFAULT 'long'::"text" NOT NULL,
    "out_list_target" "text" DEFAULT 'short'::"text" NOT NULL,
    CONSTRAINT "supplies_low_list_target_check" CHECK (("low_list_target" = ANY (ARRAY['none'::"text", 'short'::"text", 'medium'::"text", 'long'::"text"]))),
    CONSTRAINT "supplies_out_list_target_check" CHECK (("out_list_target" = ANY (ARRAY['none'::"text", 'short'::"text", 'medium'::"text", 'long'::"text"]))),
    CONSTRAINT "supplies_status_check" CHECK (("status" = ANY (ARRAY['in_stock'::"text", 'low'::"text", 'critical'::"text", 'out'::"text", 'unknown'::"text"]))),
    CONSTRAINT "supplies_storage_location_check" CHECK ((("storage_location" IS NULL) OR ("storage_location" = ANY (ARRAY['fridge'::"text", 'freezer'::"text", 'pantry'::"text", 'counter'::"text"])))),
    CONSTRAINT "supplies_tracking_mode_check" CHECK (("tracking_mode" = ANY (ARRAY['restock'::"text", 'track_only'::"text"]))),
    CONSTRAINT "supplies_usage_level_check" CHECK ((("usage_level" >= 0) AND ("usage_level" <= 5))),
    CONSTRAINT "supply_has_identity" CHECK (((("ingredient_id" IS NOT NULL) AND ("custom_name" IS NULL)) OR (("ingredient_id" IS NULL) AND ("custom_name" IS NOT NULL))))
);


ALTER TABLE "public"."supplies" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplies" IS 'Household items kept in ongoing stock (Q5). Status-based tracking (Q15). for_user_ids: empty array = household-shared, all current+future members (Q37).';



COMMENT ON COLUMN "public"."supplies"."custom_name" IS 'For non-ingredient items (toilet paper, paper towels). When set, ingredient_id must be NULL.';



COMMENT ON COLUMN "public"."supplies"."status" IS 'DB allows all 4 states for cycling. Service layer restricts INITIAL state to in_stock/low/out per Q35 (critical only via state-cycling).';



COMMENT ON COLUMN "public"."supplies"."for_user_ids" IS 'Empty array = household-shared (forward-compatible per Q37). Explicit subset = frozen owner list. UI writes empty for "Everyone" selection; never auto-populates with current member UUIDs.';



COMMENT ON COLUMN "public"."supplies"."brands" IS 'Free-form brand list. E.g. {"Kerrygold", "Kirkland"}. Surfaces in supply detail (Q22).';



COMMENT ON COLUMN "public"."supplies"."tracks_lots" IS 'D8R-Q43. When true, supply tracks individual lots in supply_lots table. When false (default), supply uses status-only tracking via usage_level.';



COMMENT ON COLUMN "public"."supplies"."last_confirmed_at" IS '8R-UX4: behavioral-engagement timestamp. Bumped by status changes, swipe-mark-used, lot creates/updates/archives, cook depletion, and lot storage moves. Drives "Sitting Idle" in the Pantry Use Soon outer tab. See lib/services/suppliesService.ts CONFIRMING_FUNCTIONS_REFERENCE for the canonical bumper list.';



COMMENT ON COLUMN "public"."supplies"."low_list_target" IS '2026-06-04: grocery list a restock supply is auto-added to when status→low. one of none/short/medium/long. Ignored for track_only.';



COMMENT ON COLUMN "public"."supplies"."out_list_target" IS '2026-06-04: grocery list a restock supply is escalated to when status→out/critical. one of none/short/medium/long. Ignored for track_only.';



CREATE TABLE IF NOT EXISTS "public"."supply_lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supply_id" "uuid" NOT NULL,
    "quantity" numeric(10,3) NOT NULL,
    "quantity_unit" "text" NOT NULL,
    "storage_location" "text" NOT NULL,
    "acquired_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "expires_at_overridden" boolean DEFAULT false NOT NULL,
    "variant_label" "text",
    "brand" "text",
    "notes" "text",
    "consumed_at" timestamp with time zone,
    "search_vector" "tsvector",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supply_lots_quantity_nonneg_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "supply_lots_storage_location_check" CHECK (("storage_location" = ANY (ARRAY['fridge'::"text", 'freezer'::"text", 'pantry'::"text", 'counter'::"text"])))
);


ALTER TABLE "public"."supply_lots" OWNER TO "postgres";


COMMENT ON TABLE "public"."supply_lots" IS 'D8R-Q43-Q48. Individual physical lots tracked per supply when supplies.tracks_lots = true.';



COMMENT ON COLUMN "public"."supply_lots"."expires_at_overridden" IS 'D8R-Q47. When true, expires_at was user-set and storage moves should NOT recompute it.';



COMMENT ON COLUMN "public"."supply_lots"."consumed_at" IS 'D8R-Q48. Soft-delete on full consumption. Active queries filter consumed_at IS NULL.';



CREATE TABLE IF NOT EXISTS "public"."supply_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supply_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supply_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."supply_tags" IS 'Supply ↔ tag junction (Q39: split tables for FK-cascade ergonomics). Stores, storage location, etc.';



CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "dimension" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tags_dimension_check" CHECK (("dimension" = ANY (ARRAY['store'::"text", 'urgency'::"text", 'recipe'::"text", 'event'::"text", 'storage'::"text"])))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."tags" IS 'Space-scoped tag taxonomy. Dimensions are predefined (Q1); values are user-created within each dimension. Aisle is NOT a dimension (Q29).';



CREATE OR REPLACE VIEW "public"."unmatched_ingredients" AS
 SELECT "ri"."id",
    "ri"."recipe_id",
    "r"."title" AS "recipe_title",
    "ri"."original_text",
    "ri"."match_confidence",
    "ri"."match_notes",
    "ri"."quantity_amount",
    "ri"."quantity_unit",
    "ri"."preparation"
   FROM ("public"."recipe_ingredients" "ri"
     JOIN "public"."recipes" "r" ON (("r"."id" = "ri"."recipe_id")))
  WHERE (("ri"."ingredient_id" IS NULL) OR ("ri"."needs_review" = true) OR ("ri"."match_confidence" < 0.8))
  ORDER BY "ri"."match_confidence" NULLS FIRST, "r"."title", "ri"."sequence_order";


ALTER VIEW "public"."unmatched_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_active_space" (
    "user_id" "uuid" NOT NULL,
    "active_space_id" "uuid" NOT NULL,
    "switched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_active_space" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_active_space" IS 'Tracks which space each user is currently in - affects pantry view, grocery lists, etc.';



CREATE TABLE IF NOT EXISTS "public"."user_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "book_id" "uuid",
    "ownership_claimed" boolean DEFAULT true,
    "ownership_proof_image_url" "text",
    "added_date" timestamp with time zone DEFAULT "now"(),
    "recipe_count" integer DEFAULT 0
);


ALTER TABLE "public"."user_books" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_books" IS 'User library with ownership verification';



COMMENT ON COLUMN "public"."user_books"."ownership_claimed" IS 'User claimed they own this book';



CREATE TABLE IF NOT EXISTS "public"."user_dietary_preferences" (
    "user_id" "uuid" NOT NULL,
    "is_vegan" boolean DEFAULT false NOT NULL,
    "is_vegetarian" boolean DEFAULT false NOT NULL,
    "is_gluten_free" boolean DEFAULT false NOT NULL,
    "is_dairy_free" boolean DEFAULT false NOT NULL,
    "is_nut_free" boolean DEFAULT false NOT NULL,
    "is_shellfish_free" boolean DEFAULT false NOT NULL,
    "is_soy_free" boolean DEFAULT false NOT NULL,
    "is_egg_free" boolean DEFAULT false NOT NULL,
    "auto_apply_to_browse" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_dietary_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_dietary_preferences" IS 'Per-user dietary preferences and restrictions. Mirrors the 8 recipe dietary flag columns for direct filter matching. auto_apply_to_browse controls whether prefs pre-filter RecipeListScreen.';



CREATE TABLE IF NOT EXISTS "public"."user_ingredient_choices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "recipe_ingredient_id" "uuid",
    "presented_options" "text"[],
    "user_choice" "text",
    "chosen_ingredient_id" "uuid",
    "cooking_session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_ingredient_choices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_ingredient_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "preferred_store_id" "uuid",
    "purchase_frequency" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_ingredient_preferences_purchase_frequency_check" CHECK ((("purchase_frequency" IS NULL) OR ("purchase_frequency" = ANY (ARRAY['weekly'::"text", 'biweekly'::"text", 'monthly'::"text", 'rarely'::"text", 'as_needed'::"text"]))))
);


ALTER TABLE "public"."user_ingredient_preferences" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_meal_participation" AS
 SELECT "mp"."user_id",
    "mp"."meal_id",
    "m"."title" AS "meal_title",
    "m"."meal_time",
    "m"."meal_status",
    "mp"."role",
    "mp"."rsvp_status",
    ( SELECT "count"(*) AS "count"
           FROM ("public"."dish_courses" "dc"
             JOIN "public"."posts" "d" ON (("d"."id" = "dc"."dish_id")))
          WHERE (("dc"."meal_id" = "mp"."meal_id") AND ("d"."user_id" = "mp"."user_id"))) AS "dish_contribution_count",
    "mp"."invited_at",
    "mp"."responded_at"
   FROM ("public"."meal_participants" "mp"
     JOIN "public"."posts" "m" ON (("m"."id" = "mp"."meal_id")))
  WHERE ("m"."post_type" = 'meal'::"text");


ALTER VIEW "public"."user_meal_participation" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_meal_participation" IS 'View showing each users participation in meals';



CREATE TABLE IF NOT EXISTS "public"."user_nutrition_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nutrient" "text" NOT NULL,
    "goal_value" numeric NOT NULL,
    "goal_unit" "text" NOT NULL,
    "goal_period" "text" DEFAULT 'daily'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_nutrition_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_pantry_preferences" (
    "user_id" "uuid" NOT NULL,
    "default_storage_overrides" "jsonb" DEFAULT '{}'::"jsonb",
    "low_stock_threshold" numeric DEFAULT 2,
    "critical_stock_threshold" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "staleness_threshold_days" "jsonb" DEFAULT '{"dairy": 14, "freezer": 180, "produce": 7, "pantry_staple": 60}'::"jsonb",
    CONSTRAINT "user_pantry_preferences_check" CHECK (("low_stock_threshold" >= "critical_stock_threshold")),
    CONSTRAINT "user_pantry_preferences_critical_stock_threshold_check" CHECK (("critical_stock_threshold" >= (0)::numeric)),
    CONSTRAINT "user_pantry_preferences_low_stock_threshold_check" CHECK (("low_stock_threshold" >= (0)::numeric))
);


ALTER TABLE "public"."user_pantry_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_pantry_preferences" IS 'User-specific pantry settings and stock thresholds';



COMMENT ON COLUMN "public"."user_pantry_preferences"."default_storage_overrides" IS 'JSON map of ingredient_id -> storage_location overrides';



COMMENT ON COLUMN "public"."user_pantry_preferences"."staleness_threshold_days" IS 'Per-category thresholds for considering tracked items stale. Key by ingredient family. UI deferred to post-F&F; data collects during F&F for Path B readiness.';



CREATE TABLE IF NOT EXISTS "public"."user_recipe_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "preferred_view_mode" "text" DEFAULT 'clean'::"text",
    "show_section_times" boolean DEFAULT true,
    "auto_collapse_sections" boolean DEFAULT false,
    "highlight_annotations" boolean DEFAULT true,
    "preferred_scale" numeric DEFAULT 1.0,
    "hide_optional_steps" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_recipe_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_recipe_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."view_filters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "view_id" "uuid" NOT NULL,
    "dimension" "text" NOT NULL,
    "values" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "view_filters_dimension_check" CHECK (("dimension" = ANY (ARRAY['status'::"text", 'store'::"text", 'urgency'::"text", 'recipe'::"text", 'event'::"text", 'storage'::"text"])))
);


ALTER TABLE "public"."view_filters" OWNER TO "postgres";


COMMENT ON TABLE "public"."view_filters" IS 'Filter predicates for views. AND across dimensions; multi-value OR within dimension (Q16). Cross-dimension OR deferred (P8R-D2).';



COMMENT ON COLUMN "public"."view_filters"."dimension" IS '''status'' filters the row field directly. All others filter through need_tags/supply_tags joins.';



COMMENT ON COLUMN "public"."view_filters"."values" IS 'Array of values to match within this dimension. E.g. {''today'',''this-week''} for urgency; {''need''} for status.';



CREATE TABLE IF NOT EXISTS "public"."views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" DEFAULT '📋'::"text",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "render_mode" "text" DEFAULT 'aisle'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "views_render_mode_check" CHECK (("render_mode" = ANY (ARRAY['tier'::"text", 'aisle'::"text", 'flat'::"text"])))
);


ALTER TABLE "public"."views" OWNER TO "postgres";


COMMENT ON TABLE "public"."views" IS 'Saved filter expressions presented as "lists" in UI (Q2). Defaults non-deletable but hidable (Q19).';



COMMENT ON COLUMN "public"."views"."is_default" IS 'True for the 4 pre-baked views (Q19). Defaults cannot be deleted, only hidden.';



COMMENT ON COLUMN "public"."views"."render_mode" IS 'Tier = urgency grouping, Aisle = ingredients.typical_store_section grouping (Q29), Flat = no grouping (Q25).';



ALTER TABLE ONLY "public"."book_assembly_runs"
    ADD CONSTRAINT "book_assembly_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_content"
    ADD CONSTRAINT "book_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_page_scans"
    ADD CONSTRAINT "book_page_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."book_recipe_assembly"
    ADD CONSTRAINT "book_recipe_assembly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_isbn_key" UNIQUE ("isbn");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chefs"
    ADD CONSTRAINT "chefs_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."chefs"
    ADD CONSTRAINT "chefs_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."chefs"
    ADD CONSTRAINT "chefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("comment_id", "user_id");



ALTER TABLE ONLY "public"."cooking_sessions"
    ADD CONSTRAINT "cooking_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dish_courses"
    ADD CONSTRAINT "dish_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eater_ratings"
    ADD CONSTRAINT "eater_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eater_ratings"
    ADD CONSTRAINT "eater_ratings_post_id_rater_user_id_key" UNIQUE ("post_id", "rater_user_id");



ALTER TABLE ONLY "public"."extraction_corrections"
    ADD CONSTRAINT "extraction_corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."extraction_logs"
    ADD CONSTRAINT "extraction_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."friend_references"
    ADD CONSTRAINT "friend_references_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."friend_references"
    ADD CONSTRAINT "friend_references_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ingredient_category_rules"
    ADD CONSTRAINT "ingredient_category_rules_family_ingredient_type_key" UNIQUE ("family", "ingredient_type");



ALTER TABLE ONLY "public"."ingredient_category_rules"
    ADD CONSTRAINT "ingredient_category_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredient_common_units"
    ADD CONSTRAINT "ingredient_common_units_pkey" PRIMARY KEY ("ingredient_id", "unit_id");



ALTER TABLE ONLY "public"."ingredient_seasons"
    ADD CONSTRAINT "ingredient_seasons_ingredient_id_region_key" UNIQUE ("ingredient_id", "region");



ALTER TABLE ONLY "public"."ingredient_seasons"
    ADD CONSTRAINT "ingredient_seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredient_suggestions"
    ADD CONSTRAINT "ingredient_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instruction_sections"
    ADD CONSTRAINT "instruction_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instruction_steps"
    ADD CONSTRAINT "instruction_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_participants"
    ADD CONSTRAINT "meal_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_photos"
    ADD CONSTRAINT "meal_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_units"
    ADD CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_units"
    ADD CONSTRAINT "measurement_units_unit_key" UNIQUE ("unit");



ALTER TABLE ONLY "public"."need_tags"
    ADD CONSTRAINT "need_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."needs_recipes"
    ADD CONSTRAINT "needs_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."or_pattern_decisions"
    ADD CONSTRAINT "or_pattern_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_participants"
    ADD CONSTRAINT "post_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_participants"
    ADD CONSTRAINT "post_participants_post_id_participant_user_id_key" UNIQUE ("post_id", "participant_user_id");



ALTER TABLE ONLY "public"."post_relationships"
    ADD CONSTRAINT "post_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_relationships"
    ADD CONSTRAINT "post_relationships_post_id_1_post_id_2_relationship_type_key" UNIQUE ("post_id_1", "post_id_2", "relationship_type");



ALTER TABLE ONLY "public"."posts_backup_pre_7i"
    ADD CONSTRAINT "posts_backup_pre_7i_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_annotations"
    ADD CONSTRAINT "recipe_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_annotations"
    ADD CONSTRAINT "recipe_annotations_user_id_recipe_id_field_type_field_id_fi_key" UNIQUE ("user_id", "recipe_id", "field_type", "field_id", "field_index");



ALTER TABLE ONLY "public"."recipe_extraction_comparison"
    ADD CONSTRAINT "recipe_extraction_comparison_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_extraction_history"
    ADD CONSTRAINT "recipe_extraction_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_extraction_queue"
    ADD CONSTRAINT "recipe_extraction_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_extraction_test_snapshots"
    ADD CONSTRAINT "recipe_extraction_test_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_extraction_verification"
    ADD CONSTRAINT "recipe_extraction_verification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_extraction_verification"
    ADD CONSTRAINT "recipe_extraction_verification_queue_item_id_recipe_index_key" UNIQUE ("queue_item_id", "recipe_index");



ALTER TABLE ONLY "public"."recipe_image_mapping"
    ADD CONSTRAINT "recipe_image_mapping_filename_recipe_id_key" UNIQUE ("filename", "recipe_id");



ALTER TABLE ONLY "public"."recipe_image_mapping"
    ADD CONSTRAINT "recipe_image_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_media"
    ADD CONSTRAINT "recipe_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_photos"
    ADD CONSTRAINT "recipe_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_references"
    ADD CONSTRAINT "recipe_references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_source_notes"
    ADD CONSTRAINT "recipe_source_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_source_notes"
    ADD CONSTRAINT "recipe_source_notes_recipe_id_source_note_id_key" UNIQUE ("recipe_id", "source_note_id");



ALTER TABLE ONLY "public"."recipe_step_notes"
    ADD CONSTRAINT "recipe_step_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_step_notes"
    ADD CONSTRAINT "recipe_step_notes_user_id_recipe_id_step_number_key" UNIQUE ("user_id", "recipe_id", "step_number");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_settings"
    ADD CONSTRAINT "space_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_settings"
    ADD CONSTRAINT "space_settings_space_id_key" UNIQUE ("space_id");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplies"
    ADD CONSTRAINT "supplies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supply_lots"
    ADD CONSTRAINT "supply_lots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supply_tags"
    ADD CONSTRAINT "supply_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_extraction_queue"
    ADD CONSTRAINT "unique_book_filename_position" UNIQUE ("book_id", "filename", "extraction_position");



ALTER TABLE ONLY "public"."dish_courses"
    ADD CONSTRAINT "unique_dish_in_meal" UNIQUE ("dish_id", "meal_id");



ALTER TABLE ONLY "public"."view_filters"
    ADD CONSTRAINT "unique_filter_per_view_dimension" UNIQUE ("view_id", "dimension");



ALTER TABLE ONLY "public"."meal_participants"
    ADD CONSTRAINT "unique_meal_participant" UNIQUE ("meal_id", "user_id");



ALTER TABLE ONLY "public"."needs_recipes"
    ADD CONSTRAINT "unique_need_recipe" UNIQUE ("need_id", "recipe_id");



ALTER TABLE ONLY "public"."need_tags"
    ADD CONSTRAINT "unique_need_tag" UNIQUE ("need_id", "tag_id");



ALTER TABLE ONLY "public"."book_page_scans"
    ADD CONSTRAINT "unique_queue_page_side" UNIQUE ("queue_item_id", "page_side");



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "unique_space_member" UNIQUE ("space_id", "user_id");



ALTER TABLE ONLY "public"."supply_tags"
    ADD CONSTRAINT "unique_supply_tag" UNIQUE ("supply_id", "tag_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "unique_tag_per_space" UNIQUE ("space_id", "dimension", "value");



ALTER TABLE ONLY "public"."user_ingredient_preferences"
    ADD CONSTRAINT "unique_user_ingredient" UNIQUE ("user_id", "ingredient_id");



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "unique_user_recipe_tag" UNIQUE ("user_id", "recipe_id", "tag");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "unique_user_store_name" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."user_active_space"
    ADD CONSTRAINT "user_active_space_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_user_id_book_id_key" UNIQUE ("user_id", "book_id");



ALTER TABLE ONLY "public"."user_dietary_preferences"
    ADD CONSTRAINT "user_dietary_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_ingredient_choices"
    ADD CONSTRAINT "user_ingredient_choices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ingredient_preferences"
    ADD CONSTRAINT "user_ingredient_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_nutrition_goals"
    ADD CONSTRAINT "user_nutrition_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_nutrition_goals"
    ADD CONSTRAINT "user_nutrition_goals_user_id_nutrient_key" UNIQUE ("user_id", "nutrient");



ALTER TABLE ONLY "public"."user_pantry_preferences"
    ADD CONSTRAINT "user_pantry_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."user_recipe_preferences"
    ADD CONSTRAINT "user_recipe_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipe_preferences"
    ADD CONSTRAINT "user_recipe_preferences_user_id_recipe_id_key" UNIQUE ("user_id", "recipe_id");



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "user_recipe_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."view_filters"
    ADD CONSTRAINT "view_filters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."views"
    ADD CONSTRAINT "views_pkey" PRIMARY KEY ("id");



CREATE INDEX "books_chef_id_idx" ON "public"."books" USING "btree" ("chef_id");



CREATE INDEX "books_user_id_idx" ON "public"."books" USING "btree" ("user_id");



CREATE INDEX "idx_annotations_type" ON "public"."recipe_annotations" USING "btree" ("field_type");



CREATE INDEX "idx_annotations_user_recipe" ON "public"."recipe_annotations" USING "btree" ("user_id", "recipe_id");



CREATE UNIQUE INDEX "idx_assembly_runs_book_chunk" ON "public"."book_assembly_runs" USING "btree" ("book_id", "chunk_number");



CREATE INDEX "idx_assembly_runs_book_id" ON "public"."book_assembly_runs" USING "btree" ("book_id");



CREATE INDEX "idx_book_content_book_id" ON "public"."book_content" USING "btree" ("book_id");



CREATE INDEX "idx_book_content_page" ON "public"."book_content" USING "btree" ("book_id", "page_number_start");



CREATE INDEX "idx_book_content_type" ON "public"."book_content" USING "btree" ("content_type");



CREATE INDEX "idx_books_author" ON "public"."books" USING "btree" ("author") WHERE ("author" IS NOT NULL);



CREATE INDEX "idx_books_isbn" ON "public"."books" USING "btree" ("isbn") WHERE ("isbn" IS NOT NULL);



CREATE INDEX "idx_books_isbn13" ON "public"."books" USING "btree" ("isbn13") WHERE ("isbn13" IS NOT NULL);



CREATE INDEX "idx_books_title" ON "public"."books" USING "btree" ("title");



CREATE INDEX "idx_books_verified" ON "public"."books" USING "btree" ("is_verified") WHERE ("is_verified" = true);



CREATE INDEX "idx_comment_likes_comment_id" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_comparison_accuracy" ON "public"."recipe_extraction_comparison" USING "btree" ("overall_accuracy" DESC);



CREATE INDEX "idx_comparison_action" ON "public"."recipe_extraction_comparison" USING "btree" ("recommended_action");



CREATE INDEX "idx_comparison_created" ON "public"."recipe_extraction_comparison" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comparison_gold_standard" ON "public"."recipe_extraction_comparison" USING "btree" ("gold_standard_recipe_id");



CREATE INDEX "idx_comparison_queue_item" ON "public"."recipe_extraction_comparison" USING "btree" ("queue_item_id");



CREATE INDEX "idx_cooking_sessions_recipe" ON "public"."cooking_sessions" USING "btree" ("recipe_id", "user_id");



CREATE INDEX "idx_cooking_sessions_user" ON "public"."cooking_sessions" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_corrections_queue" ON "public"."extraction_corrections" USING "btree" ("queue_id");



CREATE INDEX "idx_corrections_type" ON "public"."extraction_corrections" USING "btree" ("correction_type");



CREATE INDEX "idx_dish_courses_course_type" ON "public"."dish_courses" USING "btree" ("course_type");



CREATE INDEX "idx_dish_courses_dish_id" ON "public"."dish_courses" USING "btree" ("dish_id");



CREATE INDEX "idx_dish_courses_meal_course" ON "public"."dish_courses" USING "btree" ("meal_id", "course_type", "course_order");



CREATE INDEX "idx_dish_courses_meal_course_order" ON "public"."dish_courses" USING "btree" ("meal_id", "course_type", "course_order");



CREATE INDEX "idx_dish_courses_meal_id" ON "public"."dish_courses" USING "btree" ("meal_id");



CREATE INDEX "idx_eater_ratings_post_id" ON "public"."eater_ratings" USING "btree" ("post_id");



CREATE INDEX "idx_eater_ratings_rater" ON "public"."eater_ratings" USING "btree" ("rater_user_id");



CREATE INDEX "idx_extraction_logs_created" ON "public"."extraction_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_extraction_logs_rating" ON "public"."extraction_logs" USING "btree" ("extraction_quality_rating") WHERE ("extraction_quality_rating" IS NOT NULL);



CREATE INDEX "idx_extraction_logs_recipe_id" ON "public"."extraction_logs" USING "btree" ("recipe_id") WHERE ("recipe_id" IS NOT NULL);



CREATE INDEX "idx_extraction_logs_user_id" ON "public"."extraction_logs" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_extraction_queue_book_order" ON "public"."recipe_extraction_queue" USING "btree" ("book_id", "processing_order");



CREATE INDEX "idx_extraction_queue_status" ON "public"."recipe_extraction_queue" USING "btree" ("status");



CREATE INDEX "idx_extraction_queue_user" ON "public"."recipe_extraction_queue" USING "btree" ("user_id");



CREATE INDEX "idx_follows_created_at" ON "public"."follows" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_follows_follower" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_follower_id" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_following" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "idx_follows_following_id" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "idx_history_book" ON "public"."recipe_extraction_history" USING "btree" ("book_id");



CREATE INDEX "idx_history_filename" ON "public"."recipe_extraction_history" USING "btree" ("filename");



CREATE INDEX "idx_history_test_run" ON "public"."recipe_extraction_history" USING "btree" ("test_run_id");



CREATE INDEX "idx_history_timestamp" ON "public"."recipe_extraction_history" USING "btree" ("test_run_timestamp" DESC);



CREATE INDEX "idx_history_version" ON "public"."recipe_extraction_history" USING "btree" ("extraction_version");



CREATE INDEX "idx_ingredient_seasons_region" ON "public"."ingredient_seasons" USING "btree" ("region");



CREATE INDEX "idx_ingredient_suggestions_status" ON "public"."ingredient_suggestions" USING "btree" ("status");



CREATE INDEX "idx_ingredient_units_ingredient" ON "public"."ingredient_common_units" USING "btree" ("ingredient_id");



CREATE INDEX "idx_ingredient_units_order" ON "public"."ingredient_common_units" USING "btree" ("ingredient_id", "display_order");



CREATE INDEX "idx_ingredients_created_by" ON "public"."ingredients" USING "btree" ("created_by") WHERE ("created_by" <> 'manual'::"text");



CREATE INDEX "idx_ingredients_name_lower" ON "public"."ingredients" USING "btree" ("lower"("name"));



CREATE INDEX "idx_ingredients_name_trgm" ON "public"."ingredients" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_ingredients_plural_lower" ON "public"."ingredients" USING "btree" ("lower"("plural_name")) WHERE ("plural_name" IS NOT NULL);



CREATE INDEX "idx_ingredients_plural_name_trgm" ON "public"."ingredients" USING "gin" ("plural_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_meal_dish_plans_assigned_to" ON "public"."meal_dish_plans" USING "btree" ("assigned_to") WHERE ("assigned_to" IS NOT NULL);



CREATE INDEX "idx_meal_dish_plans_claimed_by" ON "public"."meal_dish_plans" USING "btree" ("claimed_by") WHERE ("claimed_by" IS NOT NULL);



CREATE INDEX "idx_meal_dish_plans_logged_meal_post_id" ON "public"."meal_dish_plans" USING "btree" ("logged_meal_post_id") WHERE ("logged_meal_post_id" IS NOT NULL);



CREATE INDEX "idx_meal_dish_plans_meal_id" ON "public"."meal_dish_plans" USING "btree" ("meal_id");



CREATE INDEX "idx_meal_dish_plans_recipe_id" ON "public"."meal_dish_plans" USING "btree" ("recipe_id") WHERE ("recipe_id" IS NOT NULL);



CREATE INDEX "idx_meal_dish_plans_unclaimed" ON "public"."meal_dish_plans" USING "btree" ("meal_id") WHERE (("claimed_by" IS NULL) AND ("dish_id" IS NULL));



CREATE INDEX "idx_meal_participants_host" ON "public"."meal_participants" USING "btree" ("user_id") WHERE ("role" = 'host'::"text");



CREATE INDEX "idx_meal_participants_meal_id" ON "public"."meal_participants" USING "btree" ("meal_id");



CREATE INDEX "idx_meal_participants_meal_user" ON "public"."meal_participants" USING "btree" ("meal_id", "user_id");



CREATE INDEX "idx_meal_participants_role" ON "public"."meal_participants" USING "btree" ("role");



CREATE INDEX "idx_meal_participants_rsvp_status" ON "public"."meal_participants" USING "btree" ("rsvp_status");



CREATE INDEX "idx_meal_participants_user_id" ON "public"."meal_participants" USING "btree" ("user_id");



CREATE INDEX "idx_meal_participants_user_role" ON "public"."meal_participants" USING "btree" ("user_id", "role");



CREATE INDEX "idx_meal_photos_created_at" ON "public"."meal_photos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_meal_photos_meal_id" ON "public"."meal_photos" USING "btree" ("meal_id");



CREATE INDEX "idx_meal_photos_user_id" ON "public"."meal_photos" USING "btree" ("user_id");



CREATE INDEX "idx_measurement_units_sort" ON "public"."measurement_units" USING "btree" ("sort_order");



CREATE INDEX "idx_measurement_units_type" ON "public"."measurement_units" USING "btree" ("unit_type");



CREATE INDEX "idx_need_tags_need" ON "public"."need_tags" USING "btree" ("need_id");



CREATE INDEX "idx_need_tags_tag" ON "public"."need_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_needs_active" ON "public"."needs" USING "btree" ("space_id", "status") WHERE ("status" = ANY (ARRAY['need'::"text", 'in_cart'::"text"]));



CREATE INDEX "idx_needs_ingredient" ON "public"."needs" USING "btree" ("ingredient_id") WHERE ("ingredient_id" IS NOT NULL);



CREATE INDEX "idx_needs_recipes_need" ON "public"."needs_recipes" USING "btree" ("need_id");



CREATE INDEX "idx_needs_recipes_recipe" ON "public"."needs_recipes" USING "btree" ("recipe_id");



CREATE INDEX "idx_needs_space" ON "public"."needs" USING "btree" ("space_id");



CREATE INDEX "idx_needs_space_status" ON "public"."needs" USING "btree" ("space_id", "status");



CREATE INDEX "idx_needs_supply" ON "public"."needs" USING "btree" ("supply_id") WHERE ("supply_id" IS NOT NULL);



CREATE INDEX "idx_or_patterns_created" ON "public"."or_pattern_decisions" USING "btree" ("created_at");



CREATE INDEX "idx_or_patterns_equivalent" ON "public"."or_pattern_decisions" USING "btree" ("detected_as_equivalent");



CREATE INDEX "idx_or_patterns_options" ON "public"."or_pattern_decisions" USING "btree" ("option1_name", "option2_name");



CREATE INDEX "idx_page_scans_book_id" ON "public"."book_page_scans" USING "btree" ("book_id");



CREATE INDEX "idx_page_scans_page_number" ON "public"."book_page_scans" USING "btree" ("book_id", "page_number");



CREATE INDEX "idx_page_scans_page_type" ON "public"."book_page_scans" USING "btree" ("page_type");



CREATE INDEX "idx_post_comments_created_at" ON "public"."post_comments" USING "btree" ("created_at");



CREATE INDEX "idx_post_comments_post_id" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_comments_user_id" ON "public"."post_comments" USING "btree" ("user_id");



CREATE INDEX "idx_post_likes_created_at" ON "public"."post_likes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_post_likes_post_id" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_post_likes_user_id" ON "public"."post_likes" USING "btree" ("user_id");



CREATE INDEX "idx_post_participants_invited_by_user_id" ON "public"."post_participants" USING "btree" ("invited_by_user_id");



CREATE INDEX "idx_post_participants_participant_user_id" ON "public"."post_participants" USING "btree" ("participant_user_id");



CREATE INDEX "idx_post_participants_post" ON "public"."post_participants" USING "btree" ("post_id");



CREATE INDEX "idx_post_participants_post_id" ON "public"."post_participants" USING "btree" ("post_id");



CREATE INDEX "idx_post_participants_role" ON "public"."post_participants" USING "btree" ("role");



CREATE INDEX "idx_post_participants_status" ON "public"."post_participants" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_post_participants_user" ON "public"."post_participants" USING "btree" ("participant_user_id");



CREATE INDEX "idx_post_participants_user_id" ON "public"."post_participants" USING "btree" ("participant_user_id");



CREATE INDEX "idx_post_relationships_meal_group" ON "public"."post_relationships" USING "btree" ("relationship_type") WHERE ("relationship_type" = 'meal_group'::"text");



CREATE INDEX "idx_post_relationships_post1" ON "public"."post_relationships" USING "btree" ("post_id_1");



CREATE INDEX "idx_post_relationships_post2" ON "public"."post_relationships" USING "btree" ("post_id_2");



CREATE INDEX "idx_post_relationships_post_id_1" ON "public"."post_relationships" USING "btree" ("post_id_1");



CREATE INDEX "idx_post_relationships_post_id_2" ON "public"."post_relationships" USING "btree" ("post_id_2");



CREATE INDEX "idx_post_relationships_type" ON "public"."post_relationships" USING "btree" ("relationship_type");



CREATE INDEX "idx_posts_completed_meals" ON "public"."posts" USING "btree" ("created_at" DESC) WHERE (("post_type" = 'meal'::"text") AND ("meal_status" = 'completed'::"text"));



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_meal_status" ON "public"."posts" USING "btree" ("meal_status") WHERE ("post_type" = 'meal'::"text");



CREATE INDEX "idx_posts_meal_time" ON "public"."posts" USING "btree" ("meal_time") WHERE ("post_type" = 'meal'::"text");



CREATE INDEX "idx_posts_parent_meal" ON "public"."posts" USING "btree" ("parent_meal_id") WHERE ("parent_meal_id" IS NOT NULL);



CREATE INDEX "idx_posts_parent_meal_id" ON "public"."posts" USING "btree" ("parent_meal_id");



CREATE INDEX "idx_posts_planning_meals" ON "public"."posts" USING "btree" ("meal_time") WHERE (("post_type" = 'meal'::"text") AND ("meal_status" = 'planning'::"text"));



CREATE INDEX "idx_posts_post_type" ON "public"."posts" USING "btree" ("post_type");



CREATE INDEX "idx_posts_recipe_id" ON "public"."posts" USING "btree" ("recipe_id");



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_preferences_user_recipe" ON "public"."user_recipe_preferences" USING "btree" ("user_id", "recipe_id");



CREATE INDEX "idx_queue_pass3_confidence" ON "public"."recipe_extraction_queue" USING "btree" (((((("pass3_data" -> 'recipes'::"text") -> 0) ->> 'confidence'::"text"))::numeric)) WHERE ("pass3_data" IS NOT NULL);



CREATE INDEX "idx_queue_test_results" ON "public"."recipe_extraction_queue" USING "btree" ("extraction_version") WHERE ("extraction_version" ~~ 'v2%'::"text");



CREATE INDEX "idx_recipe_assembly_book_id" ON "public"."book_recipe_assembly" USING "btree" ("book_id");



CREATE UNIQUE INDEX "idx_recipe_assembly_book_title" ON "public"."book_recipe_assembly" USING "btree" ("book_id", "recipe_title");



CREATE INDEX "idx_recipe_assembly_pages" ON "public"."book_recipe_assembly" USING "btree" ("book_id", "start_page");



CREATE INDEX "idx_recipe_assembly_status" ON "public"."book_recipe_assembly" USING "btree" ("status");



CREATE INDEX "idx_recipe_assembly_title" ON "public"."book_recipe_assembly" USING "btree" ("recipe_title");



CREATE INDEX "idx_recipe_image_filename" ON "public"."recipe_image_mapping" USING "btree" ("filename");



CREATE INDEX "idx_recipe_image_recipe" ON "public"."recipe_image_mapping" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipe_ingredients_confidence" ON "public"."recipe_ingredients" USING "btree" ("match_confidence");



CREATE INDEX "idx_recipe_ingredients_ingredient_id" ON "public"."recipe_ingredients" USING "btree" ("ingredient_id");



CREATE INDEX "idx_recipe_ingredients_needs_review" ON "public"."recipe_ingredients" USING "btree" ("needs_review") WHERE ("needs_review" = true);



CREATE INDEX "idx_recipe_ingredients_recipe_id" ON "public"."recipe_ingredients" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipe_media_recipe_id" ON "public"."recipe_media" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipe_media_type" ON "public"."recipe_media" USING "btree" ("recipe_id", "media_type");



CREATE INDEX "idx_recipe_photos_recipe" ON "public"."recipe_photos" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipe_references_source" ON "public"."recipe_references" USING "btree" ("source_recipe_id");



CREATE INDEX "idx_recipe_references_target" ON "public"."recipe_references" USING "btree" ("referenced_recipe_id") WHERE ("referenced_recipe_id" IS NOT NULL);



CREATE INDEX "idx_recipe_references_unfulfilled" ON "public"."recipe_references" USING "btree" ("source_recipe_id", "is_fulfilled") WHERE ("is_fulfilled" = false);



CREATE INDEX "idx_recipe_source_notes_recipe" ON "public"."recipe_source_notes" USING "btree" ("recipe_id", "is_recommended" DESC, "source_created_at" DESC);



CREATE INDEX "idx_recipes_active_time" ON "public"."recipes" USING "btree" ((("prep_time_min" + "cook_time_min")));



CREATE INDEX "idx_recipes_ai_difficulty" ON "public"."recipes" USING "btree" ("ai_difficulty_level") WHERE ("ai_difficulty_level" IS NOT NULL);



CREATE INDEX "idx_recipes_book_id" ON "public"."recipes" USING "btree" ("book_id") WHERE ("book_id" IS NOT NULL);



CREATE INDEX "idx_recipes_book_page" ON "public"."recipes" USING "btree" ("book_id", "page_number") WHERE ("book_id" IS NOT NULL);



CREATE INDEX "idx_recipes_cooking_methods" ON "public"."recipes" USING "gin" ("cooking_methods");



CREATE INDEX "idx_recipes_cuisine_types" ON "public"."recipes" USING "gin" ("cuisine_types");



CREATE INDEX "idx_recipes_default_course" ON "public"."recipes" USING "btree" ("default_course");



CREATE INDEX "idx_recipes_difficulty" ON "public"."recipes" USING "btree" ("difficulty_level");



CREATE INDEX "idx_recipes_easier_than_looks" ON "public"."recipes" USING "btree" ("easier_than_looks");



CREATE INDEX "idx_recipes_gold_standard" ON "public"."recipes" USING "btree" ("is_gold_standard") WHERE ("is_gold_standard" = true);



CREATE INDEX "idx_recipes_raw_extraction_data" ON "public"."recipes" USING "gin" ("raw_extraction_data");



CREATE INDEX "idx_recipes_source_dedup" ON "public"."recipes" USING "btree" ("source_domain", "external_source_id") WHERE ("external_source_id" IS NOT NULL);



CREATE INDEX "idx_recipes_total_time" ON "public"."recipes" USING "btree" (((("prep_time_min" + "cook_time_min") + "inactive_time_min")));



CREATE INDEX "idx_recipes_user_id" ON "public"."recipes" USING "btree" ("user_id");



CREATE INDEX "idx_ri_ingredient_role" ON "public"."recipe_ingredients" USING "btree" ("ingredient_role") WHERE ("ingredient_role" <> 'core'::"text");



CREATE INDEX "idx_sections_order" ON "public"."instruction_sections" USING "btree" ("recipe_id", "section_order");



CREATE INDEX "idx_sections_recipe_id" ON "public"."instruction_sections" USING "btree" ("recipe_id");



CREATE INDEX "idx_space_members_space" ON "public"."space_members" USING "btree" ("space_id");



CREATE INDEX "idx_space_members_status" ON "public"."space_members" USING "btree" ("status");



CREATE INDEX "idx_space_members_user" ON "public"."space_members" USING "btree" ("user_id");



CREATE INDEX "idx_spaces_created_by" ON "public"."spaces" USING "btree" ("created_by");



CREATE INDEX "idx_step_notes_recipe" ON "public"."recipe_step_notes" USING "btree" ("recipe_id", "user_id");



CREATE INDEX "idx_steps_order" ON "public"."instruction_steps" USING "btree" ("section_id", "step_number");



CREATE INDEX "idx_steps_section_id" ON "public"."instruction_steps" USING "btree" ("section_id");



CREATE INDEX "idx_stores_name" ON "public"."stores" USING "btree" ("name");



CREATE INDEX "idx_stores_user_id" ON "public"."stores" USING "btree" ("user_id");



CREATE INDEX "idx_supplies_archived_at" ON "public"."supplies" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "idx_supplies_attention" ON "public"."supplies" USING "btree" ("space_id", "status") WHERE ("status" = ANY (ARRAY['out'::"text", 'low'::"text", 'critical'::"text"]));



CREATE INDEX "idx_supplies_ingredient" ON "public"."supplies" USING "btree" ("ingredient_id") WHERE ("ingredient_id" IS NOT NULL);



CREATE INDEX "idx_supplies_last_confirmed_at" ON "public"."supplies" USING "btree" ("last_confirmed_at");



CREATE INDEX "idx_supplies_priority_active" ON "public"."supplies" USING "btree" ("is_priority") WHERE (("is_priority" = true) AND ("archived_at" IS NULL));



CREATE INDEX "idx_supplies_search_vector" ON "public"."supplies" USING "gin" ("search_vector");



CREATE INDEX "idx_supplies_space" ON "public"."supplies" USING "btree" ("space_id");



CREATE INDEX "idx_supplies_status" ON "public"."supplies" USING "btree" ("space_id", "status");



CREATE INDEX "idx_supplies_tracking_mode_active" ON "public"."supplies" USING "btree" ("tracking_mode") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_supplies_tracks_lots_active" ON "public"."supplies" USING "btree" ("tracks_lots") WHERE (("tracks_lots" = true) AND ("archived_at" IS NULL));



CREATE INDEX "idx_supply_lots_expires_active" ON "public"."supply_lots" USING "btree" ("expires_at") WHERE (("consumed_at" IS NULL) AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_supply_lots_search_vector" ON "public"."supply_lots" USING "gin" ("search_vector");



CREATE INDEX "idx_supply_lots_storage_active" ON "public"."supply_lots" USING "btree" ("storage_location") WHERE ("consumed_at" IS NULL);



CREATE INDEX "idx_supply_lots_supply_active" ON "public"."supply_lots" USING "btree" ("supply_id") WHERE ("consumed_at" IS NULL);



CREATE INDEX "idx_supply_tags_supply" ON "public"."supply_tags" USING "btree" ("supply_id");



CREATE INDEX "idx_supply_tags_tag" ON "public"."supply_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_tags_space" ON "public"."tags" USING "btree" ("space_id");



CREATE INDEX "idx_tags_space_dimension" ON "public"."tags" USING "btree" ("space_id", "dimension");



CREATE INDEX "idx_test_results_run1" ON "public"."recipe_extraction_queue" USING "btree" ((("test_results_run1" IS NOT NULL)));



CREATE INDEX "idx_test_results_run2" ON "public"."recipe_extraction_queue" USING "btree" ((("test_results_run2" IS NOT NULL)));



CREATE INDEX "idx_test_results_run3" ON "public"."recipe_extraction_queue" USING "btree" ((("test_results_run3" IS NOT NULL)));



CREATE INDEX "idx_test_results_run4" ON "public"."recipe_extraction_queue" USING "btree" ((("test_results_run4" IS NOT NULL)));



CREATE INDEX "idx_user_books_book_id" ON "public"."user_books" USING "btree" ("book_id");



CREATE INDEX "idx_user_books_ownership" ON "public"."user_books" USING "btree" ("user_id", "ownership_claimed");



CREATE INDEX "idx_user_books_user_id" ON "public"."user_books" USING "btree" ("user_id");



CREATE INDEX "idx_user_prefs" ON "public"."user_pantry_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_prefs_ingredient_id" ON "public"."user_ingredient_preferences" USING "btree" ("ingredient_id");



CREATE INDEX "idx_user_prefs_store_id" ON "public"."user_ingredient_preferences" USING "btree" ("preferred_store_id");



CREATE INDEX "idx_user_prefs_user_id" ON "public"."user_ingredient_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_recipe_tags_recipe" ON "public"."user_recipe_tags" USING "btree" ("recipe_id");



CREATE INDEX "idx_user_recipe_tags_user_tag" ON "public"."user_recipe_tags" USING "btree" ("user_id", "tag");



CREATE INDEX "idx_verification_confidence" ON "public"."recipe_extraction_verification" USING "btree" ("overall_confidence");



CREATE INDEX "idx_verification_conflicts" ON "public"."recipe_extraction_verification" USING "btree" ("conflicts_found", "conflicts_resolved");



CREATE INDEX "idx_verification_gold_standard_accuracy" ON "public"."recipe_extraction_verification" USING "btree" ("gold_standard_accuracy") WHERE ("gold_standard_accuracy" IS NOT NULL);



CREATE INDEX "idx_verification_queue_item" ON "public"."recipe_extraction_verification" USING "btree" ("queue_item_id");



CREATE INDEX "idx_verification_status" ON "public"."recipe_extraction_verification" USING "btree" ("status");



CREATE INDEX "idx_view_filters_view" ON "public"."view_filters" USING "btree" ("view_id");



CREATE INDEX "idx_views_space" ON "public"."views" USING "btree" ("space_id");



CREATE INDEX "idx_views_space_default" ON "public"."views" USING "btree" ("space_id", "is_default") WHERE ("is_default" = true);



CREATE UNIQUE INDEX "one_default_per_ingredient" ON "public"."ingredient_common_units" USING "btree" ("ingredient_id") WHERE ("is_default" = true);



CREATE INDEX "posts_backup_pre_7i_created_at_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("created_at" DESC);



CREATE INDEX "posts_backup_pre_7i_created_at_idx1" ON "public"."posts_backup_pre_7i" USING "btree" ("created_at" DESC) WHERE (("post_type" = 'meal'::"text") AND ("meal_status" = 'completed'::"text"));



CREATE INDEX "posts_backup_pre_7i_meal_status_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("meal_status") WHERE ("post_type" = 'meal'::"text");



CREATE INDEX "posts_backup_pre_7i_meal_time_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("meal_time") WHERE ("post_type" = 'meal'::"text");



CREATE INDEX "posts_backup_pre_7i_meal_time_idx1" ON "public"."posts_backup_pre_7i" USING "btree" ("meal_time") WHERE (("post_type" = 'meal'::"text") AND ("meal_status" = 'planning'::"text"));



CREATE INDEX "posts_backup_pre_7i_parent_meal_id_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("parent_meal_id") WHERE ("parent_meal_id" IS NOT NULL);



CREATE INDEX "posts_backup_pre_7i_parent_meal_id_idx1" ON "public"."posts_backup_pre_7i" USING "btree" ("parent_meal_id");



CREATE INDEX "posts_backup_pre_7i_post_type_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("post_type");



CREATE INDEX "posts_backup_pre_7i_recipe_id_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("recipe_id");



CREATE INDEX "posts_backup_pre_7i_user_id_idx" ON "public"."posts_backup_pre_7i" USING "btree" ("user_id");



CREATE UNIQUE INDEX "recipe_nutrition_computed_recipe_id_idx" ON "public"."recipe_nutrition_computed" USING "btree" ("recipe_id");



CREATE UNIQUE INDEX "supplies_uniq_active_customname" ON "public"."supplies" USING "btree" ("space_id", "lower"(TRIM(BOTH FROM "custom_name"))) WHERE (("archived_at" IS NULL) AND ("ingredient_id" IS NULL) AND ("custom_name" IS NOT NULL) AND (TRIM(BOTH FROM "custom_name") <> ''::"text"));



CREATE UNIQUE INDEX "supplies_uniq_active_ingredient" ON "public"."supplies" USING "btree" ("space_id", "ingredient_id") WHERE (("archived_at" IS NULL) AND ("ingredient_id" IS NOT NULL));



CREATE OR REPLACE TRIGGER "books_updated_at" BEFORE UPDATE ON "public"."books" FOR EACH ROW EXECUTE FUNCTION "public"."update_books_updated_at"();



CREATE OR REPLACE TRIGGER "check_reference_fulfillment" AFTER INSERT ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "public"."mark_reference_fulfilled"();



CREATE OR REPLACE TRIGGER "create_default_pantry_preferences_trigger" AFTER INSERT ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_pantry_preferences"();



CREATE OR REPLACE TRIGGER "trg_needs_updated_at" BEFORE UPDATE ON "public"."needs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supplies_refresh_on_ingredient_change" AFTER UPDATE ON "public"."ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."supplies_refresh_on_ingredient_change"();



CREATE OR REPLACE TRIGGER "trg_supplies_refresh_on_supply_tag_change" AFTER INSERT OR DELETE ON "public"."supply_tags" FOR EACH ROW EXECUTE FUNCTION "public"."supplies_refresh_on_supply_tag_change"();



CREATE OR REPLACE TRIGGER "trg_supplies_search_vector" BEFORE INSERT OR UPDATE OF "custom_name", "ingredient_id" ON "public"."supplies" FOR EACH ROW EXECUTE FUNCTION "public"."supplies_search_vector_trigger"();



CREATE OR REPLACE TRIGGER "trg_supplies_updated_at" BEFORE UPDATE ON "public"."supplies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supply_lots_search_vector" BEFORE INSERT OR UPDATE OF "variant_label", "brand", "notes", "storage_location" ON "public"."supply_lots" FOR EACH ROW EXECUTE FUNCTION "public"."supply_lots_search_vector_trigger"();



CREATE OR REPLACE TRIGGER "trg_supply_lots_updated_at" BEFORE UPDATE ON "public"."supply_lots" FOR EACH ROW EXECUTE FUNCTION "public"."set_supply_lots_updated_at"();



CREATE OR REPLACE TRIGGER "trg_views_updated_at" BEFORE UPDATE ON "public"."views" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_meal_dish_plans_updated_at" BEFORE UPDATE ON "public"."meal_dish_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_meal_dish_plans_updated_at"();



CREATE OR REPLACE TRIGGER "update_follow_counts_trigger" AFTER INSERT OR DELETE ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."update_follow_counts"();



CREATE OR REPLACE TRIGGER "update_post_comments_updated_at" BEFORE UPDATE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recipe_count_delete" AFTER DELETE ON "public"."recipes" FOR EACH ROW WHEN (("old"."book_id" IS NOT NULL)) EXECUTE FUNCTION "public"."update_user_books_recipe_count"();



CREATE OR REPLACE TRIGGER "update_recipe_count_insert" AFTER INSERT ON "public"."recipes" FOR EACH ROW WHEN (("new"."book_id" IS NOT NULL)) EXECUTE FUNCTION "public"."update_user_books_recipe_count"();



CREATE OR REPLACE TRIGGER "update_recipe_ingredients_updated_at" BEFORE UPDATE ON "public"."recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stores_updated_at" BEFORE UPDATE ON "public"."stores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_dietary_preferences_updated_at" BEFORE UPDATE ON "public"."user_dietary_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_pantry_preferences_updated_at" BEFORE UPDATE ON "public"."user_pantry_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_prefs_updated_at" BEFORE UPDATE ON "public"."user_ingredient_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."book_assembly_runs"
    ADD CONSTRAINT "book_assembly_runs_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_content"
    ADD CONSTRAINT "book_content_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_content"
    ADD CONSTRAINT "book_content_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."book_page_scans"
    ADD CONSTRAINT "book_page_scans_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."book_page_scans"
    ADD CONSTRAINT "book_page_scans_queue_item_id_fkey" FOREIGN KEY ("queue_item_id") REFERENCES "public"."recipe_extraction_queue"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."book_recipe_assembly"
    ADD CONSTRAINT "book_recipe_assembly_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cooking_sessions"
    ADD CONSTRAINT "cooking_sessions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."cooking_sessions"
    ADD CONSTRAINT "cooking_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dish_courses"
    ADD CONSTRAINT "dish_courses_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dish_courses"
    ADD CONSTRAINT "dish_courses_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eater_ratings"
    ADD CONSTRAINT "eater_ratings_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eater_ratings"
    ADD CONSTRAINT "eater_ratings_rater_user_id_fkey" FOREIGN KEY ("rater_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."extraction_corrections"
    ADD CONSTRAINT "extraction_corrections_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."recipe_extraction_queue"("id");



ALTER TABLE ONLY "public"."extraction_corrections"
    ADD CONSTRAINT "extraction_corrections_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."extraction_logs"
    ADD CONSTRAINT "extraction_logs_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."extraction_logs"
    ADD CONSTRAINT "extraction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingredient_seasons"
    ADD CONSTRAINT "fk_ingredient_seasons_region" FOREIGN KEY ("region") REFERENCES "public"."regions"("slug");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_common_units"
    ADD CONSTRAINT "ingredient_common_units_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_common_units"
    ADD CONSTRAINT "ingredient_common_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."measurement_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_seasons"
    ADD CONSTRAINT "ingredient_seasons_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."ingredient_suggestions"
    ADD CONSTRAINT "ingredient_suggestions_matched_ingredient_id_fkey" FOREIGN KEY ("matched_ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."ingredient_suggestions"
    ADD CONSTRAINT "ingredient_suggestions_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."recipe_extraction_queue"("id");



ALTER TABLE ONLY "public"."ingredient_suggestions"
    ADD CONSTRAINT "ingredient_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_base_ingredient_id_fkey" FOREIGN KEY ("base_ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."instruction_sections"
    ADD CONSTRAINT "instruction_sections_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."instruction_steps"
    ADD CONSTRAINT "instruction_steps_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."instruction_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_logged_meal_post_id_fkey" FOREIGN KEY ("logged_meal_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_dish_plans"
    ADD CONSTRAINT "meal_dish_plans_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_participants"
    ADD CONSTRAINT "meal_participants_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_participants"
    ADD CONSTRAINT "meal_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_photos"
    ADD CONSTRAINT "meal_photos_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_photos"
    ADD CONSTRAINT "meal_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."need_tags"
    ADD CONSTRAINT "need_tags_need_id_fkey" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."need_tags"
    ADD CONSTRAINT "need_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."needs_recipes"
    ADD CONSTRAINT "needs_recipes_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."needs_recipes"
    ADD CONSTRAINT "needs_recipes_need_id_fkey" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."needs_recipes"
    ADD CONSTRAINT "needs_recipes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."needs"
    ADD CONSTRAINT "needs_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."or_pattern_decisions"
    ADD CONSTRAINT "or_pattern_decisions_option1_ingredient_id_fkey" FOREIGN KEY ("option1_ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."or_pattern_decisions"
    ADD CONSTRAINT "or_pattern_decisions_option2_ingredient_id_fkey" FOREIGN KEY ("option2_ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."or_pattern_decisions"
    ADD CONSTRAINT "or_pattern_decisions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_participants"
    ADD CONSTRAINT "post_participants_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_participants"
    ADD CONSTRAINT "post_participants_participant_user_id_fkey" FOREIGN KEY ("participant_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_participants"
    ADD CONSTRAINT "post_participants_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_relationships"
    ADD CONSTRAINT "post_relationships_post_id_1_fkey" FOREIGN KEY ("post_id_1") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_relationships"
    ADD CONSTRAINT "post_relationships_post_id_2_fkey" FOREIGN KEY ("post_id_2") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_parent_meal_id_fkey" FOREIGN KEY ("parent_meal_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_annotations"
    ADD CONSTRAINT "recipe_annotations_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_annotations"
    ADD CONSTRAINT "recipe_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_extraction_comparison"
    ADD CONSTRAINT "recipe_extraction_comparison_gold_standard_recipe_id_fkey" FOREIGN KEY ("gold_standard_recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."recipe_extraction_comparison"
    ADD CONSTRAINT "recipe_extraction_comparison_queue_item_id_fkey" FOREIGN KEY ("queue_item_id") REFERENCES "public"."recipe_extraction_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_extraction_queue"
    ADD CONSTRAINT "recipe_extraction_queue_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id");



ALTER TABLE ONLY "public"."recipe_extraction_queue"
    ADD CONSTRAINT "recipe_extraction_queue_continues_from_queue_id_fkey" FOREIGN KEY ("continues_from_queue_id") REFERENCES "public"."recipe_extraction_queue"("id");



ALTER TABLE ONLY "public"."recipe_extraction_queue"
    ADD CONSTRAINT "recipe_extraction_queue_merged_into_recipe_id_fkey" FOREIGN KEY ("merged_into_recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."recipe_extraction_queue"
    ADD CONSTRAINT "recipe_extraction_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."recipe_extraction_verification"
    ADD CONSTRAINT "recipe_extraction_verification_queue_item_id_fkey" FOREIGN KEY ("queue_item_id") REFERENCES "public"."recipe_extraction_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_image_mapping"
    ADD CONSTRAINT "recipe_image_mapping_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_media"
    ADD CONSTRAINT "recipe_media_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_photos"
    ADD CONSTRAINT "recipe_photos_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_photos"
    ADD CONSTRAINT "recipe_photos_source_queue_id_fkey" FOREIGN KEY ("source_queue_id") REFERENCES "public"."recipe_extraction_queue"("id");



ALTER TABLE ONLY "public"."recipe_references"
    ADD CONSTRAINT "recipe_references_referenced_recipe_id_fkey" FOREIGN KEY ("referenced_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recipe_references"
    ADD CONSTRAINT "recipe_references_source_recipe_id_fkey" FOREIGN KEY ("source_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_source_notes"
    ADD CONSTRAINT "recipe_source_notes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_step_notes"
    ADD CONSTRAINT "recipe_step_notes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_step_notes"
    ADD CONSTRAINT "recipe_step_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_gold_standard_verified_by_fkey" FOREIGN KEY ("gold_standard_verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_settings"
    ADD CONSTRAINT "space_settings_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplies"
    ADD CONSTRAINT "supplies_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplies"
    ADD CONSTRAINT "supplies_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplies"
    ADD CONSTRAINT "supplies_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supply_lots"
    ADD CONSTRAINT "supply_lots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supply_lots"
    ADD CONSTRAINT "supply_lots_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supply_tags"
    ADD CONSTRAINT "supply_tags_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supply_tags"
    ADD CONSTRAINT "supply_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_active_space"
    ADD CONSTRAINT "user_active_space_active_space_id_fkey" FOREIGN KEY ("active_space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_active_space"
    ADD CONSTRAINT "user_active_space_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_books"
    ADD CONSTRAINT "user_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dietary_preferences"
    ADD CONSTRAINT "user_dietary_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ingredient_choices"
    ADD CONSTRAINT "user_ingredient_choices_chosen_ingredient_id_fkey" FOREIGN KEY ("chosen_ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "public"."user_ingredient_choices"
    ADD CONSTRAINT "user_ingredient_choices_recipe_ingredient_id_fkey" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "public"."recipe_ingredients"("id");



ALTER TABLE ONLY "public"."user_ingredient_choices"
    ADD CONSTRAINT "user_ingredient_choices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."user_ingredient_preferences"
    ADD CONSTRAINT "user_ingredient_preferences_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ingredient_preferences"
    ADD CONSTRAINT "user_ingredient_preferences_preferred_store_id_fkey" FOREIGN KEY ("preferred_store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_ingredient_preferences"
    ADD CONSTRAINT "user_ingredient_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_nutrition_goals"
    ADD CONSTRAINT "user_nutrition_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_pantry_preferences"
    ADD CONSTRAINT "user_pantry_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_preferences"
    ADD CONSTRAINT "user_recipe_preferences_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_preferences"
    ADD CONSTRAINT "user_recipe_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "user_recipe_tags_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipe_tags"
    ADD CONSTRAINT "user_recipe_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."view_filters"
    ADD CONSTRAINT "view_filters_view_id_fkey" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."views"
    ADD CONSTRAINT "views_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."views"
    ADD CONSTRAINT "views_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous insert for migration" ON "public"."recipe_ingredients" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anonymous read" ON "public"."recipe_ingredients" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anyone can create spaces" ON "public"."spaces" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Anyone can read comment likes" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can read comments" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view instruction sections" ON "public"."instruction_sections" FOR SELECT USING (true);



CREATE POLICY "Anyone can view instruction steps" ON "public"."instruction_steps" FOR SELECT USING (true);



CREATE POLICY "Anyone can view likes" ON "public"."post_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view post relationships" ON "public"."post_relationships" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create comments" ON "public"."post_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert books" ON "public"."books" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can like comments" ON "public"."comment_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can read category rules" ON "public"."ingredient_category_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Books are viewable by everyone" ON "public"."books" FOR SELECT USING (true);



CREATE POLICY "Delete own spaces" ON "public"."spaces" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Host can add plan items" ON "public"."meal_dish_plans" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meal_participants" "mp"
  WHERE (("mp"."meal_id" = "meal_dish_plans"."meal_id") AND ("mp"."user_id" = "auth"."uid"()) AND ("mp"."role" = 'host'::"text")))));



CREATE POLICY "Host can delete plan items" ON "public"."meal_dish_plans" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."meal_participants" "mp"
  WHERE (("mp"."meal_id" = "meal_dish_plans"."meal_id") AND ("mp"."user_id" = "auth"."uid"()) AND ("mp"."role" = 'host'::"text")))));



CREATE POLICY "Host or claimer can update plan items" ON "public"."meal_dish_plans" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."meal_participants" "mp"
  WHERE (("mp"."meal_id" = "meal_dish_plans"."meal_id") AND ("mp"."user_id" = "auth"."uid"()) AND ("mp"."role" = 'host'::"text")))) OR ("claimed_by" = "auth"."uid"())));



CREATE POLICY "Invite to spaces" ON "public"."space_members" FOR INSERT WITH CHECK (("space_id" IN ( SELECT "public"."get_user_space_ids"("auth"."uid"()) AS "get_user_space_ids")));



CREATE POLICY "Leave space" ON "public"."space_members" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Owners can manage space settings" ON "public"."space_settings" USING (("space_id" IN ( SELECT "space_members"."space_id"
   FROM "public"."space_members"
  WHERE (("space_members"."user_id" = "auth"."uid"()) AND ("space_members"."role" = 'owner'::"text") AND ("space_members"."status" = 'accepted'::"text")))));



CREATE POLICY "Owners remove members" ON "public"."space_members" FOR DELETE USING (("space_id" IN ( SELECT "space_members_1"."space_id"
   FROM "public"."space_members" "space_members_1"
  WHERE (("space_members_1"."user_id" = "auth"."uid"()) AND ("space_members_1"."role" = 'owner'::"text") AND ("space_members_1"."status" = 'accepted'::"text")))));



CREATE POLICY "Owners update memberships" ON "public"."space_members" FOR UPDATE USING (("space_id" IN ( SELECT "space_members_1"."space_id"
   FROM "public"."space_members" "space_members_1"
  WHERE (("space_members_1"."user_id" = "auth"."uid"()) AND ("space_members_1"."role" = 'owner'::"text") AND ("space_members_1"."status" = 'accepted'::"text")))));



CREATE POLICY "Participants can update their own status" ON "public"."post_participants" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "participant_user_id")) WITH CHECK (("auth"."uid"() = "participant_user_id"));



CREATE POLICY "Post authors can read ratings on their posts" ON "public"."eater_ratings" FOR SELECT USING (("post_id" IN ( SELECT "posts"."id"
   FROM "public"."posts"
  WHERE ("posts"."user_id" = "auth"."uid"()))));



CREATE POLICY "Post owners can create relationships" ON "public"."post_relationships" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IN ( SELECT "posts"."user_id"
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_relationships"."post_id_1") OR ("posts"."id" = "post_relationships"."post_id_2")))));



CREATE POLICY "Post owners can invite participants" ON "public"."post_participants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IN ( SELECT "posts"."user_id"
   FROM "public"."posts"
  WHERE ("posts"."id" = "post_participants"."post_id"))));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Public recipes are viewable by everyone" ON "public"."recipes" FOR SELECT USING ((("is_public" = true) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Recipe ingredients are viewable by everyone" ON "public"."recipe_ingredients" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Recipe ingredients modifiable by recipe owner" ON "public"."recipe_ingredients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_ingredients"."recipe_id") AND ("recipes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Recipe media follows recipe visibility" ON "public"."recipe_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_media"."recipe_id") AND (("recipes"."is_public" = true) OR ("recipes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Recipe owner can manage sections" ON "public"."instruction_sections" USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "instruction_sections"."recipe_id") AND ("recipes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Recipe owner can manage steps" ON "public"."instruction_steps" USING ((EXISTS ( SELECT 1
   FROM ("public"."instruction_sections" "s"
     JOIN "public"."recipes" "r" ON (("r"."id" = "s"."recipe_id")))
  WHERE (("s"."id" = "instruction_steps"."section_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Recipe references follow recipe visibility" ON "public"."recipe_references" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_references"."source_recipe_id") AND (("recipes"."is_public" = true) OR ("recipes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Update own membership" ON "public"."space_members" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Update own spaces" ON "public"."spaces" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can add participants to their own posts" ON "public"."post_participants" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_participants"."post_id") AND ("posts"."user_id" = "auth"."uid"())))) AND ("invited_by_user_id" = "auth"."uid"())));



CREATE POLICY "Users can create own posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create recipes" ON "public"."recipes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create relationships for their own posts" ON "public"."post_relationships" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_relationships"."post_id_1") AND ("posts"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_relationships"."post_id_2") AND ("posts"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create their own likes" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete book content for books they own" ON "public"."book_content" FOR DELETE USING (("book_id" IN ( SELECT "books"."id"
   FROM "public"."books"
  WHERE ("books"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own goals" ON "public"."user_nutrition_goals" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own ratings" ON "public"."eater_ratings" FOR DELETE USING (("rater_user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own tags" ON "public"."user_recipe_tags" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete relationships for their own posts" ON "public"."post_relationships" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_relationships"."post_id_1") AND ("posts"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_relationships"."post_id_2") AND ("posts"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete their own comments" ON "public"."post_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own likes" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own stores" ON "public"."stores" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert book content for books they own" ON "public"."book_content" FOR INSERT WITH CHECK (("book_id" IN ( SELECT "books"."id"
   FROM "public"."books"
  WHERE ("books"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own dietary preferences" ON "public"."user_dietary_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own goals" ON "public"."user_nutrition_goals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_pantry_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own ratings" ON "public"."eater_ratings" FOR INSERT WITH CHECK (("rater_user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own tags" ON "public"."user_recipe_tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own books" ON "public"."user_books" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own extraction logs" ON "public"."extraction_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own stores" ON "public"."stores" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage media for their recipes" ON "public"."recipe_media" USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_media"."recipe_id") AND ("recipes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage references for their recipes" ON "public"."recipe_references" USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_references"."source_recipe_id") AND ("recipes"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own annotations" ON "public"."recipe_annotations" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own preferences" ON "public"."user_ingredient_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own preferences" ON "public"."user_recipe_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own dietary preferences" ON "public"."user_dietary_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own goals" ON "public"."user_nutrition_goals" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own ratings" ON "public"."eater_ratings" FOR SELECT USING (("rater_user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can remove participants from their own posts" ON "public"."post_participants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "post_participants"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can unfollow" ON "public"."follows" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can unlike comments" ON "public"."comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update book content for books they own" ON "public"."book_content" FOR UPDATE USING (("book_id" IN ( SELECT "books"."id"
   FROM "public"."books"
  WHERE ("books"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update books they added" ON "public"."books" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_books"."user_id"
   FROM "public"."user_books"
  WHERE ("user_books"."book_id" = "books"."id"))));



CREATE POLICY "Users can update meal_dish_plans" ON "public"."meal_dish_plans" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."meal_participants"
  WHERE (("meal_participants"."meal_id" = "meal_dish_plans"."meal_id") AND ("meal_participants"."user_id" = "auth"."uid"()) AND ("meal_participants"."role" = 'host'::"text")))) OR ("claimed_by" = "auth"."uid"()) OR (("assigned_to" = "auth"."uid"()) AND ("claimed_by" IS NULL)) OR (("claimed_by" IS NULL) AND ("assigned_to" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meal_participants"
  WHERE (("meal_participants"."meal_id" = "meal_dish_plans"."meal_id") AND ("meal_participants"."user_id" = "auth"."uid"()) AND ("meal_participants"."rsvp_status" = 'accepted'::"text")))))));



CREATE POLICY "Users can update own dietary preferences" ON "public"."user_dietary_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own goals" ON "public"."user_nutrition_goals" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own posts" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences" ON "public"."user_pantry_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own ratings" ON "public"."eater_ratings" FOR UPDATE USING (("rater_user_id" = "auth"."uid"())) WITH CHECK (("rater_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own recipes" ON "public"."recipes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own books" ON "public"."user_books" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."post_comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own extraction logs" ON "public"."extraction_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own participant status" ON "public"."post_participants" FOR UPDATE USING (("auth"."uid"() = "participant_user_id")) WITH CHECK (("auth"."uid"() = "participant_user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own stores" ON "public"."stores" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view book content for books they own" ON "public"."book_content" FOR SELECT USING (("book_id" IN ( SELECT "books"."id"
   FROM "public"."books"
  WHERE ("books"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view meal plan items" ON "public"."meal_dish_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."meal_participants" "mp"
  WHERE (("mp"."meal_id" = "meal_dish_plans"."meal_id") AND ("mp"."rsvp_status" = ANY (ARRAY['accepted'::"text", 'maybe'::"text"]))))));



CREATE POLICY "Users can view own preferences" ON "public"."user_pantry_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own tags" ON "public"."user_recipe_tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view participants of their posts or posts they partic" ON "public"."post_participants" FOR SELECT USING ((("auth"."uid"() = "invited_by_user_id") OR ("auth"."uid"() = "participant_user_id") OR (("status" = 'approved'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_participants"."post_id") AND ("p"."user_id" IN ( SELECT "follows"."following_id"
           FROM "public"."follows"
          WHERE ("follows"."follower_id" = "auth"."uid"())))))) AND ("participant_user_id" IN ( SELECT "follows"."following_id"
   FROM "public"."follows"
  WHERE ("follows"."follower_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view post relationships" ON "public"."post_relationships" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."posts" "p1"
  WHERE (("p1"."id" = "post_relationships"."post_id_1") AND (("p1"."user_id" = "auth"."uid"()) OR ("p1"."user_id" IN ( SELECT "follows"."following_id"
           FROM "public"."follows"
          WHERE ("follows"."follower_id" = "auth"."uid"()))))))) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p2"
  WHERE (("p2"."id" = "post_relationships"."post_id_2") AND (("p2"."user_id" = "auth"."uid"()) OR ("p2"."user_id" IN ( SELECT "follows"."following_id"
           FROM "public"."follows"
          WHERE ("follows"."follower_id" = "auth"."uid"())))))))));



CREATE POLICY "Users can view posts from people they follow or their own" ON "public"."posts" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("user_id" IN ( SELECT "follows"."following_id"
   FROM "public"."follows"
  WHERE ("follows"."follower_id" = "auth"."uid"())))));



CREATE POLICY "Users can view space settings" ON "public"."space_settings" FOR SELECT USING (("space_id" IN ( SELECT "space_members"."space_id"
   FROM "public"."space_members"
  WHERE (("space_members"."user_id" = "auth"."uid"()) AND ("space_members"."status" = 'accepted'::"text")))));



CREATE POLICY "Users can view their follows" ON "public"."follows" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "follower_id") OR ("auth"."uid"() = "following_id")));



CREATE POLICY "Users can view their own annotations" ON "public"."recipe_annotations" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own books" ON "public"."user_books" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own extraction logs" ON "public"."extraction_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own participant records" ON "public"."post_participants" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "participant_user_id") OR ("auth"."uid"() = "invited_by_user_id") OR ("auth"."uid"() IN ( SELECT "posts"."user_id"
   FROM "public"."posts"
  WHERE ("posts"."id" = "post_participants"."post_id")))));



CREATE POLICY "Users can view their own preferences" ON "public"."user_recipe_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own stores" ON "public"."stores" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own cooking sessions" ON "public"."cooking_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own nutrition goals" ON "public"."user_nutrition_goals" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own step notes" ON "public"."recipe_step_notes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own active space" ON "public"."user_active_space" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "View own memberships" ON "public"."space_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "View own spaces" ON "public"."spaces" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR ("id" IN ( SELECT "public"."get_user_space_ids"("auth"."uid"()) AS "get_user_space_ids"))));



CREATE POLICY "View space memberships" ON "public"."space_members" FOR SELECT USING (("space_id" IN ( SELECT "public"."get_user_space_ids"("auth"."uid"()) AS "get_user_space_ids")));



ALTER TABLE "public"."book_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cooking_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eater_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."extraction_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredient_category_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ingredients_read_authenticated" ON "public"."ingredients" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."instruction_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instruction_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_dish_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."need_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "need_tags_delete" ON "public"."need_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "need_tags"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "need_tags_insert" ON "public"."need_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "need_tags"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "need_tags_select" ON "public"."need_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "need_tags"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "need_tags_update" ON "public"."need_tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "need_tags"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."needs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "needs_delete" ON "public"."needs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "needs"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "needs_insert" ON "public"."needs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "needs"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."needs_recipes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "needs_recipes_delete" ON "public"."needs_recipes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "needs_recipes"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "needs_recipes_insert" ON "public"."needs_recipes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "needs_recipes"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "needs_recipes_select" ON "public"."needs_recipes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "needs_recipes"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "needs_recipes_update" ON "public"."needs_recipes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."needs" "n"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "n"."space_id")))
  WHERE (("n"."id" = "needs_recipes"."need_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "needs_select" ON "public"."needs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "needs"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "needs_update" ON "public"."needs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "needs"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_references" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_step_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplies_delete" ON "public"."supplies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "supplies"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "supplies_insert" ON "public"."supplies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "supplies"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "supplies_select" ON "public"."supplies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "supplies"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "supplies_update" ON "public"."supplies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "supplies"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."supply_lots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supply_lots_delete_space_member" ON "public"."supply_lots" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_lots"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "supply_lots_insert_space_member" ON "public"."supply_lots" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_lots"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "supply_lots_select_space_member" ON "public"."supply_lots" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_lots"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "supply_lots_update_space_member" ON "public"."supply_lots" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_lots"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



ALTER TABLE "public"."supply_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supply_tags_delete" ON "public"."supply_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_tags"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "supply_tags_insert" ON "public"."supply_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_tags"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "supply_tags_select" ON "public"."supply_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_tags"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "supply_tags_update" ON "public"."supply_tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."supplies" "s"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "s"."space_id")))
  WHERE (("s"."id" = "supply_tags"."supply_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_delete" ON "public"."tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "tags"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "tags_insert" ON "public"."tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "tags"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "tags_select" ON "public"."tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "tags"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "tags_update" ON "public"."tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "tags"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."user_active_space" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_dietary_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ingredient_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_nutrition_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_pantry_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_recipe_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_recipe_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."view_filters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "view_filters_delete" ON "public"."view_filters" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."views" "v"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "v"."space_id")))
  WHERE (("v"."id" = "view_filters"."view_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "view_filters_insert" ON "public"."view_filters" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."views" "v"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "v"."space_id")))
  WHERE (("v"."id" = "view_filters"."view_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "view_filters_select" ON "public"."view_filters" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."views" "v"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "v"."space_id")))
  WHERE (("v"."id" = "view_filters"."view_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "view_filters_update" ON "public"."view_filters" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."views" "v"
     JOIN "public"."space_members" "sm" ON (("sm"."space_id" = "v"."space_id")))
  WHERE (("v"."id" = "view_filters"."view_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



ALTER TABLE "public"."views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "views_delete" ON "public"."views" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "views"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "views_insert" ON "public"."views" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "views"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));



CREATE POLICY "views_select" ON "public"."views" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "views"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text")))));



CREATE POLICY "views_update" ON "public"."views" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."space_members" "sm"
  WHERE (("sm"."space_id" = "views"."space_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."status" = 'accepted'::"text") AND ("sm"."role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'guest'::"text"]))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."analyze_or_patterns_for_migration"() TO "anon";
GRANT ALL ON FUNCTION "public"."analyze_or_patterns_for_migration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."analyze_or_patterns_for_migration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_extraction_results"("p_book_id" "uuid", "p_test_run_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_extraction_results"("p_book_id" "uuid", "p_test_run_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_extraction_results"("p_book_id" "uuid", "p_test_run_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."are_mutual_followers"("user_id_1" "uuid", "user_id_2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."are_mutual_followers"("user_id_1" "uuid", "user_id_2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."are_mutual_followers"("user_id_1" "uuid", "user_id_2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_suggested_date"("p_last_purchased" "date", "p_frequency" "text", "p_frequency_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_suggested_date"("p_last_purchased" "date", "p_frequency" "text", "p_frequency_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_suggested_date"("p_last_purchased" "date", "p_frequency" "text", "p_frequency_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_recipe_cost"("recipe_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_recipe_cost"("recipe_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_recipe_cost"("recipe_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_add_dish_to_meal"("p_meal_id" "uuid", "p_user_id" "uuid", "p_dish_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_add_dish_to_meal"("p_meal_id" "uuid", "p_user_id" "uuid", "p_dish_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_add_dish_to_meal"("p_meal_id" "uuid", "p_user_id" "uuid", "p_dish_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_meal"("p_meal_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_meal"("p_meal_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_meal"("p_meal_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_home_space"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_home_space"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_home_space"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_pantry_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_pantry_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_pantry_preferences"() TO "service_role";



GRANT ALL ON FUNCTION "public"."estimate_ingredient_grams"("p_quantity_amount" numeric, "p_quantity_unit" "text", "p_ingredient_id" "uuid", "p_original_text" "text", "p_embedded_grams" numeric, "p_embedded_ml" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."estimate_ingredient_grams"("p_quantity_amount" numeric, "p_quantity_unit" "text", "p_ingredient_id" "uuid", "p_original_text" "text", "p_embedded_grams" numeric, "p_embedded_ml" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."estimate_ingredient_grams"("p_quantity_amount" numeric, "p_quantity_unit" "text", "p_ingredient_id" "uuid", "p_original_text" "text", "p_embedded_grams" numeric, "p_embedded_ml" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."expand_storage_synonyms"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."expand_storage_synonyms"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."expand_storage_synonyms"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_book_pages_text"("p_book_id" "uuid", "p_start_page" integer, "p_end_page" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_book_pages_text"("p_book_id" "uuid", "p_start_page" integer, "p_end_page" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_book_pages_text"("p_book_id" "uuid", "p_start_page" integer, "p_end_page" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_improvement_opportunities"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_improvement_opportunities"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_improvement_opportunities"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_dishes"("p_meal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_dishes"("p_meal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_dishes"("p_meal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_participants"("p_meal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_participants"("p_meal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_participants"("p_meal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_plan_items"("p_meal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_plan_items"("p_meal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_plan_items"("p_meal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_plan_summary"("p_meal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_plan_summary"("p_meal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_plan_summary"("p_meal_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recipe_instructions_with_sections"("p_recipe_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_recipe_instructions_with_sections"("p_recipe_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recipe_instructions_with_sections"("p_recipe_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recipe_with_annotations"("p_recipe_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_recipe_with_annotations"("p_recipe_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recipe_with_annotations"("p_recipe_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recipe_with_ingredients"("p_recipe_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_recipe_with_ingredients"("p_recipe_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recipe_with_ingredients"("p_recipe_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_related_posts"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_related_posts"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_related_posts"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_recent_meals"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_recent_meals"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_recent_meals"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_space_ids"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_space_ids"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_space_ids"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_followers_count"("user_id" "uuid", "increment_by" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_followers_count"("user_id" "uuid", "increment_by" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_followers_count"("user_id" "uuid", "increment_by" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_following_count"("user_id" "uuid", "increment_by" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_following_count"("user_id" "uuid", "increment_by" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_following_count"("user_id" "uuid", "increment_by" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_reference_fulfilled"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_reference_fulfilled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_reference_fulfilled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_recipe_nutrition"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_recipe_nutrition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_recipe_nutrition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_ingredients"("query_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_ingredients"("query_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_ingredients"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_supplies"("query_text" "text", "p_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."search_supplies"("query_text" "text", "p_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_supplies"("query_text" "text", "p_space_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_views"("target_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_views"("target_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_views"("target_space_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_supply_lots_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_supply_lots_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_supply_lots_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_compute_search_vector"("p_supply_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_compute_search_vector"("p_supply_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_compute_search_vector"("p_supply_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_refresh_on_ingredient_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_refresh_on_ingredient_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_refresh_on_ingredient_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_refresh_on_supply_tag_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_refresh_on_supply_tag_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_refresh_on_supply_tag_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_search_vector_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_search_vector_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_search_vector_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."supply_lots_compute_search_vector"("p_variant_label" "text", "p_brand" "text", "p_notes" "text", "p_storage_location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."supply_lots_compute_search_vector"("p_variant_label" "text", "p_brand" "text", "p_notes" "text", "p_storage_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supply_lots_compute_search_vector"("p_variant_label" "text", "p_brand" "text", "p_notes" "text", "p_storage_location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."supply_lots_search_vector_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."supply_lots_search_vector_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."supply_lots_search_vector_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_books_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_books_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_books_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_expiration_on_opened"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_expiration_on_opened"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_expiration_on_opened"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_meal_dish_plans_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_meal_dish_plans_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meal_dish_plans_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_next_suggested_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_next_suggested_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_next_suggested_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_books_recipe_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_books_recipe_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_books_recipe_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."_grocery_list_items_pre_cp2a_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."_grocery_list_items_pre_cp2a_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."_grocery_list_items_pre_cp2a_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."_grocery_lists_pre_cp3_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."_grocery_lists_pre_cp3_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."_grocery_lists_pre_cp3_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."_ingredients_pre_cp1b_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."_ingredients_pre_cp1b_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."_ingredients_pre_cp1b_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_extraction_comparison" TO "anon";
GRANT ALL ON TABLE "public"."recipe_extraction_comparison" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_extraction_comparison" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."accuracy_by_recipe" TO "anon";
GRANT ALL ON TABLE "public"."accuracy_by_recipe" TO "authenticated";
GRANT ALL ON TABLE "public"."accuracy_by_recipe" TO "service_role";



GRANT ALL ON TABLE "public"."book_assembly_runs" TO "anon";
GRANT ALL ON TABLE "public"."book_assembly_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."book_assembly_runs" TO "service_role";



GRANT ALL ON TABLE "public"."book_content" TO "anon";
GRANT ALL ON TABLE "public"."book_content" TO "authenticated";
GRANT ALL ON TABLE "public"."book_content" TO "service_role";



GRANT ALL ON TABLE "public"."book_content_summary" TO "anon";
GRANT ALL ON TABLE "public"."book_content_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."book_content_summary" TO "service_role";



GRANT ALL ON TABLE "public"."book_page_scans" TO "anon";
GRANT ALL ON TABLE "public"."book_page_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."book_page_scans" TO "service_role";



GRANT ALL ON TABLE "public"."book_recipe_assembly" TO "anon";
GRANT ALL ON TABLE "public"."book_recipe_assembly" TO "authenticated";
GRANT ALL ON TABLE "public"."book_recipe_assembly" TO "service_role";



GRANT ALL ON TABLE "public"."books" TO "anon";
GRANT ALL ON TABLE "public"."books" TO "authenticated";
GRANT ALL ON TABLE "public"."books" TO "service_role";



GRANT ALL ON TABLE "public"."chefs" TO "anon";
GRANT ALL ON TABLE "public"."chefs" TO "authenticated";
GRANT ALL ON TABLE "public"."chefs" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."cooking_sessions" TO "anon";
GRANT ALL ON TABLE "public"."cooking_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."cooking_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."dish_courses" TO "anon";
GRANT ALL ON TABLE "public"."dish_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."dish_courses" TO "service_role";



GRANT ALL ON TABLE "public"."eater_ratings" TO "anon";
GRANT ALL ON TABLE "public"."eater_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."eater_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_extraction_queue" TO "anon";
GRANT ALL ON TABLE "public"."recipe_extraction_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_extraction_queue" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_accuracy_summary" TO "anon";
GRANT ALL ON TABLE "public"."extraction_accuracy_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_accuracy_summary" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_image_mapping" TO "anon";
GRANT ALL ON TABLE "public"."recipe_image_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_image_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_comparison" TO "anon";
GRANT ALL ON TABLE "public"."extraction_comparison" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_comparison" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_corrections" TO "anon";
GRANT ALL ON TABLE "public"."extraction_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_corrections" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_ingredient_comparison" TO "anon";
GRANT ALL ON TABLE "public"."extraction_ingredient_comparison" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_ingredient_comparison" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_instruction_comparison" TO "anon";
GRANT ALL ON TABLE "public"."extraction_instruction_comparison" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_instruction_comparison" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_logs" TO "anon";
GRANT ALL ON TABLE "public"."extraction_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_logs" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_statistics" TO "anon";
GRANT ALL ON TABLE "public"."extraction_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."extraction_summary" TO "anon";
GRANT ALL ON TABLE "public"."extraction_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."extraction_summary" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."friend_references" TO "anon";
GRANT ALL ON TABLE "public"."friend_references" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_references" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_category_rules" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_category_rules" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_common_units" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_common_units" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_common_units" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_seasons" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_seasons" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."instruction_sections" TO "anon";
GRANT ALL ON TABLE "public"."instruction_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."instruction_sections" TO "service_role";



GRANT ALL ON TABLE "public"."instruction_steps" TO "anon";
GRANT ALL ON TABLE "public"."instruction_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."instruction_steps" TO "service_role";



GRANT ALL ON TABLE "public"."low_confidence_extractions" TO "anon";
GRANT ALL ON TABLE "public"."low_confidence_extractions" TO "authenticated";
GRANT ALL ON TABLE "public"."low_confidence_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."meal_dish_plans" TO "anon";
GRANT ALL ON TABLE "public"."meal_dish_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_dish_plans" TO "service_role";



GRANT ALL ON TABLE "public"."meal_participants" TO "anon";
GRANT ALL ON TABLE "public"."meal_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_participants" TO "service_role";



GRANT ALL ON TABLE "public"."meal_photos" TO "anon";
GRANT ALL ON TABLE "public"."meal_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_photos" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."meals_with_details" TO "anon";
GRANT ALL ON TABLE "public"."meals_with_details" TO "authenticated";
GRANT ALL ON TABLE "public"."meals_with_details" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_units" TO "anon";
GRANT ALL ON TABLE "public"."measurement_units" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_units" TO "service_role";



GRANT ALL ON TABLE "public"."or_pattern_decisions" TO "anon";
GRANT ALL ON TABLE "public"."or_pattern_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."or_pattern_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."migration_readiness" TO "anon";
GRANT ALL ON TABLE "public"."migration_readiness" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_readiness" TO "service_role";



GRANT ALL ON TABLE "public"."need_tags" TO "anon";
GRANT ALL ON TABLE "public"."need_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."need_tags" TO "service_role";



GRANT ALL ON TABLE "public"."needs" TO "anon";
GRANT ALL ON TABLE "public"."needs" TO "authenticated";
GRANT ALL ON TABLE "public"."needs" TO "service_role";



GRANT ALL ON TABLE "public"."needs_recipes" TO "anon";
GRANT ALL ON TABLE "public"."needs_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."needs_recipes" TO "service_role";



GRANT ALL ON TABLE "public"."or_pattern_analysis" TO "anon";
GRANT ALL ON TABLE "public"."or_pattern_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."or_pattern_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."post_participants" TO "anon";
GRANT ALL ON TABLE "public"."post_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."post_participants" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pending_participant_approvals" TO "anon";
GRANT ALL ON TABLE "public"."pending_participant_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_participant_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."space_members" TO "anon";
GRANT ALL ON TABLE "public"."space_members" TO "authenticated";
GRANT ALL ON TABLE "public"."space_members" TO "service_role";



GRANT ALL ON TABLE "public"."spaces" TO "anon";
GRANT ALL ON TABLE "public"."spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."spaces" TO "service_role";



GRANT ALL ON TABLE "public"."pending_space_invitations" TO "anon";
GRANT ALL ON TABLE "public"."pending_space_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_space_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."post_relationships" TO "anon";
GRANT ALL ON TABLE "public"."post_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."post_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."posts_backup_pre_7i" TO "anon";
GRANT ALL ON TABLE "public"."posts_backup_pre_7i" TO "authenticated";
GRANT ALL ON TABLE "public"."posts_backup_pre_7i" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_annotations" TO "anon";
GRANT ALL ON TABLE "public"."recipe_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_extraction_history" TO "anon";
GRANT ALL ON TABLE "public"."recipe_extraction_history" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_extraction_history" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_extraction_test_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."recipe_extraction_test_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_extraction_test_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_extraction_verification" TO "anon";
GRANT ALL ON TABLE "public"."recipe_extraction_verification" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_extraction_verification" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_filters" TO "anon";
GRANT ALL ON TABLE "public"."recipe_filters" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_filters" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredient_nutrition" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredient_nutrition" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredient_nutrition" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredients_detail" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients_detail" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_media" TO "anon";
GRANT ALL ON TABLE "public"."recipe_media" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_media" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_nutrition_computed" TO "anon";
GRANT ALL ON TABLE "public"."recipe_nutrition_computed" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_nutrition_computed" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_photos" TO "anon";
GRANT ALL ON TABLE "public"."recipe_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_photos" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_references" TO "anon";
GRANT ALL ON TABLE "public"."recipe_references" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_references" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_source_notes" TO "anon";
GRANT ALL ON TABLE "public"."recipe_source_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_source_notes" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_step_notes" TO "anon";
GRANT ALL ON TABLE "public"."recipe_step_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_step_notes" TO "service_role";



GRANT ALL ON TABLE "public"."recipes_backup_20250122" TO "anon";
GRANT ALL ON TABLE "public"."recipes_backup_20250122" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes_backup_20250122" TO "service_role";



GRANT ALL ON TABLE "public"."recipes_backup_minimal_completion" TO "anon";
GRANT ALL ON TABLE "public"."recipes_backup_minimal_completion" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes_backup_minimal_completion" TO "service_role";



GRANT ALL ON TABLE "public"."recipes_backup_schema_migration" TO "anon";
GRANT ALL ON TABLE "public"."recipes_backup_schema_migration" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes_backup_schema_migration" TO "service_role";



GRANT ALL ON TABLE "public"."recipes_with_subs" TO "anon";
GRANT ALL ON TABLE "public"."recipes_with_subs" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes_with_subs" TO "service_role";



GRANT ALL ON TABLE "public"."reconciliation_performance" TO "anon";
GRANT ALL ON TABLE "public"."reconciliation_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_performance" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."space_settings" TO "anon";
GRANT ALL ON TABLE "public"."space_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."space_settings" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."supplies" TO "anon";
GRANT ALL ON TABLE "public"."supplies" TO "authenticated";
GRANT ALL ON TABLE "public"."supplies" TO "service_role";



GRANT ALL ON TABLE "public"."supply_lots" TO "anon";
GRANT ALL ON TABLE "public"."supply_lots" TO "authenticated";
GRANT ALL ON TABLE "public"."supply_lots" TO "service_role";



GRANT ALL ON TABLE "public"."supply_tags" TO "anon";
GRANT ALL ON TABLE "public"."supply_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."supply_tags" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."unmatched_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."unmatched_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."unmatched_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."user_active_space" TO "anon";
GRANT ALL ON TABLE "public"."user_active_space" TO "authenticated";
GRANT ALL ON TABLE "public"."user_active_space" TO "service_role";



GRANT ALL ON TABLE "public"."user_books" TO "anon";
GRANT ALL ON TABLE "public"."user_books" TO "authenticated";
GRANT ALL ON TABLE "public"."user_books" TO "service_role";



GRANT ALL ON TABLE "public"."user_dietary_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_dietary_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dietary_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_ingredient_choices" TO "anon";
GRANT ALL ON TABLE "public"."user_ingredient_choices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ingredient_choices" TO "service_role";



GRANT ALL ON TABLE "public"."user_ingredient_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_ingredient_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ingredient_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_meal_participation" TO "anon";
GRANT ALL ON TABLE "public"."user_meal_participation" TO "authenticated";
GRANT ALL ON TABLE "public"."user_meal_participation" TO "service_role";



GRANT ALL ON TABLE "public"."user_nutrition_goals" TO "anon";
GRANT ALL ON TABLE "public"."user_nutrition_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_nutrition_goals" TO "service_role";



GRANT ALL ON TABLE "public"."user_pantry_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_pantry_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pantry_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_recipe_tags" TO "anon";
GRANT ALL ON TABLE "public"."user_recipe_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipe_tags" TO "service_role";



GRANT ALL ON TABLE "public"."view_filters" TO "anon";
GRANT ALL ON TABLE "public"."view_filters" TO "authenticated";
GRANT ALL ON TABLE "public"."view_filters" TO "service_role";



GRANT ALL ON TABLE "public"."views" TO "anon";
GRANT ALL ON TABLE "public"."views" TO "authenticated";
GRANT ALL ON TABLE "public"."views" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































