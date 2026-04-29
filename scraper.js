const fs = require('fs');
const path = require('path');

// THE FINAL BOSS ROBOT 🤖
// Now fetches from Remotive, Arbeitnow, Jobicy, AND RemoteOK!
// Prioritizes heavily Filipino-dominated roles and filters out tech/medical/onsite roles.

async function fetchRemotive() {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=250');
    const data = await res.json();
    return data.jobs.map(job => ({
      id: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      platform: 'Remotive',
      location: job.candidate_required_location || 'Remote',
      salary: job.salary || 'Competitive',
      type: job.job_type || 'Full-time',
      tags: job.tags || [],
      postedAt: job.publication_date,
      url: job.url
    }));
  } catch (e) { return []; }
}

async function fetchArbeitnow() {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const data = await res.json();
    return data.data.map(job => ({
      id: `arbeitnow-${job.slug}`,
      title: job.title,
      company: job.company_name,
      platform: 'Arbeitnow',
      location: job.location || 'Remote',
      salary: 'Competitive',
      type: 'Full-time',
      tags: job.tags || [],
      postedAt: new Date(job.created_at * 1000).toISOString(),
      url: job.url
    }));
  } catch (e) { return []; }
}

async function fetchJobicy() {
  try {
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100');
    const data = await res.json();
    return data.jobs.map(job => ({
      id: `jobicy-${job.id}`,
      title: job.jobTitle,
      company: job.companyName,
      platform: 'Jobicy',
      location: job.jobGeo || 'Remote',
      salary: job.jobSalary || 'Competitive',
      type: job.jobType?.[0] || 'Full-time',
      tags: [],
      postedAt: job.pubDate,
      url: job.url
    }));
  } catch (e) { return []; }
}

async function fetchRemoteOK() {
  try {
    const res = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'JobFlow Robot/1.0' } });
    const data = await res.json();
    // First element in RemoteOK API is legal info
    return data.slice(1).map(job => ({
      id: `remoteok-${job.id}`,
      title: job.position,
      company: job.company,
      platform: 'RemoteOK',
      location: job.location || 'Remote',
      salary: job.salary_min ? `$${job.salary_min} - $${job.salary_max}` : 'Competitive',
      type: 'Full-time',
      tags: job.tags || [],
      postedAt: job.date,
      url: job.url
    }));
  } catch (e) { return []; }
}

function isGoodSalary(s) {
  if (!s || s.toLowerCase().includes('comp') || s.includes('$ -')) return true;
  const num = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return true;
  if (s.toLowerCase().includes('hr') || s.toLowerCase().includes('hour')) return num >= 5;
  return true; // If we can't tell, keep it!
}

function isGermanJob(job) {
  const text = `${job.title} ${job.company} ${job.location} ${job.tags.join(' ')}`.toLowerCase();
  const germanKeywords = [
    '(m/w/d)', '(w/m/d)', '(m/f/d)', 'vollzeit', 'teilzeit', 'gmbh',
    'deutsch', 'german', 'manager/in', 'entwickler/in', 'berater/in',
    'auftragsmanagement', 'projektkoordination', 'disposition',
    'homeoffice', '*in', 'werkstudent', 'vertrieb', 'standort',
    'niederlassung', 'leiter', 'munich', 'dresden', 'berlin', 'hamburg',
    'frankfurt', 'stuttgart', 'cologne', 'köln', 'düsseldorf', 'leipzig',
    'münchen', 'praktikum', 'ausbildung', 'kaufmann', 'kauffrau', 
    'mitarbeiter', 'fachkraft', 'sachbearbeiter'
  ];
  return germanKeywords.some(kw => text.includes(kw));
}

function isUnwantedJob(job) {
  const text = `${job.title} ${job.tags.join(' ')} ${job.location}`.toLowerCase();
  const unwantedKeywords = [
    'full stack developer', 'full stack product engineer', 'solution engineer',
    'firmware automation engineer', 'clinical research', 'software engineer',
    'spanish speaking', 'real estate counsel', 'data engineer', 'neurologist',
    'applied ai engineer', 'corporate counsel', 'backend engineer',
    'site reliability engineer', 'data center engineer', 'onsite',
    'pricing & yield manager', 'machine learning engineer', 
    'microsoft system administrator', 'sap integration developer',
    'connectivity engineer', 'calibration standard analyst',
    'head of engineering', 'mulesoft', 'integrations developer',
    'neuroradiologist'
  ];
  return unwantedKeywords.some(kw => text.includes(kw));
}

