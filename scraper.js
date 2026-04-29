const fs = require('fs');
const path = require('path');

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

async function scrapeJobs() {
  console.log('🤖 Robot is hunting...');
  const results = await Promise.all([fetchRemotive(), fetchArbeitnow(), fetchJobicy()]);
  let allJobs = results.flat();
  const cutOff = new Date();
  cutOff.setDate(cutOff.getDate() - 14);
  allJobs = allJobs.filter(j => new Date(j.postedAt) >= cutOff && isGoodSalary(j.salary));
  allJobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  const finalJobs = allJobs.slice(0, 150);
  
  fs.writeFileSync('jobs.json', JSON.stringify({ lastUpdated: new Date().toISOString(), jobs: finalJobs }, null, 2));
  
  const csvPath = 'weekly-jobs.csv';
  if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, 'ID,Title,Company,Platform,Location,Salary,Type,Posted At,URL\n');
  const existing = fs.readFileSync(csvPath, 'utf8');
  let newLines = '';
  finalJobs.forEach(j => {
    if (!existing.includes(j.id)) {
      newLines += `${j.id},"${j.title.replace(/"/g, '""')}","${j.company.replace(/"/g, '""')}",${j.platform},"${j.location.replace(/"/g, '""')}","${j.salary.replace(/"/g, '""')}",${j.type},${j.postedAt},${j.url}\n`;
    }
  });
  if (newLines) fs.appendFileSync(csvPath, newLines);
  console.log(`✅ Success! Found ${finalJobs.length} jobs.`);
}
scrapeJobs();
