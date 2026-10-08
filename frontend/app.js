// JobPilot — Apple Minimal Dashboard, Freelance Stream & Live Resume Editor

let rawFetchedJobs = [];
let currentFilteredJobs = [];
let appliedJobIds = new Set();
let isBatchApplying = false;
let currentPage = 1;
const itemsPerPage = 8;

document.addEventListener('DOMContentLoaded', () => {
  fetchJobs();
  fetchReviewQueue();
});

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  
  const selectedNav = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.toLowerCase().includes(tabId.replace('-', ' ')));
  if (selectedNav) selectedNav.classList.add('active');
  
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');
}

function updateMetricsDisplay() {
  const metricJobs = document.getElementById('metric-jobs');
  if (metricJobs) metricJobs.textContent = rawFetchedJobs.length || '90';
}

async function triggerScraper() {
  const btn = document.getElementById('btn-run-scraper');
  const container = document.getElementById('job-feed-container');
  if(btn) {
      btn.disabled = true;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Booting Headless Agents (30s)...`;
  }
  if(container) {
      container.innerHTML = `<div style="background: var(--bg-card); padding: 3rem; text-align: center; border-radius: 18px; border: 1px solid var(--border-subtle);"><h3 style="color: var(--text-primary); font-size: 1rem; margin-bottom:0.5rem;">Running Deep Scan...</h3><p style="color: var(--text-secondary); font-size: 0.85rem;">Python AI is stealthily scraping job boards right now.</p></div>`;
  }
  
  try {
     // 1. Trigger python scraper directly
     const res = await fetch('/api/ai/jobs/live');
     const jobs = await res.json();
     
     // 2. Push scraped hits seamlessly into Node.js DB Queue Endpoint
     let inserted = 0;
     if(Array.isArray(jobs)) {
         for(const j of jobs) {
            const pushData = { url: j.url, company: j.company, title: j.title, location: j.location, source: j.source, description: j.description || (j.techStack ? j.techStack.join(", ") : ""), salary: j.salaryRaw };
            await fetch('/api/jobs/seed', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(pushData) });
            inserted++;
         }
     }
     
     // 3. Reload Native Feed
     if(btn) btn.innerHTML = `✅ Deep Scan Finished (${inserted} Injected)`;
     setTimeout(() => { if(btn) { btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Run Discovery Engine`; btn.disabled = false; } }, 4000);
     
     fetchJobs();
  } catch(e) {
     alert("Error triggering agents! Make sure Python Engine is online.");
     if(btn) { btn.disabled = false; btn.innerHTML = "Retry Discovery"; }
  }
}

async function fetchJobs() {
  const container = document.getElementById('job-feed-container');
  if (container) {
    container.innerHTML = `<div style="color: var(--text-secondary); padding: 3rem; text-align: center; font-size: 0.9rem;">Scanning live multi-portal feeds across LinkedIn, Indeed, Internshala, Unstop & Freelancer...</div>`;
  }

  try {
    const [jobsRes, appsRes] = await Promise.all([
      fetch('/api/jobs'),
      fetch('/api/applications').catch(() => null)
    ]);
    
    const jobs = await jobsRes.json();
    rawFetchedJobs = jobs;

    if (appsRes && appsRes.ok) {
      const apps = await appsRes.json();
      if (Array.isArray(apps)) {
        apps.forEach(a => { if (a.id) appliedJobIds.add(a.id); });
        const metricApplied = document.getElementById('metric-applied');
        if (metricApplied) metricApplied.textContent = apps.length;
      }
    }

    currentPage = 1;
    applyFilters();
  } catch (err) {
    console.warn("Error fetching jobs from server:", err);
    rawFetchedJobs = [];
    applyFilters();
  }
}