function getJobScore(job) {
  const textToCheck = `${job.title} ${job.tags.join(' ')}`.toLowerCase();
  
  const hierarchy = [
    ['virtual assistant', 'va'],
    ['data entry', 'research va', 'research virtual assistant'],
    ['executive administrative va', 'executive assistant', 'executive administrative', 'executive admin'],
    ['social media manager'],
    ['real estate virtual assistant', 'reva', 'real estate va'],
    ['content va', 'content manager', 'content writer'],
    ['amazon fba', 'fba'],
    ['general administrative', 'general admin', 'operations va', 'admin va'],
    ['e-commerce', 'ecommerce', 'amazon', 'shopify', 'ebay'],
    ['seo expert', 'seo'],
    ['graphic design', 'graphic designer'],
    ['video editor', 'video editing'],
    ['email marketing', 'email automation', 'email copywriter'],
    ['media buyer meta ads', 'media buyer meta'],
    ['media buyer google ads', 'media buyer google'],
    ['ppc specialist'],
    ['ppc expert'],
    ['linkedin ads expert', 'linkedin ads'],
    ['tiktok ads'],
    ['instagram ads'],
    ['google ads expert'],
    ['google ads specialist'],
    ['google ads manager'],
    ['meta ads expert'],
    ['meta ads specialist'],
    ['paid media buyer'],
    ['gohighlevel', 'ghl'],
    ['ghl automation expert', 'gohighlevel automation expert'],
    ['ghl funnel builder', 'funnel builder'],
    ['ai automation'],
    ['digital marketing automation'],
    ['crm automation'],
    ['marketing funnel automation'],
    ['klaviyo', 'activecampaign', 'email marketing automation'],
    ['sms automation', 'voice automation'],
    ['customer service', 'chat support', 'email support', 'customer support'],
    ['lead generation'],
    ['cold caller', 'appointment setter'],
    ['facebook ads', 'meta ads', 'meta ads manager'],
    ['lead nurturing'],
    ['ai content automation'],
    ['short-form video', 'short form video automation'],
    ['bookkeeper', 'accounting'],
    ['logistics', 'shipping'],
    ['talent acquisition', 'recruitment'],
    ['mortgage', 'loan processing'],
    ['project management', 'ops va'],
    ['operations business manager', 'obm'],
    ['online business manager'],
    ['zapier'],
    ['make.com', 'integromat'],
    ['n8n'],
    ['no-code', 'nocode'],
    ['workflow automation'],
    ['ai workflow'],
    ['claude', 'gpt'],
    ['ai agent'],
    ['fractional coo', 'operations manager'],
    ['fractional cfo', 'finance strategist'],
    ['cro', 'conversion rate optimization'],
    ['systems & processes', 'systems and processes'],
    ['clickup', 'notion'],
    ['airtable'],
    ['api integration'],
    ['webhook', 'integration va'],
    ['sales pipeline'],
    ['customer onboarding'],
    ['high-ticket', 'sales closer'],
    ['agency operations'],
    ['saas operations'],
    ['meta pixel', 'tracking specialist'],
    ['google analytics', 'tag manager'],
    ['landing page optimization'],
    ['performance marketing'],
    ['fractional cmo'],
    ['process documentation', 'sop']
  ];
  
  let score = 0;
  const maxScore = hierarchy.length * 10;
  
  for (let i = 0; i < hierarchy.length; i++) {
    const keywords = hierarchy[i];
    if (keywords.some(kw => textToCheck.includes(kw))) {
      score += (maxScore - (i * 10));
      break; // Strict hierarchy: highest matching tier defines the base score
    }
  }
  
  // Freshness score (newer is better)
  const ageInDays = (new Date() - new Date(job.postedAt)) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 14 - ageInDays); 
  
  return score;
}

async function scrapeJobs() {
  console.log('🤖 Robot is hunting for jobs...');
  const results = await Promise.all([fetchRemotive(), fetchArbeitnow(), fetchJobicy(), fetchRemoteOK()]);
  let allJobs = results.flat();

  const cutOff = new Date();
  cutOff.setDate(cutOff.getDate() - 14);

  allJobs = allJobs.filter(j => new Date(j.postedAt) >= cutOff && isGoodSalary(j.salary) && !isGermanJob(j) && !isUnwantedJob(j));
  
  // Sort by our custom score (prioritizing Pinoy-dominated roles and freshness)
  allJobs.sort((a, b) => getJobScore(b) - getJobScore(a));
  
  const finalJobs = allJobs.slice(0, 150);
  
  fs.writeFileSync('jobs.json', JSON.stringify({ lastUpdated: new Date().toISOString(), jobs: finalJobs }, null, 2));
  
  const csvPath = 'weekly-jobs.csv';
  const headers = 'ID,Title,Company,Platform,Location,Salary,Type,Posted At,URL\n';
  if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, headers);
  
  const existing = fs.readFileSync(csvPath, 'utf8');
  let newLines = '';
  finalJobs.forEach(j => {
    if (!existing.includes(j.id)) {
      const safeTitle = `"${j.title.replace(/"/g, '""')}"`;
      const safeCompany = `"${j.company.replace(/"/g, '""')}"`;
      const safeLocation = `"${j.location.replace(/"/g, '""')}"`;
      const safeSalary = `"${j.salary.replace(/"/g, '""')}"`;
      newLines += `${j.id},${safeTitle},${safeCompany},${j.platform},${safeLocation},${safeSalary},${j.type},${j.postedAt},${j.url}\n`;
    }
  });
  if (newLines) fs.appendFileSync(csvPath, newLines);
  
  console.log(`✅ Done! Found ${finalJobs.length} jobs.`);
}

scrapeJobs().catch(err => {
  console.error('❌ Robot crashed:', err);
  process.exit(1);
});
