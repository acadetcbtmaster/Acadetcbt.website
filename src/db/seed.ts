import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import path from 'node:path';
import { closePool, getDb, isDatabaseConfigured } from './index.js';
import { runMigrations } from './migrate.js';
import {
  announcements,
  courses,
  DEFAULT_USER_PREFERENCES,
  questions,
  subjects,
  users,
} from './schema.js';

interface SeedSubject {
  slug: string;
  name: string;
  code: string;
  description: string;
  defaultDurationMinutes: number;
  courses: Array<{ code: string; title: string; level: string; description: string }>;
  questions: Array<{
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: 'A' | 'B' | 'C' | 'D';
    explanation: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    topic: string;
    examYear?: number;
  }>;
}

const STARTER_SUBJECTS: SeedSubject[] = [
  {
    slug: 'mathematics',
    name: 'Mathematics',
    code: 'MTH',
    description: 'Algebra, geometry, trigonometry, calculus, and statistics for UTME.',
    defaultDurationMinutes: 90,
    courses: [
      {
        code: 'MTH 101',
        title: 'Elementary Algebra & Number Theory',
        level: 'UTME',
        description: 'Linear equations, indices, logarithms, and surds.',
      },
      {
        code: 'MTH 102',
        title: 'Geometry, Trigonometry & Calculus',
        level: 'UTME',
        description: 'Coordinate geometry, triangles, differentiation, and integration.',
      },
    ],
    questions: [
      {
        questionText: 'If 3x + 5 = 14, what is the value of x?',
        optionA: '1',
        optionB: '2',
        optionC: '3',
        optionD: '4',
        correctOption: 'C',
        explanation: 'Subtract 5 from both sides: 3x = 9. Divide by 3: x = 3.',
        difficulty: 'Easy',
        topic: 'Linear Equations',
        examYear: 2024,
      },
      {
        questionText: 'Simplify log10(1000) + log10(10).',
        optionA: '2',
        optionB: '3',
        optionC: '4',
        optionD: '5',
        correctOption: 'C',
        explanation: 'log10(1000) = 3 and log10(10) = 1, so 3 + 1 = 4.',
        difficulty: 'Easy',
        topic: 'Logarithms',
        examYear: 2023,
      },
      {
        questionText: 'Find the derivative of y = 4x^3 - 6x + 2 with respect to x.',
        optionA: '12x^2 - 6',
        optionB: '12x^3 - 6',
        optionC: '4x^2 - 6',
        optionD: '12x^2 + 2',
        correctOption: 'A',
        explanation: 'Using the power rule: d/dx(4x^3) = 12x^2, d/dx(-6x) = -6, d/dx(2) = 0.',
        difficulty: 'Medium',
        topic: 'Calculus',
        examYear: 2024,
      },
      {
        questionText: 'What is the gradient of the straight line passing through (2, 3) and (6, 11)?',
        optionA: '1',
        optionB: '2',
        optionC: '3',
        optionD: '4',
        correctOption: 'B',
        explanation: 'Gradient m = (11 - 3) / (6 - 2) = 8 / 4 = 2.',
        difficulty: 'Easy',
        topic: 'Coordinate Geometry',
        examYear: 2022,
      },
      {
        questionText: 'If sin(theta) = 3/5 and theta is acute, find cos(theta).',
        optionA: '2/5',
        optionB: '3/4',
        optionC: '4/5',
        optionD: '5/4',
        correctOption: 'C',
        explanation: 'Using sin^2(theta) + cos^2(theta) = 1: cos(theta) = sqrt(1 - 9/25) = 4/5.',
        difficulty: 'Medium',
        topic: 'Trigonometry',
        examYear: 2023,
      },
      {
        questionText: 'In how many ways can the letters of the word ACADET be arranged?',
        optionA: '120',
        optionB: '360',
        optionC: '720',
        optionD: '240',
        correctOption: 'B',
        explanation: 'ACADET has 6 letters with A repeated twice: 6! / 2! = 720 / 2 = 360.',
        difficulty: 'Hard',
        topic: 'Permutations',
        examYear: 2024,
      },
    ],
  },
  {
    slug: 'use-of-english',
    name: 'Use of English',
    code: 'ENG',
    description: 'Lexis, structure, comprehension, oral forms, and sentence interpretation.',
    defaultDurationMinutes: 60,
    courses: [
      {
        code: 'ENG 101',
        title: 'Lexis & Structure Mastery',
        level: 'UTME',
        description: 'Concord, idioms, synonyms, antonyms, and grammatical usage.',
      },
    ],
    questions: [
      {
        questionText: 'Choose the option that best completes the sentence: Neither the teacher nor the students ____ aware of the timetable change.',
        optionA: 'was',
        optionB: 'were',
        optionC: 'is',
        optionD: 'has been',
        correctOption: 'B',
        explanation: 'With "neither ... nor", the verb agrees with the nearer subject ("students", plural), so "were" is correct.',
        difficulty: 'Medium',
        topic: 'Subject-Verb Concord',
        examYear: 2024,
      },
      {
        questionText: 'Select the word opposite in meaning to "ephemeral".',
        optionA: 'Brief',
        optionB: 'Permanent',
        optionC: 'Fragile',
        optionD: 'Sudden',
        correctOption: 'B',
        explanation: '"Ephemeral" means lasting for a very short time; its antonym is "Permanent".',
        difficulty: 'Medium',
        topic: 'Antonyms',
        examYear: 2023,
      },
      {
        questionText: 'Choose the word nearest in meaning to "meticulous".',
        optionA: 'Careless',
        optionB: 'Thorough',
        optionC: 'Hasty',
        optionD: 'Reckless',
        correctOption: 'B',
        explanation: '"Meticulous" means showing great attention to detail; very careful and thorough.',
        difficulty: 'Easy',
        topic: 'Synonyms',
        examYear: 2024,
      },
      {
        questionText: 'Identify the vowel sound in the word "seat".',
        optionA: '/i:/',
        optionB: '/I/',
        optionC: '/e/',
        optionD: '/ae/',
        correctOption: 'A',
        explanation: '"Seat" contains the long vowel sound /i:/.',
        difficulty: 'Easy',
        topic: 'Oral English',
        examYear: 2022,
      },
    ],
  },
  {
    slug: 'physics',
    name: 'Physics',
    code: 'PHY',
    description: 'Mechanics, waves, optics, electricity, magnetism, and modern physics.',
    defaultDurationMinutes: 60,
    courses: [
      {
        code: 'PHY 101',
        title: 'Mechanics & Properties of Matter',
        level: 'UTME',
        description: 'Motion, forces, energy, momentum, and gravitation.',
      },
    ],
    questions: [
      {
        questionText: 'Which of the following is a vector quantity?',
        optionA: 'Speed',
        optionB: 'Mass',
        optionC: 'Acceleration',
        optionD: 'Temperature',
        correctOption: 'C',
        explanation: 'Acceleration has both magnitude and direction, making it a vector quantity.',
        difficulty: 'Easy',
        topic: 'Vectors & Scalars',
        examYear: 2024,
      },
      {
        questionText: 'A body of mass 5 kg accelerates at 4 m/s^2. Calculate the net force acting on it.',
        optionA: '9 N',
        optionB: '1.25 N',
        optionC: '20 N',
        optionD: '40 N',
        correctOption: 'C',
        explanation: 'By Newton\'s Second Law, F = m * a = 5 kg * 4 m/s^2 = 20 N.',
        difficulty: 'Easy',
        topic: 'Newtonian Mechanics',
        examYear: 2023,
      },
      {
        questionText: 'What is the SI unit of electrical resistance?',
        optionA: 'Volt',
        optionB: 'Ampere',
        optionC: 'Watt',
        optionD: 'Ohm',
        correctOption: 'D',
        explanation: 'Electrical resistance is measured in Ohms.',
        difficulty: 'Easy',
        topic: 'Current Electricity',
        examYear: 2022,
      },
      {
        questionText: 'A wave has a frequency of 50 Hz and a wavelength of 4 m. What is its speed?',
        optionA: '12.5 m/s',
        optionB: '54 m/s',
        optionC: '200 m/s',
        optionD: '400 m/s',
        correctOption: 'C',
        explanation: 'Wave speed v = f * lambda = 50 Hz * 4 m = 200 m/s.',
        difficulty: 'Medium',
        topic: 'Waves',
        examYear: 2024,
      },
    ],
  },
  {
    slug: 'chemistry',
    name: 'Chemistry',
    code: 'CHM',
    description: 'Atomic structure, stoichiometry, chemical bonding, kinetics, and organic chemistry.',
    defaultDurationMinutes: 60,
    courses: [
      {
        code: 'CHM 101',
        title: 'Foundations of Inorganic & Organic Chemistry',
        level: 'UTME',
        description: 'Periodic trends, mole concept, acids/bases, and hydrocarbons.',
      },
    ],
    questions: [
      {
        questionText: 'What is the pH of a neutral aqueous solution at 25 degrees Celsius?',
        optionA: '0',
        optionB: '5',
        optionC: '7',
        optionD: '14',
        correctOption: 'C',
        explanation: 'Pure neutral water has a pH of 7 at 25 degrees Celsius.',
        difficulty: 'Easy',
        topic: 'Acids, Bases & Salts',
        examYear: 2024,
      },
      {
        questionText: 'Which gas turns lime water milky?',
        optionA: 'Oxygen',
        optionB: 'Nitrogen',
        optionC: 'Carbon (IV) oxide',
        optionD: 'Hydrogen',
        correctOption: 'C',
        explanation: 'CO2 reacts with Ca(OH)2 to form insoluble CaCO3 precipitate, turning lime water milky.',
        difficulty: 'Easy',
        topic: 'Non-Metals',
        examYear: 2023,
      },
      {
        questionText: 'The general formula for alkanes is:',
        optionA: 'CnH2n',
        optionB: 'CnH2n+2',
        optionC: 'CnH2n-2',
        optionD: 'CnHn',
        correctOption: 'B',
        explanation: 'Saturated hydrocarbons (alkanes) follow the general formula CnH2n+2.',
        difficulty: 'Medium',
        topic: 'Organic Chemistry',
        examYear: 2024,
      },
    ],
  },
  {
    slug: 'biology',
    name: 'Biology',
    code: 'BIO',
    description: 'Cell biology, genetics, ecology, plant physiology, and human anatomy.',
    defaultDurationMinutes: 60,
    courses: [
      {
        code: 'BIO 101',
        title: 'Cell Biology & Genetics',
        level: 'UTME',
        description: 'Cell organelles, mitosis, meiosis, and Mendelian inheritance.',
      },
    ],
    questions: [
      {
        questionText: 'Which organelle is responsible for cellular respiration and ATP production?',
        optionA: 'Ribosome',
        optionB: 'Mitochondrion',
        optionC: 'Golgi apparatus',
        optionD: 'Lysosome',
        correctOption: 'B',
        explanation: 'The mitochondrion is the powerhouse of the cell where aerobic respiration produces ATP.',
        difficulty: 'Easy',
        topic: 'Cell Structure',
        examYear: 2024,
      },
      {
        questionText: 'Which blood vessel carries oxygenated blood from the lungs to the left atrium of the heart?',
        optionA: 'Pulmonary artery',
        optionB: 'Pulmonary vein',
        optionC: 'Vena cava',
        optionD: 'Aorta',
        correctOption: 'B',
        explanation: 'The pulmonary vein carries oxygenated blood from the lungs back to the left atrium.',
        difficulty: 'Medium',
        topic: 'Transport System',
        examYear: 2023,
      },
      {
        questionText: 'In plants, the process by which water vapour is lost through stomata is called:',
        optionA: 'Translocation',
        optionB: 'Transpiration',
        optionC: 'Respiration',
        optionD: 'Germination',
        correctOption: 'B',
        explanation: 'Transpiration is the evaporation and loss of water vapour primarily through leaf stomata.',
        difficulty: 'Easy',
        topic: 'Plant Physiology',
        examYear: 2022,
      },
    ],
  },
];

