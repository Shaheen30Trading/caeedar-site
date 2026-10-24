// Netlify build step (no dependencies). Runs on every deploy, including each
// publish from the /admin portal, so everything below always matches
// data/suites.json:
//   - suites/<unit>/index.html   one page per suite
//   - suite-unavailable.html     shown (with a 404) for any suite address that no
//                                longer exists, and for old WordPress unit pages
//   - index.html                 inline suite data + crawlable suite links
//   - sitemap.xml                home page + every suite page
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://livingincobourg.ca';
const V = '20261006';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), s); };
const exists = (p) => fs.existsSync(path.join(ROOT, p.replace(/^\//, '').split('?')[0]));

const contact = JSON.parse(read('data/contact.json'));
const raw = JSON.parse(read('data/suites.json'));
// Web-app address of the Google Apps Script in the leasing account that receives
// application uploads. While it is empty, the /apply/ page and its buttons are not built.
const APPLY_ENDPOINT = exists('data/apply.json') ? String(JSON.parse(read('data/apply.json')).endpoint || '').trim() : '';

/* ---------- data ---------- */
const TYPES = { studio: 'Studio', '1b': '1 Bedroom', '1bd': '1 Bedroom + Den', '2b': '2 Bedroom', '2bd': '2 Bedroom + Den' };
const TYPE_PIC = { studio: '/img/int-open-plan.jpg', '1b': '/img/int-living-windows.jpg', '1bd': '/img/int-living-kitchen.jpg', '2b': '/img/int-island.jpg', '2bd': '/img/int-island.jpg' };
const TYPICAL = [
  ['/img/int-open-plan.jpg', 'Open-plan living'], ['/img/int-kitchen-detail.jpg', 'Kitchen'],
  ['/img/int-living-windows.jpg', 'Living room'], ['/img/int-laundry.jpg', 'In-suite laundry'],
  ['/img/int-bath.jpg', 'Bathroom'], ['/img/int-island.jpg', 'Kitchen island'],
];
const BLURB = {
  studio: 'An open studio with tall windows, a full kitchen and your own washer and dryer. Simple, bright and easy to keep, a short walk from the beach and King Street.',
  '1b': 'A one bedroom with an open living and kitchen area, tall windows and in-suite laundry. Room to settle in, a short walk from the beach and King Street.',
  '1bd': 'A one bedroom with a separate den for a home office, guest bed or extra storage. Open living and kitchen, tall windows and in-suite laundry.',
  '2b': 'A two bedroom with an open living and kitchen area, tall windows and in-suite laundry. Space for a family, a roommate or a dedicated office.',
  '2bd': 'A two bedroom with a separate den, an open living and kitchen area, tall windows and in-suite laundry.',
};
// Second paragraph of the standard description. The portal's Description field is
// required and starts with this text; the build only falls back to it if the field is empty.
const ABOUT_BUILDING = 'CAEEDAR is a new geothermal rental building at 325 University Ave W in downtown Cobourg, an hour east of Toronto. Victoria Park Beach, the harbour and the shops on King Street are a short walk away.';
// Keys match the "features" checkboxes in admin/config.yml
const FEATURES = [
  ['utilitiesIncluded', 'Heat, cooling and water included (geothermal)'],
  ['laundry', 'In-suite washer and dryer'],
  ['kitchen', 'Full kitchen with dishwasher and microwave'],
  ['centralAir', 'Central air'],
  ['tallWindows', 'Tall windows'],
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (p) => (p ? '/' + String(p).replace(/^\//, '') : '');
const money = (n) => '$' + Number(n).toLocaleString('en-CA');
// "203 ", "Unit 319", "Suite #116" all become the bare unit number used in page addresses and labels
const slug = (u) => String(u ?? '').trim().replace(/^(unit|suite|apt|apartment)\b\.?|#/gi, '').replace(/[^A-Za-z0-9-]/g, '');
const today = new Date(); today.setHours(0, 0, 0, 0);
const isNow = (s) => s.availableNow || !s.availableDate || new Date(s.availableDate + 'T12:00:00') <= today;
const whenLabel = (s) => { if (isNow(s)) return 'Available now'; const d = new Date(s.availableDate + 'T12:00:00'); return 'Available ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); };

const suites = (raw.suites || raw).map((s) => {
  const type = TYPES[s.type] ? s.type : 'studio';
  const unit = slug(s.unit);
  const plan = [abs(s.plan), `/img/plan-${unit}.jpg`].find((p) => p && exists(p)) || '';
  const planThumb = [abs(s.planThumb), plan, `/img/plan-thumb-${unit}.jpg`].find((p) => p && exists(p)) || '';
  return {
    unit, type, label: s.label || TYPES[type], sqft: +s.sqft || 0, bath: +s.bath || 1, price: +s.price || 0,
    availableNow: !!s.availableNow, availableDate: s.availableDate ? String(s.availableDate).slice(0, 10) : '',
    barrierFree: !!s.barrierFree, plan, planThumb,
    photos: (s.photos || []).map(abs).filter(Boolean),
    description: (s.description || '').trim() || BLURB[type] + '\n\n' + ABOUT_BUILDING,
    highlights: (s.highlights || []).map((h) => String(h).trim()).filter(Boolean),
    // ticked in the portal's "Features in this suite" checkboxes; a box that has never been set counts as ticked
    features: FEATURES.filter(([key]) => (s.features || {})[key] !== false).map(([, text]) => text),
  };
}).filter((s) => s.unit)
  .sort((a, b) => (isNow(a) ? '0' : a.availableDate).localeCompare(isNow(b) ? '0' : b.availableDate) || a.price - b.price);

const phone = contact.phone || '416-515-9191';
const tel = 'tel:+1' + phone.replace(/\D/g, '').slice(-10);
const email = contact.email || 'leasing@livingincobourg.ca';
const bookingUrl = contact.bookingUrl || '';

/* ---------- shared page parts ---------- */
const head = ({ title, desc, canonical, image, noindex, ld }) => `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}${image}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
<meta property="og:site_name" content="CAEEDAR">
<meta property="og:locale" content="en_CA">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#8B0344">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/suite.css?v=${V}">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="sp show-bar">
<header class="top solid">
  <div class="wrap">
    <a class="brand" href="/" aria-label="CAEEDAR home"><img class="brand-mark" src="/img/logo-mark-wine.png?v=20260923b" alt="CAEEDAR" width="960" height="176"><small>325 University Ave W, Cobourg</small></a>
    <nav class="links" aria-label="Main"><a href="/#cobourg">Cobourg</a><a href="/#building">Building</a><a href="/#included">Energy &amp; utilities</a><a href="/#suites">Suites</a><a href="/#location">Location</a><a href="/#apply">How to rent</a></nav>
    <div class="top-actions">
      <a class="phone" href="${tel}">${esc(phone)}</a>
      <a class="btn btn-wine btn-sm" href="#book">Book a viewing</a>
    </div>
  </div>
</header>
<main>`;

const foot = () => `</main>
<footer>
  <div class="wrap">
    <div class="fgrid2">
      <div class="fbrand">
        <img src="/img/logo-mark-white.png?v=20260923b" alt="CAEEDAR" width="960" height="176">
        <p class="ftag">Cobourg Accessible Energy Efficient Downtown Apartment Rentals</p>
        <p class="faddr">325 University Ave W<br>Cobourg, ON K9A 3S9</p>
      </div>
      <div><h4>Contact</h4><a href="${tel}">${esc(phone)}</a><a href="mailto:${esc(email)}">${esc(email)}</a><a href="#book">Book a viewing</a></div>
      <div><h4>Follow</h4><a href="https://www.instagram.com/caeedar/" target="_blank" rel="noopener">Instagram</a><a href="https://www.facebook.com/people/Caeedar/61592659410158/" target="_blank" rel="noopener">Facebook</a></div>
    </div>
    <div class="legal"><span>© ${new Date().getFullYear()} CAEEDAR. Managed by Balder Corporation.</span><span>Prices and availability subject to change.</span></div>
  </div>
</footer>
<div class="mobile-bar">
  <a class="btn btn-ghost" href="${tel}">Call</a>
  <a class="btn btn-white" href="#book">Book a viewing</a>
</div>
<script>
/* refresh "Available <date>" labels if the date has passed since this page was built */
(function(){var t=new Date();t.setHours(0,0,0,0);document.querySelectorAll('[data-avail]').forEach(function(el){var d=new Date(el.getAttribute('data-avail')+'T12:00:00');if(d<=t){el.textContent='Available now';el.classList.add('now');}});})();
</script>
</body>
</html>
`;

const card = (s) => {
  const img = s.photos[0] || TYPE_PIC[s.type];
  return `<a class="sp-card" href="/suites/${s.unit}/">
      <span class="sp-card-media"><img src="${img}" alt="${esc(s.label)}, suite ${s.unit}" loading="lazy"><span class="when${isNow(s) ? ' now' : ''}"${isNow(s) ? '' : ` data-avail="${s.availableDate}"`}>${whenLabel(s)}</span></span>
      <span class="sp-card-body"><b>${esc(s.label)}</b><span>Suite ${s.unit} · ${s.sqft} sq ft · ${s.bath} bath</span><strong>${money(s.price)} <small>/ month</small></strong></span>
    </a>`;
};

const bookForm = (s) => `<section class="sp-book" id="book">
  <div class="wrap sp-book-grid">
    <div>
      <p class="eyebrow">Book a viewing</p>
      <h2>${s ? `See suite ${s.unit} in person.` : 'Come see what is available.'}</h2>
      <p class="lede" style="margin-top:14px">Pick a day and time that suits you. The leasing team will confirm by email or phone.</p>
      <div class="sp-contact">
        <a href="${tel}">${esc(phone)}</a>
        <a href="mailto:${esc(email)}">${esc(email)}</a>
        ${bookingUrl ? `<a href="${esc(bookingUrl)}" target="_blank" rel="noopener">Pick a time on our calendar</a>` : ''}
      </div>
    </div>
    <form class="card" name="viewing-request" method="POST" data-netlify="true" netlify-honeypot="company" action="${s ? `/suites/${s.unit}/` : '/'}?sent=1#book" id="spForm">
      <input type="hidden" name="form-name" value="viewing-request">
      <p class="hp"><label>Leave empty <input name="company"></label></p>
      <input type="hidden" name="suite" value="${s ? esc(`Suite ${s.unit} · ${s.label}`) : 'Not sure yet'}">
      <div class="row2">
        <div class="field"><label for="f-name">Name</label><input id="f-name" name="name" autocomplete="name" required></div>
        <div class="field"><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" required></div>
      </div>
      <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
      <div class="row2">
        <div class="field"><label for="f-date">Preferred day</label><input id="f-date" name="preferred_day" type="date" required></div>
        <div class="field"><label for="f-time">Preferred time</label><select id="f-time" name="preferred_time"><option>Morning (9&ndash;12)</option><option>Afternoon (12&ndash;4)</option><option>Evening (4&ndash;7)</option><option>Any time</option></select></div>
      </div>
      <div class="field"><label for="f-msg">Anything else? <span class="opt">(optional)</span></label><textarea id="f-msg" name="message" rows="3" placeholder="Move-in date, parking, pets, accessibility needs, questions&hellip;"></textarea></div>
      <button class="btn btn-wine" type="submit">Request a viewing</button>
      <div class="thanks" id="thanks" role="status">Thanks! Your request is in. The leasing team will be in touch to confirm a time.</div>
    </form>
  </div>
</section>
<script>
(function(){
  var f=document.getElementById('spForm'), t=document.getElementById('thanks'), d=document.getElementById('f-date');
  if(d){ var n=new Date(); n.setMinutes(n.getMinutes()-n.getTimezoneOffset()); d.min=n.toISOString().slice(0,10); }
  if(/[?&]sent=1/.test(location.search)) t.style.display='block';
  f.addEventListener('submit',function(e){
    if(!window.fetch) return; e.preventDefault();
    var b=f.querySelector('button[type=submit]'); b.disabled=true; b.textContent='Sending\\u2026';
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f)).toString()})
      .then(function(r){ if(!r.ok) throw 0; t.className='thanks'; t.style.display='block'; f.reset(); b.textContent='Request sent'; })
      .catch(function(){ t.className='thanks err'; t.innerHTML='Sorry, that didn\\u2019t send. Please email <a href="mailto:${esc(email)}">${esc(email)}</a>.'; t.style.display='block'; b.disabled=false; b.textContent='Request a viewing'; });
  });
})();
</script>`;

/* ---------- one page per suite ---------- */
const suitePage = (s) => {
  const url = `${SITE}/suites/${s.unit}/`;
  const typical = s.photos.length === 0;
  const gallery = typical ? TYPICAL : s.photos.map((p, i) => [p, `Suite ${s.unit}, photo ${i + 1}`]);
  const lower = s.label.toLowerCase();
  const title = `Suite ${s.unit}: ${s.label} for Rent in Cobourg, ${money(s.price)}/mo | CAEEDAR`;
  const utilities = s.features.includes(FEATURES[0][1]);
  const desc = `${s.label} apartment for rent at CAEEDAR, 325 University Ave W, Cobourg. ${s.sqft} sq ft, ${s.bath} bath, ${money(s.price)}/month, ${whenLabel(s).replace(/^Available/, 'available')}.${utilities ? ' Heat, cooling and water included.' : ''}`;
  const highlights = [...s.features, ...(s.barrierFree ? ['Barrier-free layout'] : []), ...s.highlights];
  const others = suites.filter((o) => o.unit !== s.unit);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Apartment', '@id': url + '#suite', name: `${s.label}, Suite ${s.unit}, CAEEDAR`, url, description: s.description,
        numberOfBedrooms: { studio: 0, '1b': 1, '1bd': 1, '2b': 2, '2bd': 2 }[s.type], numberOfBathroomsTotal: s.bath,
        floorSize: { '@type': 'QuantitativeValue', value: s.sqft, unitCode: 'FTK' },
        image: gallery.map((g) => SITE + g[0]),
        accommodationCategory: s.label,
        address: { '@type': 'PostalAddress', streetAddress: '325 University Ave W', addressLocality: 'Cobourg', addressRegion: 'ON', postalCode: 'K9A 3S9', addressCountry: 'CA' },
        containedInPlace: { '@id': SITE + '/#building' },
        amenityFeature: highlights.map((h) => ({ '@type': 'LocationFeatureSpecification', name: h, value: true })),
      },
      {
        '@type': 'Offer', '@id': url + '#offer', url, itemOffered: { '@id': url + '#suite' }, businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: s.price, priceCurrency: 'CAD', unitText: 'MON' },
        availability: 'https://schema.org/InStock', ...(isNow(s) ? {} : { availabilityStarts: s.availableDate }),
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CAEEDAR', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Available suites', item: SITE + '/#suites' },
          { '@type': 'ListItem', position: 3, name: `Suite ${s.unit}`, item: url },
        ],
      },
    ],
  };

  return head({ title, desc, canonical: url, image: gallery[0][0], ld }) + `
<div class="wrap sp-crumbs"><a href="/">Home</a> <span>›</span> <a href="/#suites">Available suites</a> <span>›</span> Suite ${s.unit}</div>

<section class="wrap sp-hero">
  <div class="sp-gallery">
    <figure class="sp-main"><img id="spMain" src="${gallery[0][0]}" alt="${esc(gallery[0][1])}">${typical ? '<figcaption>Photos show a similar suite at CAEEDAR</figcaption>' : ''}</figure>
    ${gallery.length > 1 ? `<div class="sp-thumbs" id="spThumbs">${gallery.map((g, i) => `<button type="button" data-src="${g[0]}" data-alt="${esc(g[1])}" aria-label="${esc(g[1])}"${i === 0 ? ' aria-current="true"' : ''}><img src="${g[0]}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
  </div>
  <div class="sp-info">
    <p class="eyebrow">Suite ${s.unit} · CAEEDAR</p>
    <h1>${esc(s.label)}</h1>
    <p class="sp-facts"><span>${s.sqft} sq ft</span><span>${s.bath} bath</span>${s.barrierFree ? '<span class="bf">Barrier-free</span>' : ''}</p>
    <p class="sp-when${isNow(s) ? ' now' : ''}"${isNow(s) ? '' : ` data-avail="${s.availableDate}"`}>${whenLabel(s)}</p>
    <p class="sp-price">${money(s.price)} <small>/ month</small></p>
    ${utilities ? '<p class="sp-incl">Heat, cooling and water included.</p>' : ''}
    <div class="sp-ctas">
      <a class="btn btn-wine" href="#book">Book a viewing</a>
      <a class="btn btn-line" href="${tel}">Call ${esc(phone)}</a>
    </div>
    ${APPLY_ENDPOINT ? `<a class="sp-apply" href="/apply/?suite=${s.unit}">Apply now for this suite</a><br>` : ''}<a class="sp-apply" href="/files/Caeedar-Rental-Application.pdf" download>Download the rental application (PDF)</a>
  </div>
</section>

<section class="wrap sp-details">
  <div class="sp-about">
    <h2>About this suite</h2>
    ${s.description.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('\n    ')}
    ${highlights.length ? `<ul class="sp-list">${highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    <h3>Optional extras</h3>
    <ul class="sp-extras"><li><span>Underground parking</span><b>$100/mo</b></li><li><span>Outdoor parking</span><b>$60/mo</b></li><li><span>Storage locker</span><b>$65/mo</b></li><li><span>EV charging</span><b>On site</b></li></ul>
  </div>
  ${s.planThumb ? `<div class="sp-plan">
    <h2>Floor plan</h2>
    <a href="${s.plan || s.planThumb}" target="_blank" rel="noopener"><img src="${s.planThumb}" alt="Floor plan of suite ${s.unit}, ${esc(lower)}" loading="lazy"></a>
    ${s.plan && s.plan !== s.planThumb ? `<a class="sp-plan-link" href="${s.plan}" target="_blank" rel="noopener">See where the suite sits in the building</a>` : ''}
  </div>` : ''}
</section>

${bookForm(s)}

${others.length ? `<section class="wrap sp-others">
  <h2>Other available suites</h2>
  <div class="sp-cards">
    ${others.map(card).join('\n    ')}
  </div>
  <p style="margin-top:24px"><a class="btn btn-line" href="/#suites">See all suites and filters</a></p>
</section>` : ''}
<script>
(function(){ var th=document.getElementById('spThumbs'), m=document.getElementById('spMain'); if(!th) return;
  th.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; m.src=b.dataset.src; m.alt=b.dataset.alt;
    [].forEach.call(th.children,function(c){ c.setAttribute('aria-current', c===b?'true':'false'); }); }); })();
</script>
` + foot();
};

/* ---------- "this suite has been rented" page ---------- */
const unavailablePage = () => head({
  title: 'This suite is no longer available | CAEEDAR, Apartments for Rent in Cobourg',
  desc: 'This suite has been rented. See the suites available now at CAEEDAR, 325 University Ave W, Cobourg.',
  image: '/img/cob-beach-aerial.jpg', noindex: true,
}) + `
<section class="wrap sp-gone">
  <p class="eyebrow">Suite no longer available</p>
  <h1>This suite has been rented.</h1>
  <p class="lede">The suite you were looking for is no longer on the market. ${suites.length ? `Here ${suites.length === 1 ? 'is the suite' : `are the ${suites.length} suites`} available at CAEEDAR right now.` : 'Send us a message and we will let you know when one opens up.'}</p>
  ${suites.length ? `<div class="sp-cards">
    ${suites.map(card).join('\n    ')}
  </div>` : ''}
  <p style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-wine" href="/#suites">See all suites</a><a class="btn btn-line" href="/">Go to the home page</a></p>
</section>
${bookForm(null)}
` + foot();

/* ---------- online application upload page (apply/) ---------- */
const DOCS = [
  ['application', 'Completed rental application', 'The filled-in application form. A PDF, or clear photos of each page.', true],
  ['income', 'Proof of income', 'Employment letter, recent pay stubs, tax documents or other proof of income.', true],
  ['noa', 'Notice of Assessment', 'Your most recent one, if you are self-employed.', false],
  ['id', 'Photo ID', 'Driver&rsquo;s licence, passport or other government photo ID.', true],
  ['other', 'Anything else', 'For example a reference letter or credit report.', false],
];
const applyPage = () => head({
  title: 'Apply Online | CAEEDAR, Apartments for Rent in Cobourg',
  desc: 'Upload your rental application and documents for CAEEDAR, 325 University Ave W, Cobourg. No account needed.',
  image: '/img/cob-beach-aerial.jpg', noindex: true,
}).replaceAll('href="#book"', 'href="/#contact"') + `
<section class="wrap ap">
  <div class="ap-intro">
    <p class="eyebrow">How to rent · Step 2</p>
    <h1>Apply online.</h1>
    <p class="lede">Upload your rental application and documents here. It takes a few minutes and you don&rsquo;t need an account. Everything goes straight to the CAEEDAR leasing team.</p>
    <ol class="ap-steps">
      <li><a href="/files/Caeedar-Rental-Application.pdf" download>Download the rental application (PDF)</a> and fill it in on your computer, or print it and take clear photos of each page.</li>
      <li>Have your proof of income and photo ID ready as PDFs or photos.</li>
      <li>Fill in the form and submit. You&rsquo;ll get a confirmation email.</li>
    </ol>
    <p class="ap-note">PDF, JPG, PNG or HEIC, up to 10 MB per file. Prefer email? Send everything to <a href="mailto:${esc(email)}">${esc(email)}</a>.</p>
  </div>
  <form class="card ap-form" id="apForm" novalidate>
    <p class="hp"><label>Leave empty <input name="company" tabindex="-1" autocomplete="off"></label></p>
    <div class="row2">
      <div class="field"><label for="a-name">Full name</label><input id="a-name" name="name" autocomplete="name" required></div>
      <div class="field"><label for="a-phone">Phone</label><input id="a-phone" name="phone" type="tel" autocomplete="tel" required></div>
    </div>
    <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" required></div>
    <div class="row2">
      <div class="field"><label for="a-suite">Suite</label><select id="a-suite" name="suite">${suites.map((s) => `<option value="${esc(`Suite ${s.unit} · ${s.label}`)}" data-unit="${s.unit}">Suite ${s.unit} · ${esc(s.label)} · ${money(s.price)}/mo</option>`).join('')}<option value="Not sure yet">Not sure yet</option></select></div>
      <div class="field"><label for="a-move">Move-in date <span class="opt">(optional)</span></label><input id="a-move" name="moveIn" type="date"></div>
    </div>
    ${DOCS.map(([key, label, hint, req]) => `<div class="field ap-file">
      <label for="a-${key}">${label} ${req ? '' : '<span class="opt">(optional)</span>'}</label>
      <span class="ap-hint">${hint}</span>
      <input id="a-${key}" type="file" data-doc="${key}"${req ? ' data-required' : ''} multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/*">
    </div>`).join('\n    ')}
    <div class="field"><label for="a-msg">Anything else we should know? <span class="opt">(optional)</span></label><textarea id="a-msg" name="message" rows="3" placeholder="Pets, parking, co-applicants, questions&hellip;"></textarea></div>
    <label class="ap-consent"><input type="checkbox" id="a-consent" required> <span>I agree that the CAEEDAR leasing team (Balder Corporation) may use these documents only to assess my rental application. Documents from applicants who don&rsquo;t rent are deleted after 90 days.</span></label>
    <button class="btn btn-wine" type="submit">Submit application</button>
    <div class="thanks" id="apStatus" role="status" aria-live="polite"></div>
  </form>
</section>
<script>
(function(){
  var END=${JSON.stringify(APPLY_ENDPOINT)}, MAX=10*1024*1024, OK=/\\.(pdf|jpe?g|png|hei[cf])$/i;
  var f=document.getElementById('apForm'), st=document.getElementById('apStatus'), btn=f.querySelector('button[type=submit]');
  var m=location.search.match(/[?&]suite=([^&]+)/), sel=document.getElementById('a-suite');
  if(m){ for(var i=0;i<sel.options.length;i++){ if(sel.options[i].getAttribute('data-unit')===decodeURIComponent(m[1])) sel.selectedIndex=i; } }
  var mv=document.getElementById('a-move'); var n=new Date(); n.setMinutes(n.getMinutes()-n.getTimezoneOffset()); mv.min=n.toISOString().slice(0,10);
  function say(msg,err){ st.className='thanks'+(err?' err':''); st.innerHTML=msg; st.style.display='block'; }
  function post(o){ return fetch(END,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(o)}).then(function(r){return r.json();}).then(function(j){ if(!j.ok) throw new Error(j.error||'Something went wrong.'); return j; }); }
  function b64(file){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(String(r.result).split(',')[1]||''); }; r.onerror=function(){ rej(new Error('Could not read '+file.name+'.')); }; r.readAsDataURL(file); }); }
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=function(id){ return document.getElementById(id).value.trim(); };
    var files=[], problem='';
    [].forEach.call(f.querySelectorAll('input[type=file]'),function(inp){
      var lbl=inp.parentNode.querySelector('label').firstChild.textContent.trim();
      if(inp.hasAttribute('data-required') && !inp.files.length && !problem) problem='Please add your '+lbl.toLowerCase()+'.';
      [].forEach.call(inp.files,function(file){
        if(!OK.test(file.name) && !problem) problem=file.name+' isn\\u2019t a PDF, JPG, PNG or HEIC file.';
        else if(file.size>MAX && !problem) problem=file.name+' is over 10 MB. Try a smaller photo or a PDF.';
        files.push({doc:inp.getAttribute('data-doc'),file:file});
      });
    });
    if(!v('a-name')||!v('a-phone')||!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v('a-email'))) problem='Please fill in your name, phone and a valid email.';
    else if(!problem && files.length>12) problem='Please upload 12 files or fewer.';
    else if(!problem && !document.getElementById('a-consent').checked) problem='Please tick the consent box.';
    if(problem){ say(problem,true); return; }
    btn.disabled=true; btn.textContent='Uploading\\u2026'; say('Starting your application\\u2026');
    post({action:'start',company:f.company.value,name:v('a-name'),email:v('a-email'),phone:v('a-phone'),suite:sel.value,moveIn:v('a-move'),message:v('a-msg'),consent:true})
      .then(function(j){
        var token=j.token, i=0;
        function next(){ if(i>=files.length) return post({action:'finish',token:token});
          var it=files[i++]; say('Uploading file '+i+' of '+files.length+'\\u2026');
          return b64(it.file).then(function(data){ return post({action:'file',token:token,doc:it.doc,filename:it.file.name,data:data}); }).then(next); }
        return next();
      })
      .then(function(){ f.reset(); [].forEach.call(f.querySelectorAll('.field,.ap-consent'),function(el){ el.style.display='none'; }); btn.style.display='none';
        say('<b>Thank you! Your application is in.</b><br>We sent a confirmation to your email. The leasing team will review it and get back to you.'); st.scrollIntoView({block:'center'}); })
      .catch(function(err){ btn.disabled=false; btn.textContent='Submit application';
        say((err&&err.message&&!/fetch|network|JSON/i.test(err.message)?err.message+' ':'Sorry, the upload didn\\u2019t go through. ')+'Please try again, or email your documents to <a href="mailto:${esc(email)}">${esc(email)}</a>.',true); });
  });
})();
</script>
` + foot().replaceAll('href="#book"', 'href="/#contact"');

/* ---------- write everything ---------- */
fs.rmSync(path.join(ROOT, 'suites'), { recursive: true, force: true });   // removed suites disappear
for (const s of suites) write(`suites/${s.unit}/index.html`, suitePage(s));
write('suite-unavailable.html', unavailablePage());
fs.rmSync(path.join(ROOT, 'apply'), { recursive: true, force: true });
if (APPLY_ENDPOINT) write('apply/index.html', applyPage());

// home page: current suite data inline, plus plain links crawlers can follow
let index = read('index.html');
// same cleaned unit numbers as the suite pages, so the homepage cards link to pages that exist
const inline = JSON.stringify({ suites: (raw.suites || raw).map((s) => ({ ...s, unit: slug(s.unit) })).filter((s) => s.unit) }, null, 1).replace(/</g, '\\u003c');
index = index.replace(/(<script id="suiteData" type="application\/json">)[\s\S]*?(<\/script>)/, `$1\n${inline}\n$2`);
const links = suites.map((s) => `<a class="suite-link" href="suites/${s.unit}/">${esc(s.label)}, suite ${s.unit}: ${s.sqft} sq ft, ${money(s.price)}/month, ${whenLabel(s).replace(/^Available/, 'available')}</a>`).join('\n      ');
index = index.replace(/<!--suites:start-->[\s\S]*?<!--suites:end-->/, `<!--suites:start-->\n      ${links}\n      <!--suites:end-->`);
// "How to rent" step 2: upload button only once the leasing account's upload script exists
index = index.replace(/<!--apply:start-->[\s\S]*?<!--apply:end-->/, `<!--apply:start-->${APPLY_ENDPOINT
  ? '<p>Fill in the rental application, then upload it online with:</p><ul><li>Employment letter, tax documents, or proof of other income</li><li>Most recent Notice of Assessment if self-employed</li><li>Photo ID</li></ul><div class="step-btns"><a class="btn btn-line btn-sm" href="files/Caeedar-Rental-Application.pdf" download>Download application (PDF)</a><a class="btn btn-wine btn-sm" href="apply/">Apply now</a></div>'
  : '<p>Download the rental application and send it in with:</p><ul><li>Employment letter, tax documents, or proof of other income</li><li>Most recent Notice of Assessment if self-employed</li><li>Photo ID</li></ul><a class="btn btn-line btn-sm" href="files/Caeedar-Rental-Application.pdf" download>Download application (PDF)</a>'}<!--apply:end-->`);
write('index.html', index);

const day = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${day}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${suites.map((s) => `  <url>
    <loc>${SITE}/suites/${s.unit}/</loc>
    <lastmod>${day}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>
`);

console.log(`Built ${suites.length} suite pages: ${suites.map((s) => s.unit).join(', ') || 'none'}`);