function applyFilters() {
  const allowRemote = document.getElementById('filter-remote')?.checked ?? true;
  const allowHybrid = document.getElementById('filter-hybrid')?.checked ?? true;
  const allowOnsite = document.getElementById('filter-onsite')?.checked ?? false;

  const allowFulltime = document.getElementById('filter-fulltime')?.checked ?? true;
  const allowFreelance = document.getElementById('filter-freelance')?.checked ?? true;
  
  const minSalaryVal = parseFloat(document.getElementById('filter-salary')?.value || 0);
  const selectedPortal = (document.getElementById('filter-portal')?.value || 'all').toLowerCase();
  const searchText = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();

  currentFilteredJobs = rawFetchedJobs.filter(job => {
    const mode = (job.remoteType || job.location || '').toLowerCase();
    const isRemote = mode.includes('remote');
    const isHybrid = mode.includes('hybrid');
    const isOnsite = !isRemote && !isHybrid;

    let modeMatch = false;
    if (allowRemote && (isRemote || mode.includes('remote'))) modeMatch = true;
    if (allowHybrid && (isHybrid || mode.includes('hybrid'))) modeMatch = true;
    if (allowOnsite && isOnsite) modeMatch = true;
    if (!allowRemote && !allowHybrid && !allowOnsite) modeMatch = true;
    if (!modeMatch) return false;

    const jType = (job.jobType || '').toLowerCase();
    const isFreelance = jType.includes('freelance') || jType.includes('contract') || jType.includes('hourly');
    const isFulltime = !isFreelance;

    let typeMatch = false;
    if (allowFulltime && isFulltime) typeMatch = true;
    if (allowFreelance && isFreelance) typeMatch = true;
    if (!allowFulltime && !allowFreelance) typeMatch = true;
    if (!typeMatch) return false;

    if (minSalaryVal > 0) {
      const sal = job.salaryMin || 900000;
      if (sal < minSalaryVal) return false;
    }

    if (selectedPortal !== 'all') {
      const src = (job.source + ' ' + (job.atsPlatform || '') + ' ' + (job.url || '')).toLowerCase();
      if (!src.includes(selectedPortal)) return false;
    }

    if (searchText) {
      const haystack = (job.title + ' ' + job.company + ' ' + job.source + ' ' + (job.jobType || '') + ' ' + (job.techStack || []).join(' ') + ' ' + (job.description || '')).toLowerCase();
      if (!haystack.includes(searchText)) return false;
    }

    return true;
  });

  currentPage = 1;

  const countBadge = document.getElementById('job-count-badge');
  if (countBadge) {
    countBadge.textContent = `Showing ${currentFilteredJobs.length} of ${rawFetchedJobs.length} Live Positions`;
  }

  renderJobs();
}

function changePage(newPage) {
  const totalPages = Math.ceil(currentFilteredJobs.length / itemsPerPage) || 1;
  if (newPage < 1 || newPage > totalPages) return;
  currentPage = newPage;
  renderJobs();
  const feed = document.getElementById('job-feed-container');
  if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPagination(totalPages) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;

  if (totalPages <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  let pageButtonsHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    pageButtonsHtml += `
      <button onclick="changePage(${i})" style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; border: 1px solid ${isActive ? 'var(--accent-apple-blue)' : 'var(--border-subtle)'}; background: ${isActive ? 'var(--accent-apple-blue)' : 'var(--bg-card-hover)'}; color: #fff; cursor: pointer; font-weight: ${isActive ? '600' : '400'};">
        ${i}
      </button>
    `;
  }

  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, currentFilteredJobs.length);

  container.innerHTML = `
    <div style="font-size: 0.8rem; color: var(--text-tertiary);">
      Page <strong style="color: #fff;">${currentPage}</strong> of <strong style="color: #fff;">${totalPages}</strong> (Positions ${startIdx}-${endIdx})
    </div>
    <div style="display: flex; gap: 0.4rem; align-items: center;">
      <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; border: 1px solid var(--border-subtle); background: var(--bg-card-hover); color: #fff; cursor: pointer; opacity: ${currentPage === 1 ? 0.4 : 1};">
        ← Prev
      </button>
      ${pageButtonsHtml}
      <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.8rem; border: 1px solid var(--border-subtle); background: var(--bg-card-hover); color: #fff; cursor: pointer; opacity: ${currentPage === totalPages ? 0.4 : 1};">
        Next →
      </button>
    </div>
  `;
}