export async function ensureBootstrapAdmin(): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminUsername = (process.env.ADMIN_USERNAME?.trim() || 'admin').toLowerCase();
  const adminFullName = process.env.ADMIN_FULL_NAME?.trim() || 'Acadet Administrator';

  if (!adminEmail || !adminPassword) {
    return null;
  }

  const db = getDb();
  const existingByEmail = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${adminEmail}`)
    .limit(1);

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (existingByEmail.length > 0) {
    const existing = existingByEmail[0];
    if (existing.role !== 'super_admin' || !existing.isActive) {
      await db
        .update(users)
        .set({
          role: 'super_admin',
          isActive: true,
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      console.log(`[Seed] Promoted ${adminEmail} to super_admin.`);
    }
    return existing.id;
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${adminUsername}`)
    .limit(1);

  const finalUsername =
    existingUsername.length > 0
      ? `${adminUsername}_${Date.now().toString().slice(-4)}`
      : adminUsername;

  const [insertedAdmin] = await db
    .insert(users)
    .values({
      fullName: adminFullName,
      email: adminEmail,
      username: finalUsername,
      passwordHash,
      role: 'super_admin',
      examTarget: 'JAMB UTME Practice Exam',
      isActive: true,
      preferences: DEFAULT_USER_PREFERENCES,
    })
    .returning({ id: users.id });

  console.log(`[Seed] Created super_admin user (${adminEmail})`);
  return insertedAdmin.id;
}

