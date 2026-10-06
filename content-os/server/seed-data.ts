/**
 * bootstrap(): baseline configuration every install needs (content types, built-in views).
 * seedDemo(): a realistic content universe so every UI state can be exercised.
 *
 * The demo writes rows directly (not through services) so it can backdate history —
 * stage completions, publications and activity spread over past months — which is what makes
 * bottleneck, throughput and resurfacing logic meaningful on day one.
 */
import { STAGES, PHASES, planBoardMove, type Phase, type Stage, type StageMode, type StageStates, type Platform } from '../shared/domain';
import { db } from './services/core';
import { SYSTEM_VIEWS, invalidateContentTypes, contentTypeModes } from './services/config';
import { recomputeEpisodes } from './services/episodes';

type Modes = Partial<Record<Stage, StageMode>>;
const ALL_REQ: Modes = {};
const CONTENT_TYPES: { key: string; name: string; description: string; duration: number | null; platforms: Platform[]; color: string; checklist: string[]; modes: Modes }[] = [
  {
    key: 'animated-reel',
    name: 'Animated Reel',
    description: '60–90s animated vertical video with voiceover. The flagship format.',
    duration: 75,
    platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
    color: '#3d6b5c',
    checklist: ['Hook lands in the first 2 seconds', 'Subtitles burned in', 'Audio normalised (-14 LUFS)', 'Safe zones checked for platform UI'],
    modes: { SCHEDULE: 'OPTIONAL' },
  },
  {
    key: 'short-video',
    name: 'Short-form Video',
    description: 'Talking-head or b-roll short. Lighter research.',
    duration: 45,
    platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
    color: '#5b6fa8',
    checklist: ['Hook lands in the first 2 seconds', 'Subtitles burned in'],
    modes: { RESEARCH: 'OPTIONAL', SCHEDULE: 'OPTIONAL' },
  },
  {
    key: 'quote-card',
    name: 'Quote Card',
    description: 'Single static image: a line, a question or a principle.',
    duration: null,
    platforms: ['INSTAGRAM', 'THREADS', 'X'],
    color: '#a8743d',
    checklist: ['Attribution correct', 'Readable at thumbnail size'],
    modes: { RESEARCH: 'OPTIONAL', VOICE: 'NONE', EDIT: 'NONE', COVER: 'NONE', SCHEDULE: 'OPTIONAL' },
  },
  {
    key: 'carousel',
    name: 'Carousel',
    description: 'Multi-slide static post (5–10 slides).',
    duration: null,
    platforms: ['INSTAGRAM', 'LINKEDIN'],
    color: '#8a5a9e',
    checklist: ['Slide 1 works as a standalone hook', 'Last slide has a save/share prompt'],
    modes: { VOICE: 'NONE', EDIT: 'NONE', SCHEDULE: 'OPTIONAL' },
  },
  {
    key: 'story',
    name: 'Story',
    description: 'Ephemeral story frame(s). Minimal process.',
    duration: 15,
    platforms: ['INSTAGRAM'],
    color: '#7a8a3d',
    checklist: [],
    modes: { RESEARCH: 'NONE', SCRIPT: 'OPTIONAL', VOICE: 'OPTIONAL', EDIT: 'OPTIONAL', QC: 'OPTIONAL', CAPTION: 'NONE', COVER: 'NONE', SCHEDULE: 'NONE' },
  },
  {
    key: 'long-form',
    name: 'Long-form Video',
    description: '8–20 minute YouTube deep dive.',
    duration: 900,
    platforms: ['YOUTUBE'],
    color: '#b5483b',
    checklist: ['Chapters added', 'End screen set', 'Thumbnail A/B variants'],
    modes: ALL_REQ,
  },
  {
    key: 'experimental',
    name: 'Experimental',
    description: 'Format experiments. Only concept, visual and publish are required.',
    duration: null,
    platforms: ['INSTAGRAM'],
    color: '#4a8a8a',
    checklist: [],
    modes: Object.fromEntries(STAGES.map((s) => [s, ['CONCEPT', 'VISUAL', 'PUBLISH'].includes(s) ? 'REQUIRED' : 'OPTIONAL'])) as Modes,
  },
];

/** Returns true when the database was empty (first run). */
export function bootstrap(): boolean {
  const d = db();
  const has = (d.prepare('SELECT count(*) AS c FROM content_types').get() as { c: number }).c;
  if (has) return false;
  d.transaction(() => {
    const ins = d.prepare('INSERT INTO content_types (key, name, description, default_duration_sec, default_platforms, checklist, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insMode = d.prepare('INSERT INTO content_type_stages (content_type_id, stage, mode) VALUES (?, ?, ?)');
    CONTENT_TYPES.forEach((ct, i) => {
      const id = Number(ins.run(ct.key, ct.name, ct.description, ct.duration, ct.platforms.join(','), JSON.stringify(ct.checklist), ct.color, i).lastInsertRowid);
      for (const s of STAGES) insMode.run(id, s, ct.modes[s] ?? 'REQUIRED');
    });
    const v = d.prepare('INSERT INTO saved_views (name, query, system, sort_order) VALUES (?, ?, 1, ?)');
    SYSTEM_VIEWS.forEach((sv, i) => v.run(sv.name, JSON.stringify(sv.query), i));
  })();
  invalidateContentTypes();
  return true;
}

// =============================================================== deterministic randomness

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(42);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const daysAgo = (days: number, jitterHours = 10) => new Date(Date.now() - days * 86_400_000 - Math.floor(rand() * jitterHours * 3_600_000)).toISOString();
const daysAhead = (days: number, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, between(0, 3) * 15, 0, 0);
  return d.toISOString();
};
const localDate = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// =============================================================== demo universe

interface SeedEpisode {
  title: string;
  series?: string;
  core?: string;
  hook?: string;
  tags?: string[];
  sources?: string[];
  type?: string;
  profile?: Profile;
}

type Profile = 'idea' | 'research' | 'script' | 'voice' | 'visual' | 'edit' | 'qc' | 'blocked' | 'ready' | 'scheduled' | 'published';

interface SeedProject {
  name: string;
  code: string;
  color: string;
  target: number;
  type: string;
  description: string;
  goal: string;
  status?: string;
  series: { title: string; description: string; target: number; tags: string[] }[];
  sources: { title: string; type: string; author?: string; person?: string; citation?: string; potential?: number; status?: string; insights?: string[] }[];
  episodes: SeedEpisode[];
}

