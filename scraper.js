const fs = require('fs');

const platforms = [
  "OnlineJobs.ph", "Upwork", "VirtualStaff.ph", "Fiverr", 
  "Indeed", "JobStreet", "LinkedIn", "Glassdoor", "Kalibrr", "Freelancer.com"
];

// This simulates the robot fetching 150 jobs
const jobs = Array.from({ length: 150 }).map((_, i) => ({
  id: `job-${Date.now()}-${i}`,
  title: ["Virtual Assistant", "React Developer", "Customer Service Rep", "Data Entry Specialist", "Graphic Designer"][Math.floor(Math.random() * 5)],
  company: ["Tech Corp USA", "Aussie Startups", "UK Agency", "Global Remote", "Local PH Business"][Math.floor(Math.random() * 5)],
  platform: platforms[Math.floor(Math.random() * platforms.length)],
  location: "Remote",
  salary: ["$500-$1000/mo", "$1000-$2000/mo", "$10-$15/hr", "$20-$30/hr", "Negotiable"][Math.floor(Math.random() * 5)],
  type: ["Full-time", "Part-time", "Contract"][Math.floor(Math.random() * 3)],
  tags: ["Remote", "No Experience", "US Night Shift", "Flexible Hours"].sort(() => 0.5 - Math.random()).slice(0, 2),
  postedAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  url: "#"
}));

const data = {
  lastUpdated: new Date().toISOString(),
  jobs: jobs
};

fs.writeFileSync('jobs.json', JSON.stringify(data, null, 2));
console.log("Successfully fetched 150 jobs and saved to jobs.json!");
