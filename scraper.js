const fs = require('fs');
const path = require('path');

// This is the UPGRADED Robot script.
// It fetches 250 jobs and has smarter filters to ensure we hit our 150-job target.

async function fetchRemotive() {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=250');
    const data = await res.json();
    return data.jobs.map(job => {
      let type = 'Full-time';
      if (job.job_type) {
        const t = job.job_type.toLowerCase();
        if (t.includes('part')) type = 'Part-time';
        else if (t.includes('contract') || t.includes('project')) type = 'Project-based';
        else if (t.includes('freelance')) type = 'Freelance';
        else if (t.includes('flex')) type = 'Flexible hours';
      }
      return {
        id: `remotive-${job.id}`,
        title: job.title,
        company: job.company_name,
        platform: 'Remotive',
        location: job.candidate_required_location || 'Remote',
        salary: job.salary || 'Competitive',
        type,
        tags: job.tags || [],
        postedAt: job.publication_date,
        url: job.url
      };
    });
  } catch (e) {
    console.error('Remotive error:', e);
    return [];
  }
}

async function fetchArbeitnow() {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const data = await res.json();
    return data.data.filter(job => job.remote).map(job => {
      let type = 'Full-time';
      if (job.job_types && job.job_types.length > 0) {
        const t = job.job_types.join(' ').toLowerCase();
        if (t.includes('part')) type = 'Part-time';
        else if (t.includes('contract') || t.includes('project')) type = 'Project-based';
        else if (t.includes('freelance')) type = 'Freelance';
        else if (t.includes('flex')) type = 'Flexible hours';
      }
      return {
        id: `arbeitnow-${job.slug}`,
        title: job.title,
        company: job.company_name,
        platform: 'Arbeitnow',
        location: job.location || 'Remote',
        salary: 'Competitive',
        type,
        tags: job.tags || [],
        postedAt: new Date(job.created_at * 1000).toISOString(),
        url: job.url
      };
    });
  } catch (e) {
    console.error('Arbeitnow error:', e);
    return [];
  }
}

function meetsSalaryRequirement(salaryStr) {
  // Smarter filter: Keep jobs that don't disclose salary or use common "not specified" tags
  if (!salaryStr || 
      salaryStr.toLowerCase() === 'competitive' || 
      salaryStr.includes('$ -') || 
      salaryStr.includes('n/a')) return true;

  const str = salaryStr.toLowerCase();
  const matches = str.match(/[\d,.]+[k]?/g);
  if (!matches) return true;

  let numStr = matches[0].replace(/,/g, '');
  let isK = false;
  if (numStr.endsWith('k')) { isK = true; numStr = numStr.replace('k', ''); }
  let num = parseFloat(numStr);
  if (isNaN(num)) return true;
  if (isK) num *= 1000;

  if (str.includes('hr') || str.includes('hour')) return num >= 5;
  if (str.includes('mo') || str.includes('month')) return num >= 500;
  if (str.includes('yr') || str.includes('year') || str.includes('annual') || num > 5000) return num >= 6000;
  if (num > 5000) return num >= 6000;
  if (num > 100) return num >= 500;
  return num >= 5;
}

async function scrapeJobs() {
  console.log('🤖 Upgraded Robot starting its shift...');
  const [remotiveJobs, arbeitnowJobs] = await Promise.all([fetchRemotive(), fetchArbeitnow()]);
  let allJobs = [...remotiveJobs, ...arbeitnowJobs];

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  allJobs = allJobs.filter(job => {
    const postedDate = new Date(job.postedAt);
    return postedDate >= fourteenDaysAgo && meetsSalaryRequirement(job.salary);
  });

  allJobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  const finalJobs = allJobs.slice(0, 150);

  // Save to the ROOT folder so the website can find it easily
  const outputPath = path.join(process.cwd(), 'jobs.json');
  fs.writeFileSync(outputPath, JSON.stringify({ 
    lastUpdated: new Date().toISOString(),
    jobs: finalJobs 
  }, null, 2));

  console.log(`✅ Success! Collected ${finalJobs.length} jobs.`);

  const csvPath = path.join(process.cwd(), 'weekly-jobs.csv');
  let existingCsv = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : 'ID,Title,Company,Platform,Location,Salary,Type,Posted At,URL\n';
  
  let newCsvLines = '';
  for (const job of finalJobs) {
    if (!existingCsv.includes(job.id)) {
      const safeTitle = `"${job.title.replace(/"/g, '""')}"`;
      const safeCompany = `"${job.company.replace(/"/g, '""')}"`;
      const safeLocation = `"${job.location.replace(/"/g, '""')}"`;
      const safeSalary = `"${job.salary.replace(/"/g, '""')}"`;
      newCsvLines += `${job.id},${safeTitle},${safeCompany},${job.platform},${safeLocation},${safeSalary},${job.type},${job.postedAt},${job.url}\n`;
    }
  }

  if (newCsvLines) fs.appendFileSync(csvPath, newCsvLines);
}

scrapeJobs().catch(err => { console.error('❌ Robot crashed:', err); process.exit(1); });
