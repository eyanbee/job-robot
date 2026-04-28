const fs = require('fs');
const path = require('path');

// This is the REAL Robot Brain - CommonJS Version for GitHub Actions
async function fetchJobs() {
  console.log("Starting job hunt...");
  let allJobs = [];

  try {
    // 1. Fetch from Remotive
    console.log("Fetching from Remotive...");
    const remotiveRes = await fetch('https://remotive.com/api/remote-jobs?limit=150');
    const remotiveData = await remotiveRes.json();
    
    const remotiveJobs = remotiveData.jobs.map(job => ({
      id: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      platform: "Remotive",
      location: job.candidate_required_location || "Worldwide",
      salary: job.salary || "Not specified",
      type: job.job_type ? job.job_type.replace('_', ' ') : "Full-time",
      tags: job.category ? [job.category] : ["Remote"],
      postedAt: job.publication_date,
      url: job.url
    }));
    allJobs = [...allJobs, ...remotiveJobs];

    // 2. Fetch from Arbeitnow
    console.log("Fetching from Arbeitnow...");
    const arbeitnowRes = await fetch('https://www.arbeitnow.com/api/job-board-api');
    const arbeitnowData = await arbeitnowRes.json();
    
    const arbeitnowJobs = arbeitnowData.data.map(job => ({
      id: `arbeitnow-${job.slug}`,
      title: job.title,
      company: job.company_name,
      platform: "Arbeitnow",
      location: job.location || "Worldwide",
      salary: "Not specified",
      type: job.job_types && job.job_types.length > 0 ? job.job_types[0] : "Full-time",
      tags: job.tags || ["Remote"],
      postedAt: new Date(job.created_at * 1000).toISOString(),
      url: job.url
    }));
    allJobs = [...allJobs, ...arbeitnowJobs];

  } catch (error) {
    console.error("Error fetching jobs:", error);
  }

  // Filter jobs ($5/hr or $500/month minimum, and Remote only)
  const validJobs = allJobs.filter(job => {
    // Remote check
    const loc = job.location.toLowerCase();
    const isRemote = loc.includes('remote') || loc.includes('anywhere') || loc.includes('worldwide');
    if (!isRemote && job.location !== "Worldwide") return false;

    // Salary check
    let passesSalary = true;
    if (job.salary && job.salary !== "Not specified") {
      const salaryText = job.salary.toLowerCase();
      const numbers = salaryText.match(/\d+/g);
      if (numbers) {
        const maxNum = Math.max(...numbers.map(Number));
        if (salaryText.includes('hour') || salaryText.includes('/hr')) {
          if (maxNum < 5) passesSalary = false;
        } else if (maxNum > 100 && maxNum < 500) {
          passesSalary = false;
        }
      }
    }
    
    return passesSalary;
  });

  // Sort by newest and take top 150
  validJobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  const topJobs = validJobs.slice(0, 150);

  // Save to jobs.json for the website
  const output = {
    lastUpdated: new Date().toISOString(),
    jobs: topJobs
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'jobs.json'),
    JSON.stringify(output, null, 2)
  );
  console.log(`Saved ${topJobs.length} jobs to jobs.json`);

  // Save to jobs.csv for your Substack Newsletter!
  const csvHeaders = "Title,Company,Platform,Location,Salary,Type,PostedAt,URL\n";
  const csvRows = topJobs.map(job => {
    // Escape quotes for CSV format
    const cleanTitle = `"${job.title.replace(/"/g, '""')}"`;
    const cleanCompany = `"${job.company.replace(/"/g, '""')}"`;
    const cleanSalary = `"${job.salary.replace(/"/g, '""')}"`;
    return `${cleanTitle},${cleanCompany},${job.platform},"${job.location}",${cleanSalary},${job.type},${job.postedAt},${job.url}`;
  }).join("\n");

  fs.writeFileSync(
    path.join(process.cwd(), 'jobs.csv'),
    csvHeaders + csvRows
  );
  console.log("Saved jobs to jobs.csv");
}

fetchJobs();
