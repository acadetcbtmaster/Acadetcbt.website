-- 0012_delete_english_and_computer_science_courses.sql
-- Permanently delete the English (ENG 101 / Use of English) and Computer Science (CSC 101) courses
-- and cleanly detach or remove dependent relational records.

DO $$
DECLARE
  target_subject_ids UUID[];
  target_course_ids UUID[];
  target_payment_ids UUID[];
  target_question_ids UUID[];
  target_session_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO target_subject_ids
  FROM subjects
  WHERE LOWER(TRIM(slug)) IN ('computer-science', 'use-of-english', 'english')
     OR LOWER(TRIM(code)) IN ('csc', 'eng')
     OR LOWER(TRIM(name)) LIKE '%computer science%'
     OR LOWER(TRIM(name)) LIKE '%english%';

  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO target_course_ids
  FROM courses
  WHERE LOWER(TRIM(code)) IN ('csc 101', 'csc101', 'eng 101', 'eng101')
     OR LOWER(TRIM(title)) LIKE '%computer science%'
     OR LOWER(TRIM(title)) LIKE '%english%'
     OR subject_id = ANY(target_subject_ids);

  IF cardinality(target_course_ids) > 0 OR cardinality(target_subject_ids) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
    INTO target_payment_ids
    FROM payments
    WHERE course_id = ANY(target_course_ids);

    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
    INTO target_question_ids
    FROM questions
    WHERE course_id = ANY(target_course_ids)
       OR subject_id = ANY(target_subject_ids);

    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
    INTO target_session_ids
    FROM exam_sessions
    WHERE course_id = ANY(target_course_ids)
       OR subject_id = ANY(target_subject_ids);

    -- Preserve payment verification logs and notifications while unlinking deleted references
    UPDATE payment_verification_logs
    SET course_id = NULL
    WHERE course_id = ANY(target_course_ids);

    IF cardinality(target_payment_ids) > 0 THEN
      UPDATE payment_verification_logs
      SET payment_id = NULL
      WHERE payment_id = ANY(target_payment_ids);
    END IF;

    UPDATE notifications
    SET course_id = NULL
    WHERE course_id = ANY(target_course_ids);

    IF cardinality(target_payment_ids) > 0 THEN
      UPDATE notifications
      SET payment_id = NULL
      WHERE payment_id = ANY(target_payment_ids);
    END IF;

    -- Remove exam session question references first to satisfy RESTRICT FKs
    DELETE FROM exam_session_questions
    WHERE session_id = ANY(target_session_ids)
       OR question_id = ANY(target_question_ids);

    DELETE FROM exam_sessions
    WHERE id = ANY(target_session_ids);

    DELETE FROM course_registrations
    WHERE course_id = ANY(target_course_ids);

    DELETE FROM payments
    WHERE id = ANY(target_payment_ids);

    DELETE FROM study_materials
    WHERE course_id = ANY(target_course_ids)
       OR subject_id = ANY(target_subject_ids);

    DELETE FROM questions
    WHERE id = ANY(target_question_ids);

    -- Clear stale default course/subject preferences pointing at removed records
    UPDATE users
    SET preferences = preferences || jsonb_build_object('defaultCourseId', NULL)
    WHERE (preferences->>'defaultCourseId') IS NOT NULL
      AND (preferences->>'defaultCourseId') IN (
        SELECT id::TEXT FROM unnest(target_course_ids) AS id
      );

    UPDATE users
    SET preferences = preferences || jsonb_build_object('defaultSubjectId', NULL)
    WHERE (preferences->>'defaultSubjectId') IS NOT NULL
      AND (preferences->>'defaultSubjectId') IN (
        SELECT id::TEXT FROM unnest(target_subject_ids) AS id
      );

    DELETE FROM courses
    WHERE id = ANY(target_course_ids);

    DELETE FROM subjects
    WHERE id = ANY(target_subject_ids);
  END IF;
END $$;
