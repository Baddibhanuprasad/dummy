const axios = require('axios');

class JobSearch {
  /**
   * Strip year/semester noise from profile education text.
   */
  buildEducationSearchQuery(education) {
    const edu = (education || '').trim();
    if (!edu) return 'student';

    const cleaned = edu
      .replace(/\b(\d+(st|nd|rd|th)|final|last)\s*year\b/gi, '')
      .replace(/\b(sem|semester)\s*\d+\b/gi, '')
      .replace(/\b(b\.?\s?tech|m\.?\s?tech|b\.?\s?e|m\.?\s?e|bsc|msc|bca|mca|diploma|degree)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || edu;
  }

  /**
   * Map education text → field keywords used for Google queries + relevance filtering.
   * Example: "Cybersecurity" → cyber, security, infosec, ethical hacking, etc.
   */
  extractFieldProfile(education) {
    const raw = (education || '').trim();
    const e = raw.toLowerCase();
    const primary = this.buildEducationSearchQuery(raw);

    // Ordered: more specific fields first
    const catalogs = [
      {
        test: /cyber|infosec|info\s*sec|information\s*security|ethical\s*hack|penetration|soc\b|blue\s*team|red\s*team|network\s*security/,
        label: 'Cybersecurity',
        keywords: [
          'cyber', 'cybersecurity', 'cyber security', 'infosec', 'information security',
          'ethical hacking', 'penetration', 'pen testing', 'pentest', 'soc analyst',
          'security analyst', 'network security', 'application security', 'appsec',
          'vulnerability', 'malware', 'threat', 'siem', 'blue team', 'red team',
          'security engineer', 'security internship', 'owasp', 'forensics'
        ],
        googleTerms: '"cybersecurity" OR "information security" OR "ethical hacking" OR infosec OR "security analyst"',
        exclude: ['marketing internship', 'content writing', 'graphic design', 'hr internship', 'sales internship']
      },
      {
        test: /data\s*science|machine\s*learning|\bml\b|artificial\s*intelligence|\bai\b|deep\s*learning|data\s*analyst/,
        label: 'Data Science / AI',
        keywords: [
          'data science', 'data scientist', 'machine learning', 'deep learning',
          'artificial intelligence', ' data analyst', 'ml engineer', 'ai engineer',
          'nlp', 'computer vision', 'pytorch', 'tensorflow', 'data engineering'
        ],
        googleTerms: '"data science" OR "machine learning" OR "data analyst" OR "AI engineer"',
        exclude: ['marketing', 'hr internship', 'sales']
      },
      {
        test: /full\s*stack|mern|mean|web\s*dev|frontend|front[- ]?end|backend|back[- ]?end|react|node\.?js/,
        label: 'Web Development',
        keywords: [
          'full stack', 'fullstack', 'web developer', 'web development', 'frontend',
          'front end', 'backend', 'back end', 'react', 'node', 'javascript', 'typescript',
          'mern', 'angular', 'vue', 'django', 'flask', 'software developer'
        ],
        googleTerms: '"web developer" OR "full stack" OR frontend OR backend OR "software developer"',
        exclude: ['cybersecurity internship only']
      },
      {
        test: /\bcse\b|computer\s*science|software|information\s*tech|\bit\b|bca|mca|programming|coding/,
        label: 'Computer Science / Software',
        keywords: [
          'software', 'developer', 'programmer', 'computer science', 'coding',
          'software engineer', 'sde', 'it internship', 'technology', 'java', 'python',
          'c++', 'backend', 'frontend', 'full stack', 'web', 'app developer'
        ],
        googleTerms: '"software" OR developer OR programming OR "computer science" OR SDE',
        exclude: ['civil engineer', 'mechanical engineer', 'marketing executive']
      },
      {
        test: /ece|electronics|embedded|vlsi|iot\b|electrical/,
        label: 'Electronics / ECE',
        keywords: [
          'electronics', 'embedded', 'vlsi', 'iot', 'electrical', 'hardware',
          'pcb', 'microcontroller', 'arduino', 'fpga', 'circuit'
        ],
        googleTerms: 'electronics OR embedded OR VLSI OR IoT OR electrical',
        exclude: ['marketing', 'content writing']
      },
      {
        test: /mech|automobile|automotive/,
        label: 'Mechanical',
        keywords: ['mechanical', 'automobile', 'automotive', 'cad', 'solidworks', 'manufacturing', 'production'],
        googleTerms: 'mechanical OR automobile OR automotive OR manufacturing',
        exclude: ['software developer', 'web developer']
      },
      {
        test: /civil|architect|construction/,
        label: 'Civil',
        keywords: ['civil', 'construction', 'structural', 'architecture', 'site engineer', 'autocad'],
        googleTerms: 'civil OR construction OR structural OR architecture',
        exclude: ['software', 'cyber']
      },
      {
        test: /market|mba|business|finance|account|commerce|bba|bcom/,
        label: 'Business / Marketing',
        keywords: [
          'marketing', 'business', 'finance', 'accounting', 'sales', 'mba',
          'digital marketing', 'market research', 'analyst', 'commerce'
        ],
        googleTerms: 'marketing OR finance OR business OR "digital marketing" OR accounting',
        exclude: ['cybersecurity', 'embedded']
      },
      {
        test: /design|ui|ux|graphic|figma/,
        label: 'Design',
        keywords: ['ui', 'ux', 'graphic', 'design', 'figma', 'photoshop', 'illustrator', 'product design'],
        googleTerms: '"UI/UX" OR "graphic design" OR "product design" OR figma',
        exclude: ['cybersecurity', 'mechanical']
      },
      {
        test: /law|llb|legal/,
        label: 'Law',
        keywords: ['law', 'legal', 'llb', 'advocate', 'litigation', 'compliance'],
        googleTerms: 'law OR legal OR LLB OR advocate',
        exclude: ['software', 'cyber']
      },
      {
        test: /nursing|pharmacy|medical|mbbs|biotech|biology/,
        label: 'Healthcare / Life Sciences',
        keywords: ['nursing', 'pharmacy', 'medical', 'healthcare', 'biotech', 'clinical', 'hospital'],
        googleTerms: 'healthcare OR pharmacy OR biotech OR nursing OR clinical',
        exclude: ['software developer', 'cyber']
      }
    ];

    for (const cat of catalogs) {
      if (cat.test.test(e) || cat.test.test(primary.toLowerCase())) {
        return {
          label: cat.label,
          primary,
          keywords: cat.keywords,
          googleTerms: cat.googleTerms,
          exclude: cat.exclude || []
        };
      }
    }

    // Fallback: use significant words from education as keywords
    const tokens = primary
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length >= 3 && !['the', 'and', 'for', 'with', 'from', 'year', 'student'].includes(t));

    return {
      label: primary || 'General',
      primary: primary || raw || 'student',
      keywords: tokens.length ? tokens : [primary.toLowerCase() || 'internship'],
      googleTerms: `"${primary || raw}"`,
      exclude: []
    };
  }

