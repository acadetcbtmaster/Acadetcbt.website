-- Acadet CBT Upgrade: Google Search Visibility & SEO Defaults
-- Updates default SEO title, meta description, and Nigeria CBT/tutorial keywords safely
-- without overwriting custom values edited by a Super Admin.

ALTER TABLE site_branding
  ALTER COLUMN site_description SET DEFAULT 'Acadet CBT is an online CBT practice and learning platform in Nigeria helping students prepare with JAMB UTME tests, 100 Level university tutorials, course study materials, and instant performance analytics.',
  ALTER COLUMN seo_title SET DEFAULT 'Acadet CBT – Online CBT Practice and Learning Platform',
  ALTER COLUMN seo_description SET DEFAULT 'Acadet CBT is an online CBT practice and learning platform in Nigeria for JAMB UTME preparation, 100 Level university tutorials, courses, and study materials.',
  ALTER COLUMN seo_keywords SET DEFAULT 'Acadet CBT, Acadet Learning Hub, online CBT practice Nigeria, JAMB CBT practice, UTME CBT practice, 100 Level university tutorials, computer-based test practice, university exam preparation Nigeria, online course registration, CBT study materials';

UPDATE site_branding
SET
  seo_title = CASE
    WHEN seo_title = 'Acadet CBT | Online CBT Practice, Courses & Exam Preparation'
      OR seo_title = ''
    THEN 'Acadet CBT – Online CBT Practice and Learning Platform'
    ELSE seo_title
  END,
  seo_description = CASE
    WHEN seo_description = 'Acadet CBT and Acadet Learning Hub provide realistic online CBT practice, JAMB CBT practice, structured courses, study materials, and instant performance analytics.'
      OR seo_description = ''
    THEN 'Acadet CBT is an online CBT practice and learning platform in Nigeria for JAMB UTME preparation, 100 Level university tutorials, courses, and study materials.'
    ELSE seo_description
  END,
  seo_keywords = CASE
    WHEN seo_keywords = 'Acadet CBT, Acadet Learning Hub, JAMB CBT Practice, Online CBT Practice, Computer-Based Examination, Online Examination Practice'
      OR seo_keywords = ''
    THEN 'Acadet CBT, Acadet Learning Hub, online CBT practice Nigeria, JAMB CBT practice, UTME CBT practice, 100 Level university tutorials, computer-based test practice, university exam preparation Nigeria, online course registration, CBT study materials'
    ELSE seo_keywords
  END,
  site_description = CASE
    WHEN site_description = 'Acadet CBT is an online computer-based testing and academic preparation platform helping students study course materials, practise examination questions, and track performance.'
      OR site_description = ''
    THEN 'Acadet CBT is an online CBT practice and learning platform in Nigeria helping students prepare with JAMB UTME tests, 100 Level university tutorials, course study materials, and instant performance analytics.'
    ELSE site_description
  END,
  updated_at = NOW()
WHERE id = 'default';