const PROJECTS: SeedProject[] = [
  {
    name: 'Bible — 400 Human Stories',
    code: 'BIB',
    color: '#8a5a3d',
    target: 400,
    type: 'animated-reel',
    description: 'Visual storytelling through ~200 Old Testament and ~200 New Testament episodes — organised around human behaviour, decisions and consequences rather than chapter summaries.',
    goal: 'Make ancient stories feel uncomfortably personal: every episode ends on a decision the viewer recognises in themselves.',
    series: [
      { title: 'Human Nature', description: 'Envy, fear, desire, pride — the constants.', target: 80, tags: ['envy', 'pride', 'fear'] },
      { title: 'Faith', description: 'Trust under uncertainty.', target: 70, tags: ['faith', 'doubt'] },
      { title: 'Power', description: 'What power reveals and what it costs.', target: 60, tags: ['power', 'leadership'] },
      { title: 'Family', description: 'Rivalry, loyalty and inheritance.', target: 70, tags: ['family', 'betrayal'] },
      { title: 'Failure', description: 'Falls, collapses and their causes.', target: 60, tags: ['failure', 'ego'] },
      { title: 'Redemption', description: 'Second chances and what makes them real.', target: 60, tags: ['redemption', 'forgiveness'] },
    ],
    sources: [
      { title: 'Genesis', type: 'SCRIPTURE', citation: 'Genesis 1–50', potential: 45, status: 'IN_PROGRESS', insights: ['Envy grows fastest between people who are compared to each other.', 'Joseph’s brothers betrayed him, yet the story is about what twenty years did to all of them.', 'Lot’s wife looked back: attachment to what is already lost.'] },
      { title: '1 & 2 Samuel', type: 'SCRIPTURE', citation: '1 Samuel 1 – 2 Samuel 24', potential: 30, status: 'IN_PROGRESS', insights: ['Saul’s collapse began with insecurity, not wickedness.', 'David’s greatest failure came during a season of success and idleness.'] },
      { title: 'Exodus', type: 'SCRIPTURE', citation: 'Exodus 1–40', potential: 25, status: 'QUEUED', insights: ['Freedom is harder than slavery because slavery requires no decisions.'] },
      { title: 'Luke', type: 'SCRIPTURE', citation: 'Luke 1–24', potential: 30, status: 'IN_PROGRESS', insights: ['The prodigal son’s older brother is the real cliffhanger.', 'Zacchaeus climbed a tree: status means nothing when you are desperate enough.'] },
      { title: 'Daniel', type: 'SCRIPTURE', citation: 'Daniel 1–12', potential: 12, status: 'QUEUED', insights: ['Nebuchadnezzar’s pride and his madness are the same story.'] },
      { title: 'Acts', type: 'SCRIPTURE', citation: 'Acts 1–28', potential: 20, status: 'QUEUED' },
      { title: 'The Bible Project — Character Studies', type: 'PODCAST', author: 'BibleProject', potential: 15, status: 'IN_PROGRESS' },
    ],
    episodes: [
      { title: 'Cain and Abel: The First Comparison', series: 'Human Nature', core: 'Envy is born the moment we measure our worth against someone else’s offering.', hook: 'The first murder in the Bible wasn’t about violence. It was about comparison.', tags: ['envy'], sources: ['Genesis'], profile: 'published' },
      { title: 'Joseph and the Brothers Who Sold Him', series: 'Family', core: 'Favouritism plants betrayal; time turns victims into judges.', hook: 'His brothers sold him for 20 pieces of silver. Twenty years later, he held their lives in his hands.', tags: ['betrayal', 'family', 'forgiveness'], sources: ['Genesis'], profile: 'published' },
      { title: 'Why Lot’s Wife Looked Back', series: 'Human Nature', core: 'We look back at what is already gone because identity is attached to it.', hook: 'She was told not to look back. She did anyway. Why?', tags: ['fear', 'attachment'], sources: ['Genesis'], profile: 'ready' },
      { title: 'The Tower of Babel and the Need to Be Seen', series: 'Power', core: '“Let us make a name for ourselves” — status as the oldest motive.', hook: 'They didn’t build a tower to reach God. They built it to be famous.', tags: ['status', 'pride'], sources: ['Genesis'], profile: 'scheduled' },
      { title: 'Saul: How Insecurity Destroys a King', series: 'Power', core: 'Saul’s jealousy of David reveals how insecurity corrodes leadership.', hook: 'Saul had the crown. David had a song about him. That was enough.', tags: ['envy', 'leadership', 'ego'], sources: ['1 & 2 Samuel'], profile: 'edit' },
      { title: 'David and Bathsheba: Failure at the Top', series: 'Failure', core: 'The greatest moral failure arrived in a season of success and idleness.', hook: 'It happened in the spring, when kings go to war. David stayed home.', tags: ['failure', 'power'], sources: ['1 & 2 Samuel'], profile: 'voice' },
      { title: 'David vs Goliath Was Not About Courage', series: 'Faith', core: 'David chose a different game instead of being braver at the same one.', hook: 'Everyone remembers the sling. Nobody remembers that he refused the armour.', tags: ['faith', 'strategy'], sources: ['1 & 2 Samuel'], profile: 'published' },
      { title: 'Samson and the Cost of Appetite', series: 'Failure', core: 'Great strength with no self-governance is a countdown.', tags: ['discipline', 'failure'], sources: [], profile: 'visual' },
      { title: 'Jonah Ran the Other Way', series: 'Faith', core: 'Avoidance doesn’t remove the calling; it only adds a storm.', hook: 'God said go east. Jonah bought a ticket west.', tags: ['fear', 'avoidance'], profile: 'voice' },
      { title: 'Peter’s Denial by the Fire', series: 'Redemption', core: 'The loudest loyalty often hides the deepest fear.', hook: 'He swore he would die for him. Hours later he swore he never knew him.', tags: ['fear', 'redemption'], sources: ['Luke'], profile: 'qc' },
      { title: 'The Prodigal Son’s Older Brother', series: 'Family', core: 'Resentment can live inside obedience.', hook: 'The son who stayed home was the one who was truly lost.', tags: ['envy', 'family', 'forgiveness'], sources: ['Luke'], profile: 'ready' },
      { title: 'Zacchaeus Climbed a Tree', series: 'Redemption', core: 'Desperation overcomes status anxiety.', tags: ['status', 'redemption'], sources: ['Luke'], profile: 'script' },
      { title: 'Judas and the Price of Thirty Coins', series: 'Failure', core: 'Betrayal is rarely about the money.', tags: ['betrayal', 'incentives'], profile: 'blocked' },
      { title: 'Moses Didn’t Want the Job', series: 'Faith', core: 'Reluctance is not disqualification.', hook: 'He argued with a burning bush. And lost.', tags: ['fear', 'leadership'], sources: ['Exodus'], profile: 'voice' },
      { title: 'Why the Israelites Wanted Egypt Back', series: 'Human Nature', core: 'Freedom is harder than slavery because slavery requires no decisions.', tags: ['freedom', 'fear'], sources: ['Exodus'], profile: 'voice' },
      { title: 'Nebuchadnezzar Ate Grass', series: 'Power', core: 'Pride turns a king into an animal — literally.', tags: ['pride', 'power'], sources: ['Daniel'], profile: 'research' },
      { title: 'Daniel and the Habit That Got Him Arrested', series: 'Faith', core: 'Consistency is visible; it can be used against you, and it is still worth it.', tags: ['discipline', 'faith'], sources: ['Daniel'], profile: 'idea' },
      { title: 'Esther: The Risk of Speaking Up', series: 'Power', core: '“If I perish, I perish.” Courage as a calculated bet.', tags: ['courage', 'risk'], profile: 'idea' },
      { title: 'Ruth Stayed', series: 'Family', core: 'Loyalty chosen when leaving was easier.', tags: ['loyalty', 'family'], profile: 'idea' },
      { title: 'Elijah After the Victory', series: 'Human Nature', core: 'Burnout follows the mountaintop.', hook: 'He called down fire from heaven. The next day he asked to die.', tags: ['burnout', 'fear'], profile: 'script' },
      { title: 'Martha Was Busy', series: 'Human Nature', core: 'Productivity can be a way of avoiding presence.', tags: ['attention'], sources: ['Luke'], profile: 'idea' },
      { title: 'Thomas Wanted Evidence', series: 'Faith', core: 'Doubt as honesty, not rebellion.', tags: ['doubt', 'faith'], profile: 'visual' },
      { title: 'Saul Becomes Paul', series: 'Redemption', core: 'Identity change is possible, and it is violent to the old self.', tags: ['identity', 'redemption'], sources: ['Acts'], profile: 'idea' },
      { title: 'Ananias and Sapphira: The Performance of Generosity', series: 'Failure', core: 'Wanting the reputation without the cost.', tags: ['status', 'deception'], sources: ['Acts'], profile: 'blocked' },
      { title: 'Abraham and the Knife', series: 'Faith', core: 'What are you unwilling to let go of?', tags: ['faith', 'attachment'], sources: ['Genesis'], profile: 'research' },
      { title: 'Jacob Wrestled Until Dawn', series: 'Redemption', core: 'Transformation leaves a limp.', tags: ['identity', 'struggle'], sources: ['Genesis'], profile: 'voice' },
      { title: 'Absalom’s Beautiful Rebellion', series: 'Family', core: 'Charisma without character.', tags: ['ego', 'family', 'power'], sources: ['1 & 2 Samuel'], profile: 'idea' },
      { title: 'Pilate Washed His Hands', series: 'Power', core: 'Avoiding a decision is a decision.', tags: ['responsibility', 'power'], profile: 'published' },
      { title: 'The Rich Young Ruler Walked Away Sad', series: 'Human Nature', core: 'He wanted eternal life as an add-on.', tags: ['money', 'attachment'], sources: ['Luke'], profile: 'edit' },
      { title: 'Job’s Friends Were Wrong', series: 'Faith', core: 'Explaining suffering is often a way to feel safe from it.', tags: ['suffering', 'faith'], profile: 'idea' },
      { title: 'Noah Built for a Flood No One Believed', series: 'Faith', core: 'Preparation looks foolish until it doesn’t.', tags: ['faith', 'discipline'], sources: ['Genesis'], profile: 'published' },
      { title: 'Gideon Asked for Signs Twice', series: 'Faith', core: 'Even the brave negotiate with fear.', tags: ['doubt', 'courage'], profile: 'idea' },
    ],
  },
  {
    name: 'Wisdom Genome',
    code: 'WG',
    color: '#3d6b5c',
    target: 500,
    type: 'animated-reel',
    description: 'Principles, frameworks and perspectives from notable thinkers, investors, entrepreneurs and philosophers — decoded into their underlying “genes” of wisdom.',
    goal: 'Build the definitive visual library of how great thinkers actually think.',
    series: [
      { title: 'Money', description: 'How the wise think about wealth.', target: 50, tags: ['money'] },
      { title: 'Discipline', description: 'Self-governance, habits and restraint.', target: 50, tags: ['discipline'] },
      { title: 'Ego', description: 'The enemy inside.', target: 50, tags: ['ego'] },
      { title: 'Decision Making', description: 'Mental models for better choices.', target: 50, tags: ['decisions', 'mental-models'] },
      { title: 'Risk', description: 'Survival, ruin and asymmetry.', target: 50, tags: ['risk'] },
      { title: 'Time', description: 'Compounding, patience and mortality.', target: 50, tags: ['time'] },
      { title: 'Status', description: 'The games people play.', target: 50, tags: ['status'] },
      { title: 'Relationships', description: 'Trust, loyalty and influence.', target: 50, tags: ['relationships'] },
      { title: 'Success', description: 'What winning actually looks like.', target: 50, tags: ['success'] },
      { title: 'Meaning', description: 'Why any of it matters.', target: 50, tags: ['meaning'] },
    ],
    sources: [
      { title: 'Poor Charlie’s Almanack', type: 'BOOK', author: 'Charlie Munger', person: 'Charlie Munger', potential: 30, status: 'IN_PROGRESS', insights: ['Invert, always invert: avoid stupidity rather than seeking brilliance.', 'Show me the incentive and I will show you the outcome.', 'Envy is the only deadly sin you cannot have fun with.', 'Mental models from many disciplines beat deep expertise in one.'] },
      { title: 'The Almanack of Naval Ravikant', type: 'BOOK', author: 'Eric Jorgenson', person: 'Naval Ravikant', potential: 25, status: 'PROCESSED', insights: ['Seek wealth, not money or status.', 'Specific knowledge cannot be taught, but it can be learned.', 'Play long-term games with long-term people.'] },
      { title: 'Berkshire Hathaway Shareholder Letters', type: 'ARTICLE', author: 'Warren Buffett', person: 'Warren Buffett', potential: 40, status: 'IN_PROGRESS', insights: ['Rule number one: never lose money.', 'Be fearful when others are greedy.', 'Reputation takes 20 years to build and five minutes to ruin.'] },
      { title: 'Letters from a Stoic', type: 'BOOK', author: 'Seneca', person: 'Seneca', potential: 30, status: 'IN_PROGRESS', insights: ['We suffer more in imagination than in reality.', 'It is not that we have a short time to live, but that we waste a lot of it.'] },
      { title: 'Meditations', type: 'BOOK', author: 'Marcus Aurelius', person: 'Marcus Aurelius', potential: 30, status: 'QUEUED', insights: ['The obstacle is the way.'] },
      { title: 'Antifragile', type: 'BOOK', author: 'Nassim Nicholas Taleb', person: 'Nassim Taleb', potential: 20, status: 'QUEUED', insights: ['Avoid ruin: survival is the precondition for every return.', 'Skin in the game filters out bad advice.'] },
      { title: 'Principles', type: 'BOOK', author: 'Ray Dalio', person: 'Ray Dalio', potential: 20, status: 'QUEUED' },
      { title: 'Paul Graham Essays', type: 'ARTICLE', author: 'Paul Graham', person: 'Paul Graham', potential: 25, status: 'QUEUED', insights: ['Keep your identity small.', 'Do things that don’t scale.'] },
      { title: 'Naval — The Joe Rogan Experience #1309', type: 'PODCAST', author: 'Joe Rogan', person: 'Naval Ravikant', potential: 6, status: 'PROCESSED' },
    ],
    episodes: [
      { title: 'Munger’s Inversion: Avoid Stupidity First', series: 'Decision Making', core: 'It is easier to avoid stupidity than to seek brilliance.', hook: 'Charlie Munger got rich by asking one strange question: how would I fail?', tags: ['mental-models', 'decisions'], sources: ['Poor Charlie’s Almanack'], profile: 'published' },
      { title: 'Show Me the Incentive', series: 'Decision Making', core: 'Behaviour follows incentives more reliably than values.', hook: 'If you want to predict what anyone will do, ignore what they say.', tags: ['incentives'], sources: ['Poor Charlie’s Almanack'], profile: 'ready' },
      { title: 'Envy: The Sin With No Upside', series: 'Ego', core: 'Envy is the only deadly sin you cannot enjoy.', tags: ['envy', 'ego'], sources: ['Poor Charlie’s Almanack'], profile: 'voice' },
      { title: 'Naval: Seek Wealth, Not Money or Status', series: 'Money', core: 'Wealth is assets that earn while you sleep; status is a zero-sum game.', hook: 'Money and status look the same from far away. Up close they are opposites.', tags: ['money', 'status'], sources: ['The Almanack of Naval Ravikant'], profile: 'published' },
      { title: 'Specific Knowledge', series: 'Success', core: 'The knowledge that cannot be trained is the knowledge that cannot be replaced.', tags: ['career', 'success'], sources: ['The Almanack of Naval Ravikant'], profile: 'scheduled' },
      { title: 'Long-Term Games With Long-Term People', series: 'Relationships', core: 'All returns in life come from compound interest — including trust.', tags: ['relationships', 'time'], sources: ['The Almanack of Naval Ravikant'], profile: 'edit' },
      { title: 'Buffett’s Rule #1', series: 'Risk', core: 'Never lose money: the maths of ruin.', hook: 'Lose 50% and you need 100% just to get back to zero.', tags: ['risk', 'money'], sources: ['Berkshire Hathaway Shareholder Letters'], profile: 'published' },
      { title: 'Fearful When Others Are Greedy', series: 'Risk', core: 'The crowd is the price setter; temperament is the edge.', tags: ['risk', 'psychology'], sources: ['Berkshire Hathaway Shareholder Letters'], profile: 'visual' },
      { title: 'Twenty Years to Build, Five Minutes to Ruin', series: 'Success', core: 'Reputation is an asset with asymmetric downside.', tags: ['reputation'], sources: ['Berkshire Hathaway Shareholder Letters'], profile: 'voice' },
      { title: 'Seneca: We Suffer More in Imagination', series: 'Discipline', core: 'Fear rehearses disasters that never arrive.', hook: 'Most of what you fear will never happen. Seneca knew why.', tags: ['fear', 'stoicism'], sources: ['Letters from a Stoic'], profile: 'qc' },
      { title: 'Life Is Long If You Know How to Use It', series: 'Time', core: 'We are not given a short life; we make it short.', tags: ['time', 'stoicism'], sources: ['Letters from a Stoic'], profile: 'voice' },
      { title: 'The Obstacle Is the Way', series: 'Discipline', core: 'What stands in the way becomes the way.', tags: ['stoicism', 'resilience'], sources: ['Meditations'], profile: 'script' },
      { title: 'Taleb: Survival First', series: 'Risk', core: 'Avoid ruin; everything else is optional.', tags: ['risk'], sources: ['Antifragile'], profile: 'research' },
      { title: 'Skin in the Game', series: 'Decision Making', core: 'Never take advice from someone who doesn’t pay for being wrong.', tags: ['incentives', 'risk'], sources: ['Antifragile'], profile: 'idea' },
      { title: 'Keep Your Identity Small', series: 'Ego', core: 'The more labels you hold, the dumber you get about them.', tags: ['identity', 'ego'], sources: ['Paul Graham Essays'], profile: 'voice' },
      { title: 'Do Things That Don’t Scale', series: 'Success', core: 'The unscalable beginning is the moat.', tags: ['startups'], sources: ['Paul Graham Essays'], profile: 'idea' },
      { title: 'Dalio: Pain + Reflection = Progress', series: 'Discipline', core: 'Pain is information if you stop to read it.', tags: ['learning'], sources: ['Principles'], profile: 'idea' },
      { title: 'Status Games Never End', series: 'Status', core: 'Status is relative; there is no finish line.', tags: ['status'], profile: 'blocked' },
      { title: 'The Compounding of Small Decisions', series: 'Time', core: 'Tiny edges, long durations.', tags: ['time', 'compounding'], profile: 'script' },
      { title: 'Why Smart People Make Dumb Money Decisions', series: 'Money', core: 'Intelligence is not temperament.', tags: ['money', 'psychology'], profile: 'voice' },
      { title: 'Meaning Is a Byproduct', series: 'Meaning', core: 'Chasing meaning directly tends to repel it.', tags: ['meaning'], profile: 'idea' },
    ],
  },
  {
    name: 'Human Operating System',
    code: 'HOS',
    color: '#4a5a8a',
    target: 1000,
    type: 'animated-reel',
    description: 'Large-scale synthesis of lessons from hundreds of books on psychology, habits, money, business, philosophy and behaviour.',
    goal: 'A complete, navigable “manual” for the human mind — one principle per episode.',
    series: [
      { title: 'Habits', description: 'The machinery of repeated behaviour.', target: 150, tags: ['habits'] },
      { title: 'Attention', description: 'Focus as the scarcest resource.', target: 120, tags: ['attention'] },
      { title: 'Money Behaviour', description: 'How people actually behave with money.', target: 150, tags: ['money'] },
      { title: 'Emotions', description: 'Fear, anger, shame and what they do to decisions.', target: 150, tags: ['emotions'] },
      { title: 'Identity', description: 'The stories we tell about who we are.', target: 120, tags: ['identity'] },
      { title: 'Biases', description: 'Systematic errors in thinking.', target: 200, tags: ['biases', 'psychology'] },
    ],
    sources: [
      { title: 'Atomic Habits', type: 'BOOK', author: 'James Clear', person: 'James Clear', potential: 40, status: 'IN_PROGRESS', insights: ['Every action is a vote for the type of person you wish to become.', 'You do not rise to the level of your goals; you fall to the level of your systems.', 'Make it obvious, attractive, easy and satisfying.', 'Habits are the compound interest of self-improvement.'] },
      { title: 'Thinking, Fast and Slow', type: 'BOOK', author: 'Daniel Kahneman', person: 'Daniel Kahneman', potential: 50, status: 'IN_PROGRESS', insights: ['Losses loom larger than gains.', 'What you see is all there is (WYSIATI).', 'The planning fallacy: we underestimate time, costs and risks.'] },
      { title: 'The Psychology of Money', type: 'BOOK', author: 'Morgan Housel', person: 'Morgan Housel', potential: 25, status: 'PROCESSED', insights: ['Financial behaviour is driven more by behaviour and incentives than by raw intelligence.', 'Wealth is what you don’t see.', 'Enough is realising that the opposite is an insatiable appetite.'] },
      { title: 'Deep Work', type: 'BOOK', author: 'Cal Newport', person: 'Cal Newport', potential: 20, status: 'QUEUED', insights: ['Attention residue: switching tasks leaves part of your mind behind.'] },
      { title: 'Man’s Search for Meaning', type: 'BOOK', author: 'Viktor Frankl', person: 'Viktor Frankl', potential: 15, status: 'QUEUED', insights: ['Between stimulus and response there is a space.'] },
      { title: 'The Courage to Be Disliked', type: 'BOOK', author: 'Ichiro Kishimi & Fumitake Koga', potential: 18, status: 'QUEUED' },
      { title: 'Influence', type: 'BOOK', author: 'Robert Cialdini', person: 'Robert Cialdini', potential: 20, status: 'QUEUED', insights: ['Reciprocity: we feel obliged to return favours, even unwanted ones.', 'Social proof is strongest under uncertainty.'] },
      { title: 'Huberman Lab — Dopamine Episode', type: 'PODCAST', author: 'Andrew Huberman', potential: 5, status: 'PROCESSED' },
    ],
    episodes: [
      { title: 'Every Action Is a Vote', series: 'Identity', core: 'Habits change identity one vote at a time.', hook: 'You don’t become disciplined. You collect evidence that you already are.', tags: ['habits', 'identity'], sources: ['Atomic Habits'], profile: 'published' },
      { title: 'You Fall to the Level of Your Systems', series: 'Habits', core: 'Goals set direction; systems determine results.', tags: ['habits', 'systems'], sources: ['Atomic Habits'], profile: 'published' },
      { title: 'Make It Obvious', series: 'Habits', core: 'Environment design beats motivation.', tags: ['habits', 'environment'], sources: ['Atomic Habits'], profile: 'ready' },
      { title: 'The 1% Rule', series: 'Habits', core: '1% better daily is 37x in a year.', tags: ['habits', 'compounding'], sources: ['Atomic Habits'], profile: 'voice' },
      { title: 'Habit Stacking', series: 'Habits', core: 'Anchor a new habit to an existing one.', tags: ['habits'], sources: ['Atomic Habits'], profile: 'voice' },
      { title: 'Loss Aversion: Why Losing Hurts Twice as Much', series: 'Biases', core: 'Losses loom larger than gains.', hook: 'Losing $100 hurts more than finding $100 feels good. Here is why.', tags: ['biases', 'money'], sources: ['Thinking, Fast and Slow'], profile: 'published' },
      { title: 'What You See Is All There Is', series: 'Biases', core: 'The mind builds confident stories from incomplete data.', tags: ['biases'], sources: ['Thinking, Fast and Slow'], profile: 'edit' },
      { title: 'The Planning Fallacy', series: 'Biases', core: 'Everything takes longer than you think — even when you know this.', tags: ['biases', 'time'], sources: ['Thinking, Fast and Slow'], profile: 'voice' },
      { title: 'Wealth Is What You Don’t See', series: 'Money Behaviour', core: 'Rich is spending; wealthy is not spending.', tags: ['money'], sources: ['The Psychology of Money'], profile: 'scheduled' },
      { title: 'Behaviour Beats Intelligence With Money', series: 'Money Behaviour', core: 'Financial behaviour is driven more by behaviour and incentives than raw intelligence.', tags: ['money', 'incentives'], sources: ['The Psychology of Money'], profile: 'published' },
      { title: 'The Art of Enough', series: 'Money Behaviour', core: 'The hardest financial skill is getting the goalpost to stop moving.', tags: ['money', 'contentment'], sources: ['The Psychology of Money'], profile: 'qc' },
      { title: 'Attention Residue', series: 'Attention', core: 'Switching tasks leaves part of your mind behind.', tags: ['attention', 'focus'], sources: ['Deep Work'], profile: 'visual' },
      { title: 'The Space Between Stimulus and Response', series: 'Emotions', core: 'Freedom lives in the pause.', tags: ['emotions', 'meaning'], sources: ['Man’s Search for Meaning'], profile: 'voice' },
      { title: 'Reciprocity: The Unwanted Favour', series: 'Biases', core: 'We feel obliged to return favours, even unwanted ones.', tags: ['influence', 'biases'], sources: ['Influence'], profile: 'voice' },
      { title: 'Social Proof Under Uncertainty', series: 'Biases', core: 'When unsure, we copy.', tags: ['influence', 'biases'], sources: ['Influence'], profile: 'script' },
      { title: 'Dopamine Is About Wanting, Not Having', series: 'Emotions', core: 'The chase is the chemical.', tags: ['dopamine', 'emotions'], sources: ['Huberman Lab — Dopamine Episode'], profile: 'blocked' },
      { title: 'Shame vs Guilt', series: 'Emotions', core: 'Guilt says I did something bad; shame says I am bad.', tags: ['emotions', 'identity'], profile: 'idea' },
      { title: 'The Spotlight Effect', series: 'Biases', core: 'Nobody is watching you as closely as you think.', tags: ['biases', 'anxiety'], profile: 'script' },
      { title: 'Why We Procrastinate on Important Things', series: 'Habits', core: 'Procrastination is emotion regulation, not time management.', tags: ['procrastination', 'emotions'], profile: 'research' },
      { title: 'Identity Foreclosure', series: 'Identity', core: 'Choosing who you are too early.', tags: ['identity'], profile: 'idea' },
      { title: 'The Courage to Be Disliked', series: 'Identity', core: 'Freedom is being disliked by some people.', tags: ['identity', 'courage'], sources: ['The Courage to Be Disliked'], profile: 'idea' },
    ],
  },
  {
    name: 'Human Failure Archive',
    code: 'HFA',
    color: '#9e4a3d',
    target: 300,
    type: 'animated-reel',
    description: 'An archive of failures, collapses, bad decisions and missed opportunities — and the incentives, ego and risk behind them.',
    goal: 'Make failure studyable. Every episode isolates one mechanism of collapse.',
    series: [
      { title: 'Ego', description: 'When confidence became blindness.', target: 60, tags: ['ego', 'hubris'] },
      { title: 'Incentives', description: 'Systems that rewarded the wrong thing.', target: 60, tags: ['incentives'] },
      { title: 'Risk', description: 'Leverage, fragility and ruin.', target: 60, tags: ['risk', 'leverage'] },
      { title: 'Missed Opportunities', description: 'The future that was offered and declined.', target: 60, tags: ['innovation', 'missed-opportunity'] },
      { title: 'Collapse', description: 'How giants actually fall.', target: 60, tags: ['collapse'] },
    ],
    sources: [
      { title: 'Bad Blood', type: 'BOOK', author: 'John Carreyrou', potential: 8, status: 'PROCESSED', insights: ['Theranos survived on secrecy because secrecy prevented falsification.'] },
      { title: 'The Smartest Guys in the Room', type: 'BOOK', author: 'Bethany McLean & Peter Elkind', potential: 8, status: 'QUEUED', insights: ['Mark-to-market accounting let Enron book imaginary profits on day one.'] },
      { title: 'When Genius Failed', type: 'BOOK', author: 'Roger Lowenstein', potential: 6, status: 'QUEUED', insights: ['LTCM had Nobel laureates and 25:1 leverage. The leverage mattered more.'] },
      { title: 'Billion Dollar Loser', type: 'BOOK', author: 'Reeves Wiedeman', potential: 5, status: 'QUEUED' },
      { title: 'Losing the Signal', type: 'BOOK', author: 'Jacquie McNish & Sean Silcoff', potential: 5, status: 'QUEUED' },
      { title: 'Acquired — Nokia episode', type: 'PODCAST', author: 'Acquired', potential: 3, status: 'QUEUED' },
    ],
    episodes: [
      { title: 'Blockbuster Laughed at Netflix', series: 'Missed Opportunities', core: 'Incumbents can see the future and still decline it if it threatens today’s profit.', hook: 'In 2000, Netflix offered itself to Blockbuster for $50 million. They laughed.', tags: ['missed-opportunity', 'incentives'], profile: 'published' },
      { title: 'Kodak Invented the Digital Camera', series: 'Missed Opportunities', core: 'They invented the thing that killed them, then buried it.', tags: ['innovation', 'missed-opportunity'], profile: 'published' },
      { title: 'Enron: Profits That Never Existed', series: 'Incentives', core: 'Mark-to-market accounting let Enron book imaginary profits.', tags: ['incentives', 'fraud'], sources: ['The Smartest Guys in the Room'], profile: 'voice' },
      { title: 'LTCM: Nobel Prizes and 25:1 Leverage', series: 'Risk', core: 'Brilliance doesn’t protect against leverage.', hook: 'Two Nobel Prize winners. Four years. $4.6 billion gone.', tags: ['risk', 'leverage'], sources: ['When Genius Failed'], profile: 'edit' },
      { title: 'Theranos and the Power of Secrecy', series: 'Ego', core: 'Secrecy prevented falsification — until it didn’t.', tags: ['ego', 'fraud'], sources: ['Bad Blood'], profile: 'ready' },
      { title: 'WeWork: Vibes as a Business Model', series: 'Ego', core: 'Narrative outran numbers.', tags: ['ego', 'hubris'], sources: ['Billion Dollar Loser'], profile: 'visual' },
      { title: 'Nokia Didn’t Lose to Apple. It Lost to Itself.', series: 'Collapse', core: 'Organisational fear paralysed a market leader.', tags: ['collapse', 'culture'], sources: ['Acquired — Nokia episode'], profile: 'voice' },
      { title: 'BlackBerry and the Keyboard', series: 'Collapse', core: 'Loving your product more than your customer.', tags: ['collapse', 'innovation'], sources: ['Losing the Signal'], profile: 'blocked' },
      { title: 'Lehman Brothers: Too Big to Save', series: 'Risk', core: 'Concentration and leverage.', tags: ['risk', 'leverage'], profile: 'voice' },
      { title: 'Newton Lost a Fortune in the South Sea Bubble', series: 'Risk', core: '“I can calculate the motion of heavenly bodies, but not the madness of people.”', hook: 'Isaac Newton was one of the smartest humans who ever lived. He still went broke in a bubble.', tags: ['risk', 'bubbles'], profile: 'qc' },
      { title: 'Tulip Mania', series: 'Risk', core: 'Price detached from value.', tags: ['bubbles'], profile: 'idea' },
      { title: 'Napoleon Marched on Moscow', series: 'Ego', core: 'Overextension disguised as ambition.', tags: ['ego', 'overextension'], profile: 'script' },
      { title: 'The Concorde Fallacy', series: 'Incentives', core: 'Sunk costs keep bad projects alive.', tags: ['sunk-cost', 'biases'], profile: 'voice' },
      { title: 'Quibi: $1.75B and Six Months', series: 'Ego', core: 'Experience in an old world can be a liability in a new one.', tags: ['ego', 'startups'], profile: 'idea' },
      { title: 'Boeing 737 MAX: When Finance Ran Engineering', series: 'Incentives', core: 'Culture follows whoever controls the incentives.', tags: ['incentives', 'culture'], profile: 'research' },
      { title: 'Decca Rejected the Beatles', series: 'Missed Opportunities', core: '“Guitar groups are on their way out.”', tags: ['missed-opportunity'], profile: 'idea' },
      { title: 'Yahoo Could Have Bought Google for $1M', series: 'Missed Opportunities', core: 'Optimising the current game blinds you to the next one.', tags: ['missed-opportunity'], profile: 'script' },
      { title: 'FTX: Effective Altruism and Ineffective Accounting', series: 'Incentives', core: 'Noble narratives can shelter ignoble practices.', tags: ['fraud', 'incentives'], profile: 'idea' },
    ],
  },
  {
    name: 'Impossible Question Machine',
    code: 'IQM',
    color: '#5a4a8a',
    target: 1000,
    type: 'quote-card',
    description: 'A library of difficult questions about behaviour, ambition, money, identity, meaning, relationships and success.',
    goal: 'Questions people screenshot and send to a friend at 2am.',
    series: [
      { title: 'Ambition', description: 'Why we want what we want.', target: 200, tags: ['ambition'] },
      { title: 'Money', description: 'Questions about price, value and enough.', target: 200, tags: ['money'] },
      { title: 'Identity', description: 'Who are you when no one is watching?', target: 200, tags: ['identity'] },
      { title: 'Meaning', description: 'Questions with no clean answer.', target: 200, tags: ['meaning'] },
      { title: 'Relationships', description: 'Love, loyalty and leaving.', target: 200, tags: ['relationships'] },
    ],
    sources: [{ title: 'Personal notebook — late night questions', type: 'NOTE', potential: 100, status: 'IN_PROGRESS', insights: ['People share questions that let them signal depth without committing to an answer.'] }],
    episodes: [
      { title: 'Would you trade 10 years of your life for $10 million?', series: 'Money', tags: ['money', 'time'], profile: 'published' },
      { title: 'If no one would ever know, would you still be good?', series: 'Identity', tags: ['ethics', 'identity'], profile: 'published' },
      { title: 'Are you ambitious, or just afraid of being ordinary?', series: 'Ambition', tags: ['ambition', 'fear'], profile: 'published' },
      { title: 'Who would you be without your job title?', series: 'Identity', tags: ['identity', 'work'], profile: 'ready' },
      { title: 'Do you want success, or to be seen as successful?', series: 'Ambition', tags: ['status', 'ambition'], profile: 'ready' },
      { title: 'If you could delete one memory, would you?', series: 'Meaning', tags: ['memory', 'meaning'], profile: 'ready' },
      { title: 'Would you rather be respected or liked?', series: 'Relationships', tags: ['relationships', 'status'], profile: 'qc' },
      { title: 'What are you pretending not to know?', series: 'Identity', tags: ['honesty', 'identity'], profile: 'scheduled' },
      { title: 'How much money is enough — exactly?', series: 'Money', tags: ['money', 'contentment'], profile: 'visual' },
      { title: 'Is your personality just your coping mechanisms?', series: 'Identity', tags: ['identity', 'psychology'], profile: 'script' },
      { title: 'Would you still chase it if no one could see you win?', series: 'Ambition', tags: ['ambition', 'status'], profile: 'visual' },
      { title: 'Who are you still trying to prove wrong?', series: 'Ambition', tags: ['ambition', 'ego'], profile: 'published' },
      { title: 'What would you do differently if you knew nobody would judge you?', series: 'Meaning', tags: ['fear', 'freedom'], profile: 'idea' },
      { title: 'Is loyalty a virtue if it is to the wrong person?', series: 'Relationships', tags: ['loyalty', 'relationships'], profile: 'blocked' },
      { title: 'Are you tired, or are you bored of your own life?', series: 'Meaning', tags: ['meaning', 'burnout'], profile: 'script' },
      { title: 'What price would make you abandon your values?', series: 'Money', tags: ['money', 'ethics'], profile: 'idea' },
    ],
  },
];

