import fs from 'fs';
import path from 'path';

// This is the REAL Robot script.
// It fetches live, real jobs from public APIs (Remotive and Arbeitnow) completely for free.

async function fetchRemotive() {
  try {
    // REMOVED THE 100 LIMIT - Now it fetches a massive pool of jobs to filter!
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=2000');
    const data = await res.json();
    return data.jobs.map(job => {
      // Normalize job types
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
    return data.data
      .filter(job => job.remote) // ONLY keep remote jobs
      .map(job => {
        // Normalize job types
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
          // Arbeitnow returns created_at as a Unix timestamp in seconds
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
  if (!salaryStr || salaryStr.toLowerCase() === 'competitive') return true; // Keep jobs that don't disclose salary so we don't lose good opportunities

  const str = salaryStr.toLowerCase();
  const matches = str.match(/[\d,.]+[k]?/g);
  if (!matches) return true; // No numbers found

  let numStr = matches[0].replace(/,/g, '');
  let isK = false;
  if (numStr.endsWith('k')) {
    isK = true;
    numStr = numStr.replace('k', '');
  }

  let num = parseFloat(numStr);
  if (isNaN(num)) return true;
  if (isK) num *= 1000;

  // Check against our minimums: $5/hr, $500/mo, or $6,000/yr
  if (str.includes('hr') || str.includes('hour')) return num >= 5;
  if (str.includes('mo') || str.includes('month')) return num >= 500;
  if (str.includes('yr') || str.includes('year') || str.includes('annual') || num > 5000) return num >= 6000;

  // Fallback assumptions based on the number size
  if (num > 5000) return num >= 6000; // Assume annual
  if (num > 100) return num >= 500;    // Assume monthly
  return num >= 5;                     // Assume hourly
}

async function scrapeJobs() {
  console.log('🤖 Real Job Robot starting its shift...');
  
  // Fetch from both platforms at the same time
  const [remotiveJobs, arbeitnowJobs] = await Promise.all([
    fetchRemotive(),
    fetchArbeitnow()
  ]);

  let allJobs = [...remotiveJobs, ...arbeitnowJobs];

  // STRICT RULES: Last 14 days AND minimum $5/hr or $500/mo
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  allJobs = allJobs.filter(job => {
    const postedDate = new Date(job.postedAt);
    const isFresh = postedDate >= fourteenDaysAgo;
    const isGoodPay = meetsSalaryRequirement(job.salary);
    return isFresh && isGoodPay;
  });

  // Sort by newest first
  allJobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  // Limit to exactly 150 jobs as requested
  const finalJobs = allJobs.slice(0, 150);

  // Save the data to a file that the website can read
  const outputPath = path.join(process.cwd(), 'public', 'jobs.json');
  fs.writeFileSync(outputPath, JSON.stringify({ 
    lastUpdated: new Date().toISOString(),
    jobs: finalJobs 
  }, null, 2));

  console.log(`✅ Success! Collected ${finalJobs.length} REAL jobs and saved to jobs.json`);

  // --- NEW: SAVE TO CSV FOR GOOGLE SHEETS ---
  const csvPath = path.join(process.cwd(), 'public', 'weekly-jobs.csv');
  let existingCsv = '';
  
  if (fs.existsSync(csvPath)) {
    existingCsv = fs.readFileSync(csvPath, 'utf8');
  } else {
    // Create headers if file doesn't exist
    existingCsv = 'ID,Title,Company,Platform,Location,Salary,Type,Posted At,URL\n';
    fs.writeFileSync(csvPath, existingCsv);
  }

  let newCsvLines = '';
  let addedToCsvCount = 0;

  for (const job of finalJobs) {
    // Simple check to avoid duplicates in the CSV
    if (!existingCsv.includes(job.id)) {
      // Escape quotes and commas for CSV format
      const safeTitle = `"${job.title.replace(/"/g, '""')}"`;
      const safeCompany = `"${job.company.replace(/"/g, '""')}"`;
      const safeLocation = `"${job.location.replace(/"/g, '""')}"`;
      const safeSalary = `"${job.salary.replace(/"/g, '""')}"`;

      newCsvLines += `${job.id},${safeTitle},${safeCompany},${job.platform},${safeLocation},${safeSalary},${job.type},${job.postedAt},${job.url}\n`;
      addedToCsvCount++;
    }
  }

  if (newCsvLines) {
    fs.appendFileSync(csvPath, newCsvLines);
    console.log(`📝 Added ${addedToCsvCount} new unique jobs to weekly-jobs.csv`);
  }
}

scrapeJobs().catch(err => {
  console.error('❌ Robot crashed:', err);
  process.exit(1);
});