  buildExternalSearchUrls(education, location) {
    const field = this.extractFieldProfile(education);
    const loc = (location || 'India').trim();
    const internQ = `${field.primary} ${field.label} internship`;
    const fresherQ = `${field.primary} ${field.label} fresher jobs`;

    const slugify = (s) =>
      (s || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    return {
      googleInternshipsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${field.googleTerms} internship for students in ${loc}`)}&tbs=qdr:w&hl=en&gl=in`,
      googleFresherUrl: `https://www.google.com/search?q=${encodeURIComponent(`${field.googleTerms} fresher jobs in ${loc}`)}&tbs=qdr:w&hl=en&gl=in`,
      linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${field.primary} internship`)}&location=${encodeURIComponent(loc)}&f_E=1,2&f_TPR=r604800`,
      naukriUrl: `https://www.naukri.com/${slugify(field.primary) || 'fresher'}-jobs-in-${slugify(loc) || 'india'}`,
      indeedUrl: `https://in.indeed.com/jobs?q=${encodeURIComponent(`${field.primary} fresher OR internship`)}&l=${encodeURIComponent(loc)}&fromage=7`,
      internshalaUrl: `https://internshala.com/internships/?keywords=${encodeURIComponent(`${field.primary} ${loc}`.trim())}`,
      query: field.primary,
      fieldLabel: field.label
    };
  }

  decodeHtml(text) {
    return String(text || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x27;/g, "'")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  detectSource(url) {
    const u = (url || '').toLowerCase();
    if (u.includes('linkedin.com')) return 'LinkedIn';
    if (u.includes('internshala.com')) return 'Internshala';
    if (u.includes('naukri.com')) return 'Naukri';
    if (u.includes('indeed.')) return 'Indeed';
    if (u.includes('glassdoor.')) return 'Glassdoor';
    if (u.includes('foundit.in') || u.includes('monsterindia')) return 'Foundit';
    if (u.includes('hirist.') || u.includes('iimjobs.')) return 'Hirist';
    if (u.includes('angel.co') || u.includes('wellfound.com')) return 'Wellfound';
    return 'Google';
  }

  /**
   * Listing must be (a) internship/fresher type AND (b) match education field.
   * Cybersecurity students should not see marketing / unrelated roles.
   */
  isRelevantListing(title, description, url, kind, field) {
    const text = `${title} ${description} ${url}`.toLowerCase();
    const junk = [
      'youtube.com', 'wikipedia.org', 'facebook.com', 'instagram.com',
      'quora.com', 'reddit.com', 'pinterest.', 'tiktok.com', 'accounts.google',
      'how to get', 'how to apply for internship tips', 'resume template',
      'what is an internship', 'internship guide', 'cover letter'
    ];
    if (junk.some((j) => text.includes(j) || (url || '').toLowerCase().includes(j))) return false;

    if (kind === 'internship') {
      if (!/intern|internship|trainee|apprentice|student/.test(text)) return false;
    } else if (!/fresher|freshers|entry[- ]?level|junior|graduate|campus|trainee|hiring|jobs?|opening/.test(text)) {
      return false;
    }

    if (!field || !field.keywords || !field.keywords.length) return true;

    // Hard excludes for clearly wrong fields
    if (field.exclude && field.exclude.some((ex) => text.includes(ex.toLowerCase()))) {
      // Still allow if a strong field keyword is also present
      const strongHit = field.keywords.some((kw) => kw.length >= 5 && text.includes(kw.toLowerCase()));
      if (!strongHit) return false;
    }

    const hits = field.keywords.filter((kw) => text.includes(String(kw).toLowerCase()));
    if (hits.length >= 1) return true;

    // Title-only soft match on primary field label words
    const titleLower = (title || '').toLowerCase();
    const labelParts = String(field.label || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4);
    if (labelParts.some((p) => titleLower.includes(p))) return true;

    return false;
  }

  guessCompany(title, url) {
    const atMatch = title.match(/\bat\s+([^|\-–—]+)$/i);
    if (atMatch) return atMatch[1].trim();
    const pipeMatch = title.split('|');
    if (pipeMatch.length > 1) return pipeMatch[pipeMatch.length - 1].trim();
    const dashMatch = title.split(/\s[-–—]\s/);
    if (dashMatch.length > 1) return dashMatch[dashMatch.length - 1].trim();
    const fromUrl = (String(url).match(/-at-([a-z0-9-]+?)(?:\d+)?$/i) || [])[1];
    if (fromUrl) {
      return fromUrl.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return this.detectSource(url);
  }

  normalizeJob(item, location, kind, field) {
    const title = this.decodeHtml(item.title || '');
    const description = this.decodeHtml(item.description || item.snippet || '');
    const applyUrl = String(item.applyUrl || item.url || '').trim();
    if (!title || !applyUrl || !/^https?:\/\//i.test(applyUrl)) return null;
    if (!this.isRelevantListing(title, description, applyUrl, kind, field)) return null;

    return {
      title,
      company: item.company || this.guessCompany(title, applyUrl),
      location: item.location || location || '',
      description: description || `Open the link for the full ${(kind === 'fresher' ? 'job' : 'internship')} description.`,
      applyUrl,
      postedDate: item.postedDate || 'Recent',
      source: this.detectSource(applyUrl),
      kind: kind || 'internship',
      field: field ? field.label : undefined
    };
  }

  /**
   * Google search in hidden Electron window.
   * tbs=qdr:w → past week (recently updated listings first).
   */
  async fetchGoogleViaElectron(query, { recent = true, num = 12 } = {}) {
    let electron;
    try {
      electron = require('electron');
    } catch {
      throw new Error('Open the desktop app (Electron) to search Google for jobs');
    }

    const { BrowserWindow, app } = electron;
    if (!app || !BrowserWindow) {
      throw new Error('Electron BrowserWindow unavailable');
    }
    if (!app.isReady()) await app.whenReady();

    const tbs = recent ? '&tbs=qdr:w' : '';
    const searchUrl =
      `https://www.google.com/search?q=${encodeURIComponent(query)}` +
      `&num=${num}&hl=en&gl=in&pws=0${tbs}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 900,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          images: false,
          javascript: true
        }
      });

      const finish = (err, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (!win.isDestroyed()) win.destroy();
        } catch {}
        if (err) reject(err);
        else resolve(data);
      };

      const timer = setTimeout(() => finish(new Error('Google search timed out')), 28000);

      win.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      win.webContents.on('did-fail-load', (_e, code, desc) => {
        finish(new Error(`Google page failed to load (${code}): ${desc}`));
      });

      win.webContents.on('did-finish-load', async () => {
        try {
          await win.webContents
            .executeJavaScript(`
            (() => {
              const buttons = [...document.querySelectorAll('button, input[type="submit"]')];
              const accept = buttons.find(b => /accept all|i agree|agree/i.test((b.innerText || b.value || '')));
              if (accept) accept.click();
              return true;
            })();
          `)
            .catch(() => {});

          await new Promise((r) => setTimeout(r, 2000));

          const raw = await win.webContents.executeJavaScript(`
            (() => {
              const out = [];
              const seen = new Set();
              document.querySelectorAll('a').forEach(a => {
                const h3 = a.querySelector('h3');
                if (!h3) return;
                let href = a.href || '';
                if (!href) return;
                if (/google\\.(com|[a-z.]+)\\/(search|aclk|url\\?)/i.test(href)) {
                  try {
                    const u = new URL(href);
                    href = u.searchParams.get('q') || u.searchParams.get('url') || href;
                  } catch {}
                }
                if (!/^https?:\\/\\//i.test(href)) return;
                if (/google\\.(com|[a-z.]+)\\//i.test(href)) return;
                const key = href.split('?')[0].toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);

                let snippet = '';
                const root = a.closest('div.g') || a.closest('div[data-sokoban-container]') || a.parentElement;
                if (root) {
                  const sn =
                    root.querySelector('.VwiC3b') ||
                    root.querySelector('[data-sncf]') ||
                    root.querySelector('.IsZvec') ||
                    root.querySelector('div[style*="-webkit-line-clamp"]');
                  if (sn) snippet = (sn.innerText || '').trim();
                }
                if (!snippet && a.parentElement && a.parentElement.parentElement) {
                  snippet = (a.parentElement.parentElement.innerText || '')
                    .replace(h3.innerText, '')
                    .trim()
                    .slice(0, 320);
                }

                out.push({
                  title: (h3.innerText || '').trim(),
                  url: href,
                  snippet: snippet.slice(0, 450)
                });
              });
              return out;
            })();
          `);

          finish(null, Array.isArray(raw) ? raw : []);
        } catch (err) {
          finish(err);
        }
      });

      win.loadURL(searchUrl).catch((err) => finish(err));
    });
  }

  mapEducationToInternshalaCategory(education) {
    const e = (education || '').toLowerCase();
    if (/cyber|infosec|information\s*security|ethical\s*hack|pen\s*test|soc\b/.test(e)) {
      return 'cyber-security-internship';
    }
    if (/data\s*science|machine\s*learning|\bml\b|artificial\s*intelligence|\bai\b/.test(e)) {
      return 'data-science-internship';
    }
    if (/cse|computer|software|it\b|bca|mca|b\.?tech.*cs|information tech|web|full\s*stack/.test(e)) {
      return 'computer-science-internship';
    }
    if (/ece|electronics|electrical|embedded/.test(e)) return 'electronics-internship';
    if (/mech/.test(e)) return 'mechanical-internship';
    if (/civil/.test(e)) return 'civil-internship';
    if (/marketing|mba/.test(e)) return 'marketing-internship';
    if (/design|ui|ux/.test(e)) return 'graphic-design-internship';
    if (/law|llb/.test(e)) return 'law-internship';
    if (/content|english|journal/.test(e)) return 'content-writing-internship';
    return null;
  }

  async fetchInternshalaFallback(education, location, limit = 10, field = null) {
    const edu = this.buildEducationSearchQuery(education);
    const loc = (location || '').trim();
    const category = this.mapEducationToInternshalaCategory(education);
    const locSlug = loc
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const profile = field || this.extractFieldProfile(education);

    const urls = [];
    if (category && locSlug) urls.push(`https://internshala.com/internships/${category}-in-${locSlug}/`);
    if (category) urls.push(`https://internshala.com/internships/${category}/`);
    if (locSlug) urls.push(`https://internshala.com/internships/internship-in-${locSlug}/`);
    urls.push(
      `https://internshala.com/internships/?keywords=${encodeURIComponent(`${edu} ${loc}`.trim())}`
    );

    const jobs = [];
    const seen = new Set();

    for (const url of urls) {
      try {
        const resp = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html',
            'Accept-Language': 'en-IN,en;q=0.9'
          },
          validateStatus: (s) => s < 500
        });
        if (resp.status >= 400) continue;

        const html = String(resp.data || '');
        const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];

        for (const block of ldBlocks) {
          try {
            const data = JSON.parse(block[1]);
            const lists = Array.isArray(data) ? data : [data];
            for (const node of lists) {
              if (!node || node['@type'] !== 'ItemList' || !Array.isArray(node.itemListElement)) continue;
              for (const item of node.itemListElement) {
                const name = this.decodeHtml(item.name || '');
                const itemUrl = item.url || (item.item && item.item.url) || '';
                if (!name || !itemUrl || seen.has(itemUrl)) continue;

                const candidate = {
                  title: name.replace(/\s*-\s*Internship\s*$/i, '') + ' — Internship',
                  company: this.guessCompany(name, itemUrl),
                  location: loc,
                  description: `${name}. ${profile.label} internship matched to your education (${edu})${loc ? ` in ${loc}` : ''}. Open for full description.`,
                  applyUrl: itemUrl,
                  postedDate: 'Recent',
                  source: 'Internshala',
                  kind: 'internship'
                };

                // Strict field filter — skip unrelated Internshala rows
                if (!this.isRelevantListing(candidate.title, candidate.description, itemUrl, 'internship', profile)) {
                  continue;
                }

                seen.add(itemUrl);
                jobs.push(candidate);
                if (jobs.length >= limit) return jobs;
              }
            }
          } catch {}
        }
      } catch {}
    }

    return jobs.slice(0, limit);
  }

  collectNormalized(rawList, location, kind, seen, limit, field) {
    const out = [];
    for (const raw of rawList) {
      if (out.length >= limit) break;
      const job = this.normalizeJob(raw, location, kind, field);
      if (!job) continue;
      const key = job.applyUrl.split('?')[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
    }
    return out;
  }

  /**
   * Flow:
   * 1) Read education from profile → derive field (e.g. Cybersecurity)
   * 2) Google → 10 recent field-related internships only
   * 3) Google → 10 recent field-related fresher jobs
   * Display total 20 with descriptions. Refresh fetches newly updated listings.
   */
  async searchJobs(education, location) {
    try {
      const field = this.extractFieldProfile(education);
      const edu = field.primary;
      const loc = (location || 'India').trim();
      const seen = new Set();
      const errors = [];

      console.log(`[JobSearch] Field="${field.label}" query="${edu}" location="${loc}"`);

      // --- Phase 1: 10 field-matched internships (recent) ---
      let internships = [];
      const internQuery = `(${field.googleTerms}) internship (student OR fresher OR trainee) ${loc}`;
      try {
        const raw = await this.fetchGoogleViaElectron(internQuery, { recent: true, num: 20 });
        internships = this.collectNormalized(
          raw.map((r) => ({ title: r.title, url: r.url, description: r.snippet })),
          loc,
          'internship',
          seen,
          10,
          field
        );
      } catch (e) {
        errors.push(e.message || String(e));
      }

      // Second Google pass with simpler query if thin
      if (internships.length < 10) {
        try {
          const raw2 = await this.fetchGoogleViaElectron(
            `${edu} ${field.label} internship jobs in ${loc}`,
            { recent: true, num: 15 }
          );
          const more = this.collectNormalized(
            raw2.map((r) => ({ title: r.title, url: r.url, description: r.snippet })),
            loc,
            'internship',
            seen,
            10 - internships.length,
            field
          );
          internships = internships.concat(more);
        } catch (e) {
          errors.push(e.message || String(e));
        }
      }

      if (internships.length < 10) {
        try {
          const fallback = await this.fetchInternshalaFallback(
            education,
            loc,
            10 - internships.length,
            field
          );
          for (const job of fallback) {
            const key = job.applyUrl.split('?')[0].toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            internships.push(job);
            if (internships.length >= 10) break;
          }
        } catch (e) {
          errors.push(e.message || String(e));
        }
      }

      await new Promise((r) => setTimeout(r, 500));

      // --- Phase 2: 10 field-matched fresher jobs (recent) ---
      let fresherJobs = [];
      const fresherQuery = `(${field.googleTerms}) (fresher OR "entry level" OR graduate) jobs ${loc}`;
      try {
        const raw = await this.fetchGoogleViaElectron(fresherQuery, { recent: true, num: 20 });
        fresherJobs = this.collectNormalized(
          raw.map((r) => ({ title: r.title, url: r.url, description: r.snippet })),
          loc,
          'fresher',
          seen,
          10,
          field
        );
      } catch (e) {
        errors.push(e.message || String(e));
      }

      if (fresherJobs.length < 10) {
        try {
          const raw2 = await this.fetchGoogleViaElectron(
            `${edu} ${field.label} fresher OR "entry level" jobs in ${loc} recently posted`,
            { recent: true, num: 15 }
          );
          const more = this.collectNormalized(
            raw2.map((r) => ({ title: r.title, url: r.url, description: r.snippet })),
            loc,
            'fresher',
            seen,
            10 - fresherJobs.length,
            field
          );
          fresherJobs = fresherJobs.concat(more);
        } catch (e) {
          errors.push(e.message || String(e));
        }
      }

      const jobs = [...internships.slice(0, 10), ...fresherJobs.slice(0, 10)];

      if (!jobs.length) {
        return {
          jobs: [],
          internships: [],
          fresherJobs: [],
          fieldLabel: field.label,
          error: {
            code: errors.length ? 'SEARCH_BLOCKED' : 'NO_RESULTS',
            message:
              errors[0] ||
              `No recent ${field.label} internships or fresher jobs found. Try Refresh or search LinkedIn / Naukri / Indeed.`
          }
        };
      }

      return {
        jobs,
        internships: internships.slice(0, 10),
        fresherJobs: fresherJobs.slice(0, 10),
        fieldLabel: field.label,
        error: null,
        query: edu
      };
    } catch (err) {
      return {
        jobs: [],
        internships: [],
        fresherJobs: [],
        error: { code: 'NETWORK_ERROR', message: err.message || String(err) }
      };
    }
  }
}

module.exports = new JobSearch();