const IDEAS: { title: string; thought: string; project?: string; series?: string; source?: string; age: number; status?: string; tags?: string[]; priority?: number }[] = [
  { title: 'Series on biblical siblings', thought: 'Cain/Abel, Jacob/Esau, Joseph/brothers, Prodigal sons. Rivalry as a recurring pattern across the whole book.', project: 'BIB', series: 'Family', age: 142, tags: ['family', 'envy'] },
  { title: 'Leaders who refused power', thought: 'Gideon refusing kingship, Cincinnatus, Washington. Power that walks away.', project: 'WG', age: 96, tags: ['power', 'leadership'] },
  { title: 'Failure archive: “almost” companies', thought: 'Companies that were one decision away from being giants (Xerox PARC, General Magic).', project: 'HFA', series: 'Missed Opportunities', age: 120, tags: ['missed-opportunity', 'innovation'] },
  { title: 'Question: would you want to know the day you die?', thought: 'Mortality + planning. Could be a carousel with follow-up questions.', project: 'IQM', age: 75, tags: ['meaning', 'time'] },
  { title: 'Munger’s 25 biases as a mini-series', thought: 'The Psychology of Human Misjudgment talk — each tendency is an episode.', project: 'WG', source: 'Poor Charlie’s Almanack', age: 61, status: 'DEVELOPING', tags: ['biases', 'mental-models'] },
  { title: 'The dark side of discipline', thought: 'When discipline becomes rigidity or self-punishment. Counter-programming.', project: 'HOS', age: 48, tags: ['discipline'] },
  { title: 'Visual motif: hands', thought: 'Use hands as a recurring visual across Bible episodes — receiving, grasping, letting go.', project: 'BIB', age: 33, tags: ['visual-style'] },
  { title: 'What Seneca would say about social media', thought: 'Letters on crowds and reputation applied to likes and followers.', project: 'WG', source: 'Letters from a Stoic', age: 210, tags: ['stoicism', 'attention'] },
  { title: 'Theranos vs FTX: the same story?', thought: 'Charismatic founder, missing controls, believers. Comparative episode.', project: 'HFA', age: 88, tags: ['fraud', 'ego'] },
  { title: 'Money questions for couples', thought: 'A batch of IQM questions specifically for partners.', project: 'IQM', series: 'Relationships', age: 12, tags: ['money', 'relationships'] },
  { title: 'Daily habits of biblical figures', thought: 'Daniel praying three times daily, Jesus withdrawing to pray early. Habit lens on scripture.', project: 'BIB', age: 6, tags: ['habits', 'discipline'] },
  { title: 'Kahneman’s “noise” as a follow-up', thought: 'Read Noise and extract 10 principles for HOS biases series.', project: 'HOS', age: 3, tags: ['biases'] },
  { title: 'Why people stay in jobs they hate', thought: 'Status quo bias + identity + loss aversion. Could be HOS or IQM.', age: 2, tags: ['work', 'biases'] },
  { title: 'A “Wisdom Genome” map as a poster product', thought: 'Merch idea: a visual genome chart of all principles once we hit 200 episodes.', age: 1, tags: ['product'] },
  { title: 'The Pharisees as status-seekers', thought: 'Religious performance as a status game. Connect to WG Status series.', project: 'BIB', series: 'Human Nature', age: 180, tags: ['status', 'pride'] },
  { title: 'Investors who failed publicly and recovered', thought: 'Bill Ackman, Ray Dalio 1982. Bridge between WG and HFA.', project: 'HFA', age: 54, status: 'PARKED', tags: ['risk', 'redemption'] },
  { title: 'Question: is ambition a form of ingratitude?', thought: 'Tension between contentment and drive.', project: 'IQM', series: 'Ambition', age: 40, tags: ['ambition', 'contentment'] },
  { title: 'Attention as rent', thought: 'Every app is a landlord for your attention. Metaphor for HOS attention series.', project: 'HOS', series: 'Attention', age: 22, tags: ['attention'] },
  { title: 'Elijah, burnout and modern work', thought: 'Pair with HOS emotions — burnout after victory.', project: 'BIB', age: 5, status: 'DEVELOPING', tags: ['burnout'] },
  { title: 'The real reason Blockbuster said no', thought: 'Late fees were ~16% of revenue. Incentive analysis follow-up.', project: 'HFA', series: 'Incentives', age: 0, tags: ['incentives'] },
  { title: 'Taleb’s barbell for careers', thought: 'Safe job + wild bets. Practical episode.', project: 'WG', source: 'Antifragile', age: 70, tags: ['risk', 'career'] },
  { title: 'Questions to ask your 80-year-old self', thought: 'IQM series anchored on regret minimisation.', project: 'IQM', age: 155, tags: ['meaning', 'regret'] },
  { title: 'Every Proverb about money, ranked', thought: 'Could become a long-form video for BIB or WG.', age: 98, tags: ['money'] },
  { title: 'Identity loss after retirement', thought: 'HOS identity series — athletes and executives.', project: 'HOS', series: 'Identity', age: 35, tags: ['identity', 'work'] },
];