export async function runSeed(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL environment variable is required to seed the database.');
  }

  await runMigrations();
  const db = getDb();

  const adminId = await ensureBootstrapAdmin();
  if (!adminId) {
    console.log('[Seed] ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping bootstrap admin user.');
  }

  for (const subjectData of STARTER_SUBJECTS) {
    const existingSubject = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, subjectData.slug))
      .limit(1);

    let subjectId: string;
    if (existingSubject.length > 0) {
      subjectId = existingSubject[0].id;
    } else {
      const [insertedSubject] = await db
        .insert(subjects)
        .values({
          slug: subjectData.slug,
          name: subjectData.name,
          code: subjectData.code,
          examCategory: 'JAMB UTME Practice Exam',
          description: subjectData.description,
          defaultDurationMinutes: subjectData.defaultDurationMinutes,
          isActive: true,
        })
        .returning({ id: subjects.id });
      subjectId = insertedSubject.id;
      console.log(`[Seed] Created subject: ${subjectData.name}`);
    }

    let firstCourseId: string | null = null;
    for (const c of subjectData.courses) {
      const existingCourses = await db
        .select()
        .from(courses)
        .where(eq(courses.code, c.code))
        .limit(1);

      if (existingCourses.length > 0) {
        if (!firstCourseId) firstCourseId = existingCourses[0].id;
      } else {
        const [insertedCourse] = await db
          .insert(courses)
          .values({
            subjectId,
            code: c.code,
            title: c.title,
            level: c.level,
            description: c.description,
            isActive: true,
          })
          .returning({ id: courses.id });
        if (!firstCourseId) firstCourseId = insertedCourse.id;
      }
    }

    const existingQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.subjectId, subjectId))
      .limit(1);

    if (existingQuestions.length === 0) {
      await db.insert(questions).values(
        subjectData.questions.map((q) => ({
          subjectId,
          courseId: firstCourseId,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          explanation: q.explanation,
          difficulty: q.difficulty,
          topic: q.topic,
          examYear: q.examYear ?? null,
          isActive: true,
          createdBy: adminId,
        }))
      );
      console.log(
        `[Seed] Added ${subjectData.questions.length} starter questions for ${subjectData.name}`
      );
    }
  }

  const existingAnnouncements = await db.select({ id: announcements.id }).from(announcements).limit(1);
  if (existingAnnouncements.length === 0) {
    await db.insert(announcements).values({
      title: 'Welcome to the Acadet CBT Practice Platform!',
      body: 'Practice regularly to build confidence for your JAMB exam. All exam sessions, timing, and results are securely stored in PostgreSQL.',
      isPinned: true,
      isActive: true,
      createdBy: adminId,
    });
    console.log('[Seed] Added initial announcement');
  }
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await ensureBootstrapAdmin();
  const db = getDb();
  const existing = await db.select({ id: subjects.id }).from(subjects).limit(1);
  if (existing.length === 0) {
    console.log('[Seed] Empty catalog detected; running initial starter curriculum seed...');
    await runSeed();
  }
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectRun =
  entryArg.endsWith(`${path.sep}seed.ts`) || entryArg.endsWith(`${path.sep}seed.js`);

if (isDirectRun) {
  runSeed()
    .then(async () => {
      console.log('[Seed] Database seeding complete.');
      await closePool();
    })
    .catch(async (err) => {
      console.error('[Seed] Error:', err);
      await closePool();
      process.exit(1);
    });
}
