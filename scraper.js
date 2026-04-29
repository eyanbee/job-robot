const fs = require('fs');
const path = require('path');

// THE FINAL BOSS ROBOT 🤖
// Now fetches from Remotive, Arbeitnow, Jobicy, AND RemoteOK!
// Prioritizes heavily Filipino-dominated roles.

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

function getJobScore(job) {
  const textToCheck = `${job.title} ${job.tags.join(' ')}`.toLowerCase();
  const targetKeywords = [
    'virtual assistant', 'executive assistant', 'graphic design', 'video edit', 
    'amazon', 'shopify', 'automation', 'ghl', 'gohighlevel', 'google ads', 'meta ads', 'facebook ads', 'instagram ads', 'ppc', 'paid media', 'performance marketing',
    'funnel', 'full-funnel', 'bookkeep', 'digital marketing', 'make.com', 'integromat', 'n8n', 'zapier', 'no-code', 'nocode',
    'real estate', 'cold call', 'appointment setter', 'bdr', 'business development', 'high-ticket', 'closer',
    'administrative', 'operations', 'obm', 'online business manager', 'fractional', 'e-commerce', 'customer service', 'chat', 'email',
    'social media', 'content', 'lead generation', 'fba', 'accounting', 'seo', 'cro', 'conversion rate', 'landing page', 'a/b testing',
    'logistics', 'shipping', 'data entry', 'research', 'recruitment', 'mortgage', 'project management', 'agency operations', 'business systems analyst',
    'claude', 'gpt', 'ai agent', 'cursor', 'prompt engineer', 'chatbot', 'manychat', 'voice ai', 'ai automation', 'ai workflow', 'ai implementation',
    'klaviyo', 'activecampaign', 'clickup', 'notion', 'airtable', 'asana', 'monday.com',
    'api integration', 'webhook', 'google analytics', 'tag manager', 'looker', 'xero', 'kajabi', 'bubble', 'glide',
    'revops', 'growthops', 'marops', 'sop', 'process documentation', 'tech stack', 'automation auditor', 'complex automation', 'crm automation', 'sales pipeline', 'automation maintenance',
    'technical operations', 'automation monitoring', 'social media marketing', 'executive operations', 'ai-powered', 'ghl crm', 'pipeline manager',
    'snapshot installer', 'setup va', 'gohighlevel technical', 'ghl technical', 'transaction coordinator', 'listing management', 'shopify automation',
    'e-commerce operations', 'e-commerce customer service', 'financial controller', 'general administrative', 'medical billing', 'healthcare',
    'client onboarding', 'sales closer', 'high-ticket appointment setter'
  ];
  
  let score = 0;
  targetKeywords.forEach(keyword => {
    if (textToCheck.includes(keyword)) score += 10;
  });
  
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

  allJobs = allJobs.filter(j => new Date(j.postedAt) >= cutOff && isGoodSalary(j.salary));
  
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