function renderJobs() {
  const container = document.getElementById('job-feed-container');
  if (!container) return;

  if (currentFilteredJobs.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); padding: 3rem; text-align: center; border-radius: 18px; border: 1px solid var(--border-subtle);">
        <h3 style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem; font-size: 1rem;">No positions match your active portal or preference filters</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Adjust your portal selector, work mode, or search text above.</p>
      </div>
    `;
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(currentFilteredJobs.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedJobs = currentFilteredJobs.slice(startIdx, startIdx + itemsPerPage);
  
  container.innerHTML = paginatedJobs.map(job => {
    const isApplied = appliedJobIds.has(job.id);
    const src = (job.source || 'Portal').toLowerCase();
    let btnText = "Auto Apply";
    let badgeColor = "var(--accent-apple-blue)";
    
    if (src.includes('linkedin')) {
      btnText = "LinkedIn Easy Apply";
      badgeColor = "#0077b5";
    } else if (src.includes('indeed')) {
      btnText = "Indeed Apply";
      badgeColor = "#2164f3";
    } else if (src.includes('internshala')) {
      btnText = "Internshala Apply";
      badgeColor = "#008bdc";
    } else if (src.includes('unstop')) {
      btnText = "Unstop Apply";
      badgeColor = "#ff6f00";
    } else if (src.includes('freelancer')) {
      btnText = "Bid & Apply";
      badgeColor = "#29b2fe";
    }

    const buttonHtml = `<div style="background: rgba(10, 132, 255, 0.15); color: var(--accent-apple-blue); border: 1px solid rgba(10, 132, 255, 0.3); font-weight: 500; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; display: flex; align-items: center; gap: 0.4rem;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Auto-Pilot: Queued
         </div>`;

    return `
    <div class="job-card" id="job-card-${job.id}">
      <div class="job-info">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <h3>${job.title}</h3>
          <span class="tag" style="background: rgba(255,255,255,0.05); color: ${badgeColor}; border-color: ${badgeColor}; font-weight: 600;">
            ${job.source}
          </span>
          ${(job.jobType || '').includes('Freelance') ? '<span class="tag" style="color: var(--text-primary); border-color: rgba(255,255,255,0.2);">Freelance / Contract</span>' : ''}
        </div>
        <div class="job-meta">
          <span style="display: flex; align-items: center; gap: 0.3rem;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><line x1="15" y1="22" x2="15" y2="22.01"/></svg>
            ${job.company}
          </span>
          <span style="display: flex; align-items: center; gap: 0.3rem;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${job.location}
          </span>
          <span style="color: ${badgeColor}; display: flex; align-items: center; gap: 0.3rem;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
            ${job.atsPlatform || job.source} (${job.remoteType || 'Remote'})
          </span>
          <span style="display: flex; align-items: center; gap: 0.3rem;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            ${job.salaryRaw}
          </span>
        </div>
        <div class="tag-list">
          ${(job.techStack || []).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="match-badge">
          <div class="match-score">${job.matchScore}%</div>
          <div class="match-label">Alignment</div>
        </div>
        ${buttonHtml}
      </div>
    </div>
  `;
  }).join('');

  renderPagination(totalPages);
}

async function fetchReviewQueue() {
  const container = document.getElementById('review-queue-container');
  if (!container) return;
  
  try {
    const res = await fetch('/api/applications');
    const trackers = await res.json();
    
    if (trackers.length === 0) {
      container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No applications tracked yet. Run the Discovery Engine to initiate the pipeline.</div>';
      return;
    }

    container.innerHTML = trackers.map(job => {
      let statusColor = "var(--text-secondary)";
      let statusIcon = "";
      if (job.status === 'Applied') {
          statusColor = "var(--accent-apple-green)";
          statusIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (job.status === 'Failed') {
          statusColor = "var(--accent-apple-amber)";
          statusIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else {
          statusColor = "var(--accent-apple-blue)";
          statusIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      }

      return `
      <div class="job-card" style="border-left: 3px solid ${statusColor};">
        <div class="job-info">
          <h3 style="color: #fff;">${job.title}</h3>
          <div class="job-meta">
            <span>${job.company}</span>
            <span>Match: ${job.matchScore || '--'}%</span>
          </div>
        </div>
        <div style="background: rgba(255,255,255,0.05); color: ${statusColor}; border: 1px solid rgba(255,255,255,0.1); font-weight: 500; font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 8px; display: flex; align-items: center; gap: 0.4rem;">
          ${statusIcon}
          ${job.status}
        </div>
      </div>
    `}).join('');
  } catch (error) {
    container.innerHTML = '<div style="color: red;">Error fetching application tracker endpoint.</div>';
  }
}

function showPortalLoginMenu() {
  const modal = document.getElementById('portal-login-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closePortalLoginModal() {
  const modal = document.getElementById('portal-login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}