export function seedDemo({ scale = 0 }: { scale?: number } = {}) {
  rand = mulberry32(42);
  const d = db();
  const ctByKey = new Map((d.prepare('SELECT id, key FROM content_types').all() as { id: number; key: string }[]).map((r) => [r.key, r.id]));
  const activity: { at: string; action: string; type: string; id: number; ep: number | null; proj: number | null; summary: string; actor?: string }[] = [];

  d.transaction(() => {
    const insProject = d.prepare('INSERT INTO projects (name, code, description, goal, status, target_count, color, default_content_type_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insSeries = d.prepare('INSERT INTO series (project_id, title, description, target_count, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insPerson = d.prepare('INSERT INTO people (name, kind, bio) VALUES (?, ?, ?)');
    const insSource = d.prepare('INSERT INTO sources (title, type, author, person_id, project_id, citation, status, potential, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insInsight = d.prepare('INSERT INTO insights (source_id, project_id, statement, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    const tagId = (name: string) => {
      const r = d.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined;
      return r ? r.id : Number(d.prepare('INSERT INTO tags (name) VALUES (?)').run(name).lastInsertRowid);
    };

    const people = new Map<string, number>();
    const sourceIds = new Map<string, number>();
    const insightBySource = new Map<number, number[]>();
    const projectIds = new Map<string, number>();
    const seriesIds = new Map<string, number>();

    PROJECTS.forEach((p, pi) => {
      const created = daysAgo(220 - pi * 15);
      const pid = Number(insProject.run(p.name, p.code, p.description, p.goal, p.status ?? 'ACTIVE', p.target, p.color, ctByKey.get(p.type), pi, created, created).lastInsertRowid);
      projectIds.set(p.code, pid);
      p.series.forEach((s, si) => {
        const sid = Number(insSeries.run(pid, s.title, s.description, s.target, si, created, created).lastInsertRowid);
        seriesIds.set(`${p.code}:${s.title}`, sid);
        for (const t of s.tags) d.prepare('INSERT OR IGNORE INTO series_tags (series_id, tag_id) VALUES (?, ?)').run(sid, tagId(t));
      });
      for (const s of p.sources) {
        let personId: number | null = null;
        if (s.person) {
          personId = people.get(s.person) ?? Number(insPerson.run(s.person, s.type === 'SCRIPTURE' ? 'Biblical' : 'Thinker', '').lastInsertRowid);
          people.set(s.person, personId);
        }
        const sc = daysAgo(between(60, 200));
        const sid = Number(insSource.run(s.title, s.type, s.author ?? '', personId, pid, s.citation ?? '', s.status ?? 'QUEUED', s.potential ?? null, '', sc, sc).lastInsertRowid);
        sourceIds.set(s.title, sid);
        insightBySource.set(sid, (s.insights ?? []).map((st) => Number(insInsight.run(sid, pid, st, sc, sc).lastInsertRowid)));
      }
    });

    // ------------------------------------------------------------ episodes
    const insEp = d.prepare(
      `INSERT INTO episodes (project_id, series_id, content_type_id, idea_id, number, title, description, core_idea, hook, script, target_duration_sec, priority, due_date, notes, progress_at, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insStage = d.prepare('INSERT INTO episode_stages (episode_id, stage, status, note, started_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insAsset = d.prepare('INSERT INTO assets (episode_id, kind, name, version, label, status, stage, file_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insPub = d.prepare('INSERT INTO publications (episode_id, platform, account, status, scheduled_at, published_at, url, caption, hashtags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insMetric = d.prepare('INSERT INTO publication_metrics (publication_id, captured_at, views, likes, comments, shares, saves, followers_gained, completion_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insTask = d.prepare('INSERT INTO tasks (episode_id, title, sort_order, done) VALUES (?, ?, ?, ?)');
    const insEpTag = d.prepare('INSERT OR IGNORE INTO episode_tags (episode_id, tag_id) VALUES (?, ?)');
    const insEpSrc = d.prepare('INSERT OR IGNORE INTO episode_sources (episode_id, source_id, locator) VALUES (?, ?, ?)');
    const insEpIns = d.prepare('INSERT OR IGNORE INTO episode_insights (episode_id, insight_id) VALUES (?, ?)');
    const ctChecklist = new Map((d.prepare('SELECT id, checklist FROM content_types').all() as { id: number; checklist: string }[]).map((r) => [r.id, JSON.parse(r.checklist) as string[]]));

    const BLOCK_REASONS: Partial<Record<Stage, string[]>> = {
      VOICE: ['Mic needs replacing — recording on hold', 'Waiting on voice actor availability'],
      VISUAL: ['Character model needs rework', 'Waiting on licensed footage'],
      EDIT: ['Missing final VO take', 'Editor out until next week'],
      RESEARCH: ['Conflicting accounts — need a primary source'],
      SCRIPT: ['Ending doesn’t land — needs a rethink'],
      QC: ['Music licence unclear'],
    };
    const todayPublishedSlots = [4]; // demo: 4 publications already out today
    let publishedTodayLeft = todayPublishedSlots[0];
    let overdueScheduledLeft = 1;

    const allIds: number[] = [];
    const numbers = new Map<number, number>();
    const createEpisode = (projectCode: string, e: SeedEpisode, synthetic = false) => {
      const pid = projectIds.get(projectCode)!;
      const proj = PROJECTS.find((p) => p.code === projectCode)!;
      const sid = e.series ? seriesIds.get(`${projectCode}:${e.series}`) ?? null : null;
      const ctId = ctByKey.get(e.type ?? proj.type)!;
      const modes = contentTypeModes(ctId);
      const n = (numbers.get(pid) ?? 0) + 1;
      numbers.set(pid, n);
      const profile: Profile = e.profile ?? pickProfile();
      const ageDays = profile === 'idea' ? between(1, 200) : profile === 'published' ? between(20, 200) : between(8, 120);
      const created = daysAgo(ageDays);
      const stalled = !synthetic ? false : chance(0.12);
      const lastProgressDays = profile === 'idea' ? null : stalled ? between(15, Math.max(16, ageDays - 1)) : between(0, Math.min(10, ageDays));
      const progressAt = lastProgressDays === null ? null : daysAgo(lastProgressDays);
      const priority = profile === 'blocked' ? pick([0, 1, 2]) : chance(0.08) ? 0 : chance(0.2) ? 1 : chance(0.75) ? 2 : 3;
      const due =
        profile === 'published' || profile === 'idea'
          ? null
          : chance(0.35)
            ? localDate(between(-4, 14))
            : null;
      const scriptText =
        profile === 'idea' || profile === 'research'
          ? ''
          : `${e.hook ?? e.title}\n\n${e.core ?? ''}\n\n[Beat 1] Set the scene.\n[Beat 2] The decision.\n[Beat 3] The consequence.\n[Beat 4] The mirror — where you do this too.\n\nClose: ${e.core ?? e.title}`;

      const id = Number(
        insEp.run(
          pid,
          sid,
          ctId,
          n,
          e.title,
          '',
          e.core ?? '',
          e.hook ?? '',
          scriptText,
          proj.type === 'quote-card' && !e.type ? null : 75,
          priority,
          due,
          '',
          progressAt,
          created,
          progressAt ?? created,
        ).lastInsertRowid,
      );
      allIds.push(id);

      // Stage states from the profile, then sprinkle realistic parallel work.
      const targetPhase = PROFILE_PHASE[profile];
      const states: StageStates = {};
      Object.assign(states, planBoardMove(modes, {}, targetPhase));
      if (profile === 'voice') {
        // Script done, voice not started: the classic VO pile-up.
        states.VOICE = 'NOT_STARTED';
        if (chance(0.45)) states.VISUAL = 'DONE';
        else if (chance(0.4)) states.VISUAL = 'IN_PROGRESS';
      }
      if (profile === 'visual') states.VOICE = 'DONE';
      if (['voice', 'visual', 'edit', 'qc'].includes(profile) && chance(0.45)) states.CAPTION = 'DONE';
      if (['edit', 'qc'].includes(profile) && chance(0.4)) states.COVER = 'DONE';
      if (profile === 'blocked') {
        const blockable = (['RESEARCH', 'SCRIPT', 'VOICE', 'VISUAL', 'EDIT', 'QC'] as Stage[]).filter((s) => modes[s] === 'REQUIRED');
        const stage = pick(blockable.slice(1).length ? blockable.slice(1) : blockable);
        Object.assign(states, planBoardMove(modes, {}, (stageToPhase[stage] ?? 'SCRIPT') as Phase));
        states[stage] = 'BLOCKED';
      }
      for (const s of STAGES) {
        if (modes[s] === 'NONE') states[s] = 'NOT_STARTED';
      }
      // Stage timestamps: the latest completion lands on the last-progress date, earlier ones
      // step back 1–3 days each (never before creation). This gives realistic recent throughput.
      const doneStages = STAGES.filter((s) => states[s] === 'DONE');
      const completedAt = new Map<Stage, string>();
      let back = lastProgressDays ?? 0;
      for (let j = doneStages.length - 1; j >= 0; j--) {
        completedAt.set(doneStages[j], daysAgo(Math.min(back, ageDays)));
        back += between(1, 3);
      }
      for (const s of STAGES) {
        const st = states[s] ?? 'NOT_STARTED';
        const at = completedAt.get(s) ?? null;
        const note = st === 'BLOCKED' ? pick(BLOCK_REASONS[s] ?? ['Waiting on something external']) : '';
        insStage.run(id, s, st, note, st === 'NOT_STARTED' ? null : at ?? progressAt ?? created, at, at ?? progressAt ?? created);
      }

      for (const t of e.tags ?? []) insEpTag.run(id, tagId(t));
      for (const sTitle of e.sources ?? []) {
        const srcId = sourceIds.get(sTitle);
        if (!srcId) continue;
        insEpSrc.run(id, srcId, '');
        const ins = insightBySource.get(srcId) ?? [];
        // Link the insight whose text matches the core idea, otherwise the first one sometimes.
        const match = ins.find((iid) => (d.prepare('SELECT statement FROM insights WHERE id = ?').get(iid) as { statement: string }).statement.slice(0, 25) === (e.core ?? '').slice(0, 25));
        if (match) insEpIns.run(id, match);
        else if (ins.length && chance(0.4)) insEpIns.run(id, ins[0]);
      }
      (ctChecklist.get(ctId) ?? []).forEach((t, i) => insTask.run(id, t, i, ['ready', 'scheduled', 'published'].includes(profile) ? 1 : 0));

      // Assets with versions.
      const code = `${projectCode}-${String(n).padStart(3, '0')}`;
      const root = `D:/GrowMindset/${projectCode}/${code}`;
      const assetAt = progressAt ?? created;
      if (states.SCRIPT === 'DONE' && chance(0.5)) insAsset.run(id, 'SCRIPT_FILE', 'script', 1, '', 'APPROVED', 'SCRIPT', `${root}/script.md`, assetAt, assetAt);
      if (states.VOICE === 'DONE') {
        insAsset.run(id, 'VOICEOVER', 'vo', 1, '', chance(0.3) ? 'REJECTED' : 'APPROVED', 'VOICE', `${root}/vo_v1.wav`, assetAt, assetAt);
        if (chance(0.4)) insAsset.run(id, 'VOICEOVER', 'vo', 2, 'final', 'FINAL', 'VOICE', `${root}/vo_v2_final.wav`, assetAt, assetAt);
      }
      if (states.VISUAL === 'DONE' || states.VISUAL === 'IN_PROGRESS') {
        const kind = modes.EDIT === 'NONE' ? 'IMAGE' : 'ANIMATION';
        insAsset.run(id, kind, 'visual', 1, '', states.VISUAL === 'DONE' ? 'APPROVED' : 'IN_REVIEW', 'VISUAL', `${root}/visual_v1.${kind === 'IMAGE' ? 'png' : 'mp4'}`, assetAt, assetAt);
        if (states.VISUAL === 'DONE' && chance(0.5)) insAsset.run(id, kind, 'visual', 2, 'final', 'FINAL', 'VISUAL', `${root}/visual_final.${kind === 'IMAGE' ? 'png' : 'mp4'}`, assetAt, assetAt);
      }
      if (states.EDIT === 'DONE') insAsset.run(id, 'EXPORT', 'master export', 1, 'final', 'FINAL', 'EDIT', `${root}/${code}_master.mp4`, assetAt, assetAt);
      if (states.COVER === 'DONE') insAsset.run(id, 'COVER', 'cover', 1, '', 'FINAL', 'COVER', `${root}/cover.jpg`, assetAt, assetAt);

      // Publications.
      const platforms = (d.prepare('SELECT default_platforms FROM content_types WHERE id = ?').get(ctId) as { default_platforms: string }).default_platforms.split(',') as Platform[];
      const caption = `${e.hook ?? e.title}\n\n${e.core ?? ''}`.trim();
      const hashtags = (e.tags ?? []).map((t) => `#${t.replace(/-/g, '')}`).join(' ');
      if (profile === 'published') {
        const firstPubDays = publishedTodayLeft > 0 && !synthetic ? 0 : between(1, Math.max(2, Math.min(ageDays - 2, 90)));
        if (firstPubDays === 0) publishedTodayLeft--;
        const pubDate = firstPubDays === 0 ? new Date(Date.now() - between(1, 5) * 3_600_000).toISOString() : daysAgo(firstPubDays);
        const count = between(1, platforms.length);
        for (let i = 0; i < count; i++) {
          const pubId = Number(insPub.run(id, platforms[i], '@growmindset', 'PUBLISHED', null, pubDate, `https://${platforms[i].toLowerCase()}.com/p/${code.toLowerCase()}`, caption, hashtags, pubDate, pubDate).lastInsertRowid);
          if (firstPubDays > 2) {
            const views = between(800, 180000);
            insMetric.run(pubId, daysAgo(Math.max(0, firstPubDays - 3)), views, Math.round(views * (0.03 + rand() * 0.06)), Math.round(views * 0.002), Math.round(views * 0.004), Math.round(views * 0.01), between(0, 400), Math.round((0.35 + rand() * 0.5) * 100) / 100);
          }
        }
        activity.push({ at: pubDate, action: 'published', type: 'episode', id, ep: id, proj: pid, summary: `Published “${e.title}” on ${count} platform${count > 1 ? 's' : ''}` });
      } else if (profile === 'scheduled') {
        const overdue = overdueScheduledLeft > 0 && !synthetic;
        if (overdue) overdueScheduledLeft--;
        const at = overdue ? new Date(Date.now() - 20 * 3_600_000).toISOString() : daysAhead(between(0, 6), between(9, 20));
        insPub.run(id, platforms[0], '@growmindset', 'SCHEDULED', at, null, '', caption, hashtags, progressAt ?? created, progressAt ?? created);
        if (platforms[1] && chance(0.5)) insPub.run(id, platforms[1], '@growmindset', 'DRAFT', null, null, '', caption, hashtags, progressAt ?? created, progressAt ?? created);
      } else if (profile === 'ready' && chance(0.4)) {
        insPub.run(id, platforms[0], '@growmindset', 'READY', null, null, '', caption, hashtags, progressAt ?? created, progressAt ?? created);
      }

      if (!synthetic) {
        activity.push({ at: created, action: 'created', type: 'episode', id, ep: id, proj: pid, summary: `Created episode “${e.title}”` });
        if (progressAt && profile !== 'published') {
          const label: Record<string, string> = {
            research: 'Research done',
            script: 'Concept done, script in progress',
            voice: 'Script done',
            visual: 'Visual in progress',
            edit: 'Voice + visual done',
            qc: 'Edit done',
            ready: 'QC passed',
            scheduled: 'Scheduled',
            blocked: 'Blocked',
          };
          if (label[profile]) activity.push({ at: progressAt, action: profile === 'blocked' ? 'blocked' : 'stage', type: 'episode', id, ep: id, proj: pid, summary: `${e.title}: ${label[profile]}`, actor: chance(0.15) ? 'automation:script-agent' : 'you' });
        }
      }
      return id;
    };

    const curated = new Map<string, number>();
    for (const p of PROJECTS) for (const e of p.episodes) curated.set(e.title, createEpisode(p.code, e));

    // A few relations between related episodes.
    const rel = d.prepare('INSERT OR IGNORE INTO episode_relations (from_id, to_id, kind) VALUES (?, ?, ?)');
    const link = (a: string, b: string, kind = 'RELATED') => curated.get(a) && curated.get(b) && rel.run(curated.get(a), curated.get(b), kind);
    link('Cain and Abel: The First Comparison', 'Envy: The Sin With No Upside');
    link('Cain and Abel: The First Comparison', 'The Prodigal Son’s Older Brother');
    link('Show Me the Incentive', 'Enron: Profits That Never Existed');
    link('Show Me the Incentive', 'Boeing 737 MAX: When Finance Ran Engineering');
    link('LTCM: Nobel Prizes and 25:1 Leverage', 'Buffett’s Rule #1');
    link('Newton Lost a Fortune in the South Sea Bubble', 'Fearful When Others Are Greedy');
    link('Saul: How Insecurity Destroys a King', 'Status Games Never End');
    link('Loss Aversion: Why Losing Hurts Twice as Much', 'Buffett’s Rule #1');
    link('Wealth Is What You Don’t See', 'Naval: Seek Wealth, Not Money or Status');
    link('Behaviour Beats Intelligence With Money', 'Why Smart People Make Dumb Money Decisions', 'DUPLICATE');

    // ------------------------------------------------------------ ideas (with lineage)
    const insIdea = d.prepare('INSERT INTO ideas (title, thought, project_id, series_id, source_id, priority, status, touched_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const i of IDEAS) {
      const pid = i.project ? projectIds.get(i.project)! : null;
      const sid = i.series && i.project ? seriesIds.get(`${i.project}:${i.series}`) ?? null : null;
      const src = i.source ? sourceIds.get(i.source) ?? null : null;
      const created = daysAgo(i.age);
      const touched = i.status === 'DEVELOPING' ? daysAgo(Math.max(0, i.age - between(1, Math.max(1, i.age)))) : created;
      const iid = Number(insIdea.run(i.title, i.thought, pid, sid, src, i.priority ?? 2, i.status ?? 'INBOX', touched, created, created).lastInsertRowid);
      for (const t of i.tags ?? []) d.prepare('INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)').run(iid, tagId(t));
      if (i.age < 20) activity.push({ at: created, action: 'created', type: 'idea', id: iid, ep: null, proj: pid, summary: `Captured idea “${i.title}”` });
    }
    // Converted ideas → episodes (origin lineage: source → insight → idea → episode).
    const lineage: [string, string, string, string][] = [
      ['Munger on envy', 'Envy is the only deadly sin you cannot have fun with.', 'Poor Charlie’s Almanack', 'Envy: The Sin With No Upside'],
      ['Incentives explain everything', 'Show me the incentive and I will show you the outcome.', 'Poor Charlie’s Almanack', 'Show Me the Incentive'],
      ['Behaviour > IQ with money', 'Financial behaviour is driven more by behaviour and incentives than by raw intelligence.', 'The Psychology of Money', 'Behaviour Beats Intelligence With Money'],
      ['Votes for identity', 'Every action is a vote for the type of person you wish to become.', 'Atomic Habits', 'Every Action Is a Vote'],
      ['Joseph — 20 years later', 'Joseph’s brothers betrayed him, yet the story is about what twenty years did to all of them.', 'Genesis', 'Joseph and the Brothers Who Sold Him'],
      ['Saul and insecurity', 'Saul’s collapse began with insecurity, not wickedness.', '1 & 2 Samuel', 'Saul: How Insecurity Destroys a King'],
    ];
    for (const [title, insightText, sourceTitle, episodeTitle] of lineage) {
      const srcId = sourceIds.get(sourceTitle)!;
      const insight = d.prepare('SELECT id FROM insights WHERE source_id = ? AND statement = ?').get(srcId, insightText) as { id: number } | undefined;
      const ep = curated.get(episodeTitle)!;
      const epRow = d.prepare('SELECT project_id, series_id, created_at FROM episodes WHERE id = ?').get(ep) as { project_id: number; series_id: number | null; created_at: string };
      const ideaCreated = new Date(new Date(epRow.created_at).getTime() - 5 * 86_400_000).toISOString();
      const iid = Number(
        d
          .prepare(`INSERT INTO ideas (title, thought, project_id, series_id, source_id, insight_id, priority, status, touched_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 2, 'CONVERTED', ?, ?, ?)`)
          .run(title, insightText, epRow.project_id, epRow.series_id, srcId, insight?.id ?? null, epRow.created_at, ideaCreated, epRow.created_at).lastInsertRowid,
      );
      d.prepare('UPDATE episodes SET idea_id = ? WHERE id = ?').run(iid, ep);
      if (insight) insEpIns.run(ep, insight.id);
    }

    // ------------------------------------------------------------ scale mode: synthetic volume
    if (scale > 0) {
      const subjects = ['envy', 'pride', 'fear', 'money', 'status', 'discipline', 'loyalty', 'power', 'risk', 'time', 'ambition', 'identity', 'attention', 'shame', 'trust', 'regret', 'courage', 'habit', 'greed', 'patience'];
      const frames = ['Why {X} wins in the short term', 'The hidden cost of {X}', 'How {X} quietly shapes decisions', 'What nobody tells you about {X}', '{X} is a strategy, not a feeling', 'The {X} trap', 'When {X} becomes your identity', 'The economics of {X}', 'A short history of {X}', 'Three questions about {X}'];
      const codes = PROJECTS.map((p) => p.code);
      for (let i = 0; i < scale; i++) {
        const code = codes[i % codes.length];
        const proj = PROJECTS.find((p) => p.code === code)!;
        const subject = pick(subjects);
        const title = `${pick(frames).replace('{X}', subject)} #${Math.floor(i / codes.length) + 1}`;
        const series = pick(proj.series);
        const srcs = chance(0.6) ? [pick(proj.sources).title] : [];
        createEpisode(code, { title, series: series.title, core: `A principle about ${subject}.`, tags: [subject, ...series.tags.slice(0, 1)], sources: srcs }, true);
      }
    }

    // ------------------------------------------------------------ activity feed
    const insAct = d.prepare('INSERT INTO activity (at, actor, action, entity_type, entity_id, episode_id, project_id, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    activity.sort((a, b) => a.at.localeCompare(b.at));
    for (const a of activity) insAct.run(a.at, a.actor ?? 'you', a.action, a.type, a.id, a.ep, a.proj, a.summary);
    // Wisdom Genome, HOS etc. stay "active"; give Human Failure Archive a quiet spell for the resurface engine.
    const hfa = projectIds.get('HFA')!;
    d.prepare(`UPDATE activity SET at = ? WHERE project_id = ? AND at > ?`).run(daysAgo(19), hfa, daysAgo(19));
    d.prepare(`UPDATE episodes SET progress_at = ? WHERE project_id = ? AND progress_at > ?`).run(daysAgo(19), hfa, daysAgo(19));
    d.prepare(`UPDATE episode_stages SET completed_at = ? WHERE completed_at > ? AND episode_id IN (SELECT id FROM episodes WHERE project_id = ?)`).run(daysAgo(19), daysAgo(19), hfa);

    // Today's queue: a couple of pinned items so Today mode isn't empty.
    const pinned = d.prepare(`SELECT id FROM episodes WHERE project_id = ? AND number IN (5, 6)`).all(projectIds.get('BIB')!) as { id: number }[];
    const day = localDate(0);
    pinned.forEach((p, i) => d.prepare('INSERT OR IGNORE INTO today_queue (day, episode_id, position) VALUES (?, ?, ?)').run(day, p.id, i));

    recomputeEpisodes(allIds);
  })();
  return { episodes: (d.prepare('SELECT count(*) AS c FROM episodes').get() as { c: number }).c };
}

const PROFILE_PHASE: Record<Profile, Phase> = {
  idea: 'IDEA',
  research: 'RESEARCH',
  script: 'SCRIPT',
  voice: 'VOICE',
  visual: 'VISUAL',
  edit: 'EDIT',
  qc: 'QC',
  blocked: 'SCRIPT',
  ready: 'READY',
  scheduled: 'SCHEDULED',
  published: 'PUBLISHED',
};
const stageToPhase: Partial<Record<Stage, Phase>> = { RESEARCH: 'RESEARCH', SCRIPT: 'SCRIPT', VOICE: 'VOICE', VISUAL: 'VISUAL', EDIT: 'EDIT', QC: 'QC' };

function pickProfile(): Profile {
  const r = rand();
  const table: [Profile, number][] = [
    ['idea', 0.3],
    ['research', 0.07],
    ['script', 0.09],
    ['voice', 0.12],
    ['visual', 0.07],
    ['edit', 0.06],
    ['qc', 0.04],
    ['blocked', 0.04],
    ['ready', 0.05],
    ['scheduled', 0.03],
    ['published', 0.13],
  ];
  let acc = 0;
  for (const [p, w] of table) {
    acc += w;
    if (r < acc) return p;
  }
  return 'idea';
}

export { PHASES };
