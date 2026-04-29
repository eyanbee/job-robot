const fs = require('fs');
const path = require('path');

// THE FINAL BOSS ROBOT 🤖
// Now filters out German jobs to keep everything 100% English!

async function fetchRemotive() {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=150');
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
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50');
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

function isGoodSalary(s) {
  if (!s || s.toLowerCase().includes('comp') || s.includes('$ -')) return true;
  const num = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return true;
  if (s.toLowerCase().includes('hr') || s.toLowerCase().includes('hour')) return num >= 5;
  return true; 
}

// NEW: Filter out German jobs
function isEnglishJob(title) {
  const lower = title.toLowerCase();
  const germanMarkers = ['(m/w/d)', '(w/m/d)', '(m/f/d)', '(m/f/x)', 'auszubildender', 'kaufmann', 'entwickler', 'mitarbeiter', 'gesucht', 'praktikum', 'werkstudent'];
  return !germanMarkers.some(marker => lower.includes(marker));
}

async function scrapeJobs() {
  console.log('🤖 Robot is hunting for English jobs...');
  const results = await Promise.all([fetchRemotive(), fetchArbeitnow(), fetchJobicy()]);
  let allJobs = results.flat();

  const cutOff = new Date();
  cutOff.setDate(cutOff.getDate() - 14);

  // Apply all filters: Date, Salary, AND English Language
  allJobs = allJobs.filter(j => 
    new Date(j.postedAt) >= cutOff && 
    isGoodSalary(j.salary) &&
    isEnglishJob(j.title)
  );
  allJobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  
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
  
  console.log(`✅ Done! Found ${finalJobs.length} English jobs.`);
}
scrapeJobs();
