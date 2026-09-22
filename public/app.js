// Simple resume builder app.js
(function(){
  const form = document.getElementById('resumeForm');
  const preview = document.getElementById('resumePreview');
  const templatesGallery = document.getElementById('templatesGallery');
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');
  const logoutBtn = document.getElementById('logoutBtn');

  const API_BASE = 'http://localhost:4000';
  const themeSelect = document.getElementById('themeSelect');
  const templateSelect = document.getElementById('templateSelect');
  const exportPdfBtn = document.getElementById('exportPdf');
  const exportDocBtn = document.getElementById('exportDoc');
  const addSectionBtn = document.getElementById('addSection');
  const sectionsContainer = document.getElementById('sectionsContainer');
  const saveBtn = document.getElementById('saveResume');
  // savedList and deleteSaved removed from UI; guard their usage where needed
  const savedList = document.getElementById('savedList');
  const deleteSaved = document.getElementById('deleteSaved');

  // Utilities
  function qs(sel, root=document) { return root.querySelector(sel); }
  function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

  // initial setup: create one entry for each section
  function createEntry(sectionType, data){
    const div = document.createElement('div');
    div.className = 'entry';
    div.draggable = true;
    div.tabIndex = 0; // make entry focusable for keyboard operations
    if(sectionType==='education'){
      div.innerHTML = '<input name="school" placeholder="School / Institution" aria-label="School or Institution" />\n' +
                      '<input name="degree" placeholder="Degree / Major" aria-label="Degree or Major" />\n' +
                      '<div class="edu-dates"><input name="start" placeholder="Start (e.g., 2018)" aria-label="Start year" /><input name="end" placeholder="End (e.g., 2022 or Present)" aria-label="End year" /></div>' +
                      '<textarea name="desc" rows="2" placeholder="Description / coursework (optional)" aria-label="Education description"></textarea>';
    } else if(sectionType==='experience'){
      div.innerHTML = '<input name="company" placeholder="Company" /><input name="role" placeholder="Role" /><textarea name="desc" rows="3" placeholder="Responsibilities / achievements"></textarea>';
    } else if(sectionType==='skills'){
      div.innerHTML = '<input name="skill" placeholder="Skill (e.g., JavaScript)" />';
    } else if(sectionType==='certifications'){
      div.innerHTML = '<input name="cert" placeholder="Certification name" />';
    } else {
      div.innerHTML = '<input name="title" placeholder="Item title" /><textarea name="desc" rows="2" placeholder="Description"></textarea>';
    }
    if(data){
      qsa('input,textarea', div).forEach((el)=>{ el.value = data[el.name] || '' });
    }
    // allow removing entry
    const rem = document.createElement('button'); rem.type='button'; rem.textContent='Remove'; rem.className = 'btn btn-destructive remove-entry'; rem.addEventListener('click',()=>div.remove());
    div.appendChild(rem);

    // drag handlers for reordering entries
    div.addEventListener('dragstart', (e)=>{ window._dragged = div; div.classList.add('dragging'); e.dataTransfer?.setData('text/plain',''); });
    div.addEventListener('dragend', ()=>{ window._dragged = null; div.classList.remove('dragging'); });
    div.addEventListener('dragover', (e)=>{ e.preventDefault(); });
    div.addEventListener('drop', (e)=>{ e.preventDefault(); const src = window._dragged; if(!src || src === div) return; const parent = div.parentNode; parent.insertBefore(src, div); updatePreview(); announce('Entry moved'); });

    // keyboard reordering: Ctrl+ArrowUp / Ctrl+ArrowDown
    div.addEventListener('keydown', (e)=>{
      if(!(e.ctrlKey || e.metaKey)) return;
      if(e.key === 'ArrowUp'){
        const prev = div.previousElementSibling;
        if(prev) { div.parentNode.insertBefore(div, prev); updatePreview(); announce('Entry moved up'); prev.focus(); }
        e.preventDefault();
      } else if(e.key === 'ArrowDown'){
        const next = div.nextElementSibling;
        if(next) { div.parentNode.insertBefore(next, div); updatePreview(); announce('Entry moved down'); next.focus(); }
        e.preventDefault();
      }
    });
    return div;
  }

  function bindSectionControls(fieldset){
    const type = fieldset.dataset.type || 'custom';
    const addBtn = fieldset.querySelector('.addEntry');
    const entries = fieldset.querySelector('.entries');
    addBtn.addEventListener('click', ()=>{ entries.appendChild(createEntry(type)); updatePreview(); });
    // ensure at least one entry exists for better UX
    if(entries.children.length === 0){ entries.appendChild(createEntry(type)); }
    // attach accessible move buttons for each entry (delegated)
    entries.addEventListener('click', (e)=>{
      const btn = e.target.closest('.entry-action'); if(!btn) return;
      const entry = btn.closest('.entry'); if(!entry) return;
      if(btn.dataset.action === 'move-up'){ const prev = entry.previousElementSibling; if(prev) entry.parentNode.insertBefore(entry, prev); updatePreview(); announce('Entry moved up'); }
      if(btn.dataset.action === 'move-down'){ const next = entry.nextElementSibling; if(next) entry.parentNode.insertBefore(next, entry); updatePreview(); announce('Entry moved down'); }
    });
    // move up/down
    fieldset.querySelector('.moveUp').addEventListener('click', ()=>{
      const prev = fieldset.previousElementSibling;
      if(prev) fieldset.parentNode.insertBefore(fieldset, prev);
      updatePreview();
    });
    fieldset.querySelector('.moveDown').addEventListener('click', ()=>{
      const next = fieldset.nextElementSibling;
      if(next) fieldset.parentNode.insertBefore(next, fieldset);
      updatePreview();
    });
    fieldset.querySelector('.removeSection').addEventListener('click', ()=>{ fieldset.remove(); updatePreview(); });
  }

  qsa('.section').forEach(bindSectionControls);

  // add a custom section
  addSectionBtn.addEventListener('click', ()=>{
    const fs = document.createElement('fieldset');
    fs.className='section'; fs.dataset.type='custom';
    fs.innerHTML = `<legend contenteditable>Custom Section</legend><div class="entries"></div><div class="section-controls"><button type="button" class="btn btn-secondary addEntry">Add Item</button><button type="button" class="moveUp">Move Up</button><button type="button" class="moveDown">Move Down</button><button type="button" class="removeSection">Remove</button></div>`;
    sectionsContainer.appendChild(fs);
    bindSectionControls(fs);
    // auto-add one entry
    const entries = fs.querySelector('.entries'); if(entries.children.length===0) entries.appendChild(createEntry('custom'));
  });

  // form change -> preview
  form.addEventListener('input', updatePreview);
  templateSelect.addEventListener('change', ()=>{ preview.className = '' ; preview.classList.add('template-'+templateSelect.value); updatePreview(); });

  function collectForm(){
    const data = {};
    const fd = new FormData(form);
    for(const [k,v] of fd.entries()){
      // collect multiple entries with same name into arrays where relevant
      if(data[k]){
        if(Array.isArray(data[k])) data[k].push(v); else data[k] = [data[k], v];
      } else data[k] = v;
    }
    // collect section entries
    data.sections = [];
    qsa('#sectionsContainer .section').forEach(fs=>{
      const type = fs.dataset.type || 'custom';
      const title = fs.querySelector('legend').textContent || type;
      const items = [];
      qsa('.entries .entry', fs).forEach(e=>{
        const item = {};
        qsa('input,textarea', e).forEach(inp=> item[inp.name] = inp.value );
        items.push(item);
      });
      data.sections.push({type,title,items});
    });
    // contact fields
    data.contact = {
      name: form.elements['name']?.value || '',
      title: form.elements['title']?.value || '',
      email: form.elements['email']?.value || '',
      phone: form.elements['phone']?.value || '',
      website: form.elements['website']?.value || ''
    };
    data.summary = form.elements['summary']?.value || '';
    return data;
  }

  function updatePreview(){
    const data = collectForm();
    renderPreview(data);
  }

  // renderPreview accepts an optional target element (defaults to main preview)
  function renderPreview(data, target = preview){
    // build HTML for preview
    const parts = [];
    parts.push(`<div class="header"><div><div class="name">${escapeHtml(data.contact.name)}</div><div class="role">${escapeHtml(data.contact.title)}</div></div><div class="contact">${escapeHtml(data.contact.email)}<br/>${escapeHtml(data.contact.phone)}<br/>${escapeHtml(data.contact.website)}</div></div>`);
    if(data.summary){ parts.push(`<section class="summary"><h3>Summary</h3><p>${nl2br(escapeHtml(data.summary))}</p></section>`); }
    data.sections.forEach(sec=>{
      if(sec.items.length===0) return;
      parts.push(`<section class="sec"><h3>${escapeHtml(sec.title)}</h3>`);
      sec.items.forEach(it=>{
        if(sec.type==='education'){
          const dates = (it.start||'') + (it.end ? (' — '+it.end) : (it.start ? ' — Present' : ''));
          parts.push(`<div class="item"><div class="edu-head"><strong>${escapeHtml(it.degree||'')}</strong> — ${escapeHtml(it.school||'')}</div><div class="edu-dates">${escapeHtml(dates)}</div><div class="desc">${nl2br(escapeHtml(it.desc||''))}</div></div>`);
        } else if(sec.type==='experience'){
          parts.push(`<div class="item"><strong>${escapeHtml(it.role||'')}</strong> — ${escapeHtml(it.company||'')}<div class="desc">${nl2br(escapeHtml(it.desc||''))}</div></div>`);
        } else if(sec.type==='skills'){
          parts.push(`<div class="skill">${escapeHtml(it.skill||'')}</div>`);
        } else if(sec.type==='certifications'){
          parts.push(`<div class="item">${escapeHtml(it.cert||'')}</div>`);
        } else {
          parts.push(`<div class="item"><strong>${escapeHtml(it.title||'')}</strong><div class="desc">${nl2br(escapeHtml(it.desc||''))}</div></div>`);
        }
      });
      parts.push(`</section>`);
    });
    target.innerHTML = parts.join('\n');
    // announce preview update for screen readers
    announce('Preview updated');
  }

  // announce messages via aria-live region
  function announce(message){
    const live = document.getElementById('previewErrors') || document.createElement('div');
    if(live){
      live.classList.remove('visually-hidden');
      live.textContent = message;
      setTimeout(()=>{ live.textContent = ''; }, 1500);
    }
  }

  // show a small dismissible notice banner (non-blocking)
  function showNotice(text, timeout=4000){
    let container = document.getElementById('noticeContainer');
    if(!container){ container = document.createElement('div'); container.id = 'noticeContainer'; container.style.position='fixed'; container.style.top='16px'; container.style.right='16px'; container.style.zIndex='9999'; document.body.appendChild(container); }
    const el = document.createElement('div'); el.className='notice'; el.textContent = text; el.style.background='rgba(17,24,39,0.9)'; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.boxShadow='0 8px 30px rgba(2,6,23,0.2)'; el.style.marginTop='8px'; el.style.maxWidth='320px'; el.style.fontSize='13px';
    const close = document.createElement('button'); close.textContent='✕'; close.style.marginLeft='8px'; close.style.border='0'; close.style.background='transparent'; close.style.color='#fff'; close.style.cursor='pointer'; close.style.float='right'; close.addEventListener('click', ()=> el.remove());
    el.appendChild(close);
    container.appendChild(el);
    if(timeout>0) setTimeout(()=> el.remove(), timeout);
  }

  function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); }
  function nl2br(s){ return s.replace(/\n/g,'<br/>'); }

  // export to PDF using html2canvas + jsPDF
  exportPdfBtn.addEventListener('click', async ()=>{
    // validate before exporting
    if(!validateForm()){ return; }
    exportPdfBtn.disabled = true; exportPdfBtn.textContent = 'Rendering...';
    try{
      const node = preview;
      // render at a higher scale for quality
      const scale = 2;
      const canvas = await html2canvas(node, {scale});
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // convert canvas to image and slice into pages
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // px per pdf point
      const pxPerPt = imgWidth / pdfWidth;
      const pageHeightPx = Math.floor(pdfHeight * pxPerPt);

      let renderedHeight = 0;
      while(renderedHeight < imgHeight){
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = Math.min(pageHeightPx, imgHeight - renderedHeight);
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,pageCanvas.width,pageCanvas.height);
        ctx.drawImage(canvas, 0, renderedHeight, imgWidth, pageCanvas.height, 0, 0, imgWidth, pageCanvas.height);
        const pageData = pageCanvas.toDataURL('image/png');
        const w = pdfWidth;
        const h = (pageCanvas.height / pxPerPt);
        if(renderedHeight > 0) pdf.addPage();
        pdf.addImage(pageData, 'PNG', 0, 0, w, h);
        renderedHeight += pageCanvas.height;
      }
      pdf.save((document.querySelector('input[name="name"]').value || 'resume') + '.pdf');
    }catch(e){ alert('Export failed: '+e.message); }
    exportPdfBtn.disabled = false; exportPdfBtn.textContent = 'Export PDF';
  });

  // export to DOC (simple HTML-in-doc blob) — Word opens HTML documents saved with .doc
  // Export to true .docx using docx browser lib
  exportDocBtn.addEventListener('click', async ()=>{
    if(!validateForm()){ return; }
    try{
      if(!window.docx){
        // Try server-side .docx export first (better fidelity), then fallback to .doc if server unavailable
        const html = '<!doctype html><html><head><meta charset="utf-8"><title>Resume</title></head><body>' + preview.innerHTML + '</body></html>';
        const filename = (document.querySelector('input[name="name"]').value || 'resume');
        try{
          const resp = await fetch(API_BASE + '/api/export/docx', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ html, filename })
          });
          if(resp.ok){
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filename + '.docx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url),1500);
            showNotice('Exported .docx using server-side converter.');
            return;
          } else {
            // server returned error, fall back to .doc
            console.warn('Server-side .docx export failed', resp.status);
          }
        }catch(err){
          console.warn('Server-side .docx export unavailable', err.message||err);
        }
        // fallback: export as a Word-compatible HTML `.doc`
        try{
          const blob = new Blob([html], {type: 'application/msword'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = filename + '.doc'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1500);
          showNotice('DOCX library not available — exported a Word-compatible .doc file instead.');
          return;
        }catch(fb){
          throw new Error('docx library not loaded and fallback export failed: '+ (fb.message||fb));
        }
      }
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
      const doc = new Document();
      // mapper: walk preview DOM and convert to docx paragraphs
      const tmp = document.createElement('div'); tmp.innerHTML = preview.innerHTML;

      function inlineRunsFromNode(node){
        const runs = [];
        function collect(n){
          if(n.nodeType === Node.TEXT_NODE){
            const txt = n.textContent.replace(/\s+/g,' ');
            if(txt.trim()) runs.push(new TextRun({text: txt}));
          } else if(n.nodeType === Node.ELEMENT_NODE){
            const tag = n.tagName.toLowerCase();
            if(tag === 'strong' || tag === 'b') runs.push(new TextRun({text: n.textContent, bold:true}));
            else if(tag === 'em' || tag === 'i') runs.push(new TextRun({text: n.textContent, italics:true}));
            else if(tag === 'br') runs.push(new TextRun({text:'\n'}));
            else {
              n.childNodes.forEach(c=> collect(c));
            }
          }
        }
        node.childNodes.forEach(c=> collect(c));
        return runs;
      }

      const paragraphs = [];
      function walk(node){
        node.childNodes.forEach(n=>{
          if(n.nodeType === Node.TEXT_NODE){ const txt = n.textContent.trim(); if(txt) paragraphs.push(new Paragraph({children:[new TextRun({text: txt})]})); }
          else if(n.nodeType === Node.ELEMENT_NODE){
            const tag = n.tagName.toLowerCase();
            if(tag === 'h1' || n.classList.contains('name')){
              paragraphs.push(new Paragraph({text: n.textContent.trim(), heading: HeadingLevel.HEADING_1}));
            } else if(tag === 'h2'){
              paragraphs.push(new Paragraph({text: n.textContent.trim(), heading: HeadingLevel.HEADING_2}));
            } else if(tag === 'p' || tag === 'div' || tag === 'section' || tag === 'span'){
              const runs = inlineRunsFromNode(n);
              if(runs.length===0) paragraphs.push(new Paragraph(''));
              else paragraphs.push(new Paragraph({children: runs}));
            } else if(tag === 'ul' || tag === 'ol'){
              n.querySelectorAll('li').forEach(li=>{
                const runs = inlineRunsFromNode(li);
                paragraphs.push(new Paragraph({children: runs, bullet: {level: 0}}));
              });
            } else {
              walk(n);
            }
          }
        });
      }

      walk(tmp);
      // add all paragraphs in a single section for better document flow
      doc.addSection({children: paragraphs});

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = (document.querySelector('input[name="name"]').value || 'resume') + '.docx'; document.body.appendChild(a); a.click(); a.remove();
      // revoke after a short delay to ensure download started in some browsers
      setTimeout(()=> URL.revokeObjectURL(url), 1500);
    }catch(e){ alert('DOCX export failed: '+ (e.message||e)); }
  });

  // Load sample data for demo / quick preview

  const samplePresets = {
    generic: {
      contact:{name:'Alex Morgan', title:'Product Engineer', email:'alex.morgan@example.com', phone:'(555) 987-6543', website:'alexm.dev'},
      summary: 'Product-minded engineer with experience shipping polished web products, leading cross-functional teams, and mentoring junior engineers.',
      sections:[
        {type:'experience', title:'Work Experience', items:[{company:'TechLabs', role:'Senior Engineer', desc:'Led frontend team, built design system and improved time-to-market.'}]},
        {type:'education', title:'Education', items:[{school:'Tech University', degree:'BEng Computer Engineering'}]},
        {type:'skills', title:'Skills', items:[{skill:'JavaScript'},{skill:'TypeScript'},{skill:'React'}]},
        {type:'certifications', title:'Certifications', items:[{cert:'Certified Scrum Master'}]}
      ]
    },
    software: {
      contact:{name:'Jamie Chen', title:'Senior Software Engineer', email:'jamie.chen@example.com', phone:'(555) 222-3344', website:'jamiechen.dev'},
      summary: 'Senior software engineer focused on scalable backend systems, distributed architectures, and mentoring cross-functional teams.',
      sections:[
        {type:'experience', title:'Work Experience', items:[{company:'ScaleOps', role:'Senior Backend Engineer', desc:'Designed microservices and improved throughput by 4x; led migration to Kubernetes.'}]},
        {type:'projects', title:'Selected Projects', items:[{title:'Realtime API', desc:'Built a low-latency streaming API used by 100k+ clients.'}]},
        {type:'education', title:'Education', items:[{school:'State University', degree:'B.S. Computer Science'}]},
        {type:'skills', title:'Skills', items:[{skill:'Go'},{skill:'Kubernetes'},{skill:'Distributed Systems'}]}
      ]
    },
    design: {
      contact:{name:'Riley Park', title:'Product Designer', email:'riley.park@example.com', phone:'(555) 444-7788', website:'riley.design'},
      summary: 'Product designer with experience in user research, interaction design and building design systems that scale.',
      sections:[
        {type:'portfolio', title:'Portfolio', items:[{title:'E-Commerce Redesign', desc:'Led end-to-end redesign increasing conversion by 12%.'}]},
        {type:'experience', title:'Work Experience', items:[{company:'StudioOne', role:'Lead Designer', desc:'Built component library and led design reviews.'}]},
        {type:'skills', title:'Skills', items:[{skill:'Figma'},{skill:'UX Research'},{skill:'Prototyping'}]},
        {type:'education', title:'Education', items:[{school:'Design Institute', degree:'BA Graphic Design'}]}
      ]
    },
    sales: {
      contact:{name:'Taylor Brooks', title:'Account Executive', email:'taylor.brooks@example.com', phone:'(555) 555-9012', website:'taylorbrooks.com'},
      summary: 'Top-performing sales professional with a track record of exceeding quotas and building long-term client relationships.',
      sections:[
        {type:'experience', title:'Sales Experience', items:[{company:'FastGrowth', role:'Senior AE', desc:'Closed $3M ARR in 2024; managed enterprise accounts.'}]},
        {type:'achievements', title:'Achievements', items:[{title:'Top 1% quota attainment 2023', desc:''}]},
        {type:'skills', title:'Skills', items:[{skill:'Negotiation'},{skill:'CRM'},{skill:'Enterprise Sales'}]},
        {type:'education', title:'Education', items:[{school:'Business School', degree:'MBA'}]}
      ]
    },
    management: {
      contact:{name:'Morgan Lee', title:'Operations Manager', email:'morgan.lee@example.com', phone:'(555) 666-1234', website:'morganlee.co'},
      summary: 'Operations manager experienced in scaling teams, driving cross-functional alignment, and improving processes.',
      sections:[
        {type:'experience', title:'Leadership Experience', items:[{company:'OpsWorks', role:'Operations Manager', desc:'Scaled ops team from 5 to 25; introduced OKR process.'}]},
        {type:'skills', title:'Skills', items:[{skill:'Process Improvement'},{skill:'Cross-functional Leadership'},{skill:'OKRs'}]},
        {type:'education', title:'Education', items:[{school:'State University', degree:'B.A. Management'}]}
      ]
    }
  };

  const loadSampleBtn = document.getElementById('loadSample');
  const sampleSelect = document.getElementById('sampleSelect');
  if(loadSampleBtn){
    loadSampleBtn.addEventListener('click', ()=>{
      try{
        console.log('Load sample clicked');
        const key = (sampleSelect && sampleSelect.value) ? sampleSelect.value : 'generic';
        console.log('Selected sample key:', key);
        const sample = (typeof samplePresets !== 'undefined' && (samplePresets[key] || samplePresets.generic)) ? samplePresets[key] || samplePresets.generic : null;
        if(!sample){ throw new Error('Sample preset not found'); }
        populateForm(sample);
        // choose a reasonable template per preset
        templateSelect.value = key === 'design' ? 'modern' : (key === 'minimal' ? 'compact' : 'classic');
        preview.className = 'template-'+templateSelect.value;
        updatePreview();
        showNotice('Loaded sample: ' + key, 2500);
      }catch(err){
        console.error('Load sample failed', err);
        showNotice('Failed to load sample: '+ (err.message||err), 4000);
      }
    });
  }

  // Save/load using localStorage: disabled (Save button removed)

  // Form validation: check required fields and per-entry basic checks
  function validateForm(){
    const formEl = form;
    const invalids = [];
    // built-in validity for required and type=email
    if(!formEl.checkValidity()){
      // collect invalid inputs
      Array.from(formEl.elements).forEach(el=>{ if(el.willValidate && !el.checkValidity()){ invalids.push(el); el.classList.add('invalid'); } else if(el.classList){ el.classList.remove('invalid'); } });
    }
    // per-entry checks: ensure at least one experience or education entry has content
    const sections = qsa('#sectionsContainer .section');
    sections.forEach(sec=>{
      const items = qsa('.entries .entry', sec);
      items.forEach(item=>{
        const hasContent = qsa('input,textarea', item).some(i=>i.value && i.value.trim().length>0);
        if(!hasContent){ qsa('input,textarea', item).forEach(i=>i.classList.add('invalid')); }
      });
    });

    if(invalids.length>0){
      // focus first invalid
      invalids[0].focus();
      announce('Please fix errors in the form');
      return false;
    }
    // custom email format check
    const email = formEl.elements['email'];
    if(email && email.value){
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!re.test(email.value)){
        email.classList.add('invalid'); email.focus(); announce('Please enter a valid email address'); return false;
      }
    }
    // clear any previous invalid markers
    qsa('.invalid').forEach(el=>el.classList.remove('invalid'));
    return true;
  }
  function refreshSavedList(){
    const store = JSON.parse(localStorage.getItem('resumes')||'{}');
    savedList.innerHTML = '<option value="">Load saved...</option>';
    Object.keys(store).forEach(k=>{ const o = document.createElement('option'); o.value=k; o.textContent = k + ' (' + new Date(store[k].savedAt).toLocaleString() + ')'; savedList.appendChild(o); });
  }
  // saveBtn removed from DOM — no click handler attached
  savedList.addEventListener('change', ()=>{
    const k = savedList.value; if(!k) return;
    const store = JSON.parse(localStorage.getItem('resumes')||'{}');
    const rec = store[k]; if(!rec) return;
    // populate form from rec.data
    populateForm(rec.data);
    templateSelect.value = rec.template || 'classic';
    preview.className = 'template-'+templateSelect.value;
    updatePreview();
  });
  deleteSaved.addEventListener('click', ()=>{
    const k = savedList.value; if(!k) return alert('Choose saved item to delete');
    const store = JSON.parse(localStorage.getItem('resumes')||'{}');
    if(confirm('Delete "'+k+'"?')){ delete store[k]; localStorage.setItem('resumes', JSON.stringify(store)); refreshSavedList(); }
  });

  function populateForm(data){
    // baseline contact and summary
    ['name','title','email','phone','website'].forEach(n=>{ if(form.elements[n]) form.elements[n].value = data.contact?.[n] || ''; });
    if(form.elements['summary']) form.elements['summary'].value = data.summary || '';
    // clear sections container then rebuild
    sectionsContainer.innerHTML = '';
    data.sections.forEach(sec=>{
      const fs = document.createElement('fieldset'); fs.className='section'; fs.dataset.type = sec.type; fs.innerHTML = `<legend>${sec.title}</legend><div class="entries"></div><div class="section-controls"><button type="button" class="btn btn-secondary addEntry">Add</button><button type="button" class="moveUp">Move Up</button><button type="button" class="moveDown">Move Down</button><button type="button" class="removeSection">Remove</button></div>`;
      const ent = fs.querySelector('.entries');
      sec.items.forEach(it=> ent.appendChild(createEntry(sec.type, it)) );
      sectionsContainer.appendChild(fs);
      bindSectionControls(fs);
    });
  }

  // init
  refreshSavedList();
  updatePreview();

  // Palette selector removed per user request

  

  // --- New: templates gallery thumbnails and download ---
  function createTemplateThumb(template){
    const wrap = document.createElement('div'); wrap.className = 'template-thumb';
    const canvasWrap = document.createElement('div'); canvasWrap.className = 'thumb-canvas';
    const footer = document.createElement('div'); footer.className = 'thumb-footer';
    const label = document.createElement('div'); label.className='label'; label.textContent = template.charAt(0).toUpperCase() + template.slice(1);
    const downloadBtn = document.createElement('button'); downloadBtn.textContent='Download PNG'; downloadBtn.className = 'btn btn-secondary thumb-download';
    // render sample data into a cloned preview element inside thumb
    const temp = document.createElement('div'); temp.className = 'thumb-preview template-' + template;
    renderPreview(samplePresets.generic, temp);
    canvasWrap.appendChild(temp);
    footer.appendChild(label); footer.appendChild(downloadBtn);
    wrap.appendChild(canvasWrap); wrap.appendChild(footer);

    // clicking the thumb selects the template in main preview with sample data
    wrap.addEventListener('click', (e)=>{
      if(e.target === downloadBtn) return; // handled separately
      templateSelect.value = template; preview.className = 'template-'+template; populateForm(samplePresets.generic); updatePreview();
    });

    downloadBtn.addEventListener('click', async (ev)=>{
      ev.stopPropagation(); downloadBtn.disabled = true; downloadBtn.textContent = 'Rendering...';
      try{
        // use html2canvas on the temp preview element
        const node = temp;
        // ensure it's visible in DOM for html2canvas: append to body off-screen
        const holder = document.createElement('div'); holder.style.position='fixed'; holder.style.left='-9999px'; holder.style.top='-9999px'; holder.appendChild(node);
        document.body.appendChild(holder);
        const canvas = await html2canvas(node, {scale:2});
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a'); a.href = url; a.download = template + '-preview.png'; document.body.appendChild(a); a.click(); a.remove();
        holder.remove();
      }catch(err){ alert('Thumbnail export failed: '+err.message); }
      downloadBtn.disabled = false; downloadBtn.textContent = 'Download PNG';
    });

    return wrap;
  }

  // create thumbs for available templates
  ['classic','modern','compact'].forEach(t=>{ const th = createTemplateThumb(t); templatesGallery.appendChild(th); });

  // --- Auth helpers ---
  function setAuth(token, user){
    if(token) localStorage.setItem('authToken', token); else localStorage.removeItem('authToken');
    localStorage.setItem('authUser', JSON.stringify(user||null));
    updateAuthUI();
  }
  function getAuthToken(){
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || null;
  }
  function authFetch(url, opts={}){
    const token = getAuthToken();
    opts.headers = opts.headers || {};
    opts.headers['Content-Type'] = 'application/json';
    if(token) opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(API_BASE + url, opts).then(r=>r.json());
  }

  // Try to detect tokens that may have been stored under different keys
  function detectAuthFromStorage(){
    // if already have authToken, nothing to do
    if(getAuthToken()) return;
    const altKeys = ['authToken','token','accessToken','jwt','auth','authorization','AuthToken'];
    // 1) check localStorage
    for(const k of altKeys){ try{ const v = localStorage.getItem(k); if(v && ((v.split && v.split('.').length===3) || v.length>20)){ localStorage.setItem('authToken', v); console.info('Detected auth token from localStorage key', k); return; } }catch(e){} }
    // 2) check sessionStorage
    for(const k of altKeys){ try{ const v = sessionStorage.getItem(k); if(v && ((v.split && v.split('.').length===3) || v.length>20)){ try{ localStorage.setItem('authToken', v); }catch(e){} console.info('Detected auth token from sessionStorage key', k); return; } }catch(e){} }
    // 3) check cookies (simple parse)
    try{
      const cookies = document.cookie ? document.cookie.split(';').map(c=>c.trim()) : [];
      for(const pair of cookies){ const eq = pair.indexOf('='); if(eq<0) continue; const k = pair.substring(0,eq); const v = decodeURIComponent(pair.substring(eq+1)); if(altKeys.includes(k) && v){ if((v.split && v.split('.').length===3) || v.length>20){ try{ localStorage.setItem('authToken', v); }catch(e){} console.info('Detected auth token from cookie', k); return; } } }
    }catch(e){}
  }

  // Return where the auth token currently lives (without exposing the token)
  function getAuthSource(){
    const altKeys = ['authToken','token','accessToken','jwt','auth','authorization','AuthToken'];
    for(const k of altKeys){ try{ const v = localStorage.getItem(k); if(v) return {source:'localStorage', key:k, len: v.length}; }catch(e){} }
    for(const k of altKeys){ try{ const v = sessionStorage.getItem(k); if(v) return {source:'sessionStorage', key:k, len: v.length}; }catch(e){} }
    try{
      const cookies = document.cookie ? document.cookie.split(';').map(c=>c.trim()) : [];
      for(const pair of cookies){ const eq = pair.indexOf('='); if(eq<0) continue; const k = pair.substring(0,eq); const v = decodeURIComponent(pair.substring(eq+1)); if(altKeys.includes(k) && v) return {source:'cookie', key:k, len: v.length}; }
    }catch(e){}
    return {source:'none', key:null, len:0};
  }

  function updateAuthUI(){
    const token = getAuthToken();
    // prefer explicit authUser if available for display
    let user = null;
    try{ user = JSON.parse(localStorage.getItem('authUser') || 'null'); }catch(e){ user = null; }
    const userBadge = document.getElementById('userBadge');
    if(token || user){
      loginLink && (loginLink.style.display='none');
      registerLink && (registerLink.style.display='none');
      if(logoutBtn) logoutBtn.style.display='inline-block';
      if(userBadge){ userBadge.style.display='inline-block'; userBadge.textContent = user && user.name ? ('Signed in: ' + user.name) : 'Signed in'; }
    } else {
      loginLink && (loginLink.style.display='inline-block');
      registerLink && (registerLink.style.display='inline-block');
      if(logoutBtn) logoutBtn.style.display='none';
      if(userBadge){ userBadge.style.display='none'; userBadge.textContent = ''; }
    }
    // saved list UI removed; refreshSavedList is now a no-op when `savedList` is absent
    if(typeof refreshSavedList === 'function') refreshSavedList();

    // Debug badge removed — no UI update here.
  }

  // Authentication UI removed: logout handler disabled

  // Authentication UI and redirect removed — continue initializing app without forcing login
  // (Previously we detected tokens and redirected to auth page; that logic has been removed.)

  // sync auth state across tabs/windows: when `authToken` changes elsewhere, update UI
  window.addEventListener('storage', (e)=>{
    if(e.key === 'authToken' || e.key === 'authSync'){
      updateAuthUI();
      const tokenNow = getAuthToken();
      if(tokenNow) announce('Logged in (synced)'); else announce('Logged out (synced)');
    }
  });

  // --- Theme system (selector removed) ---
  // No built-in theme presets — keep applyTheme resilient in case a theme name is stored
  const _knownThemeClasses = ['theme-elegant','theme-minimal','theme-vibrant'];

  function applyTheme(name){
    // always remove any known theme classes
    _knownThemeClasses.forEach(c=> document.documentElement.classList.remove(c));
    // if a preset exists (unlikely now), apply its className
    const preset = (typeof themePresets !== 'undefined' && themePresets && themePresets[name]) ? themePresets[name] : null;
    if(preset && preset.className) document.documentElement.classList.add(preset.className);
    try{ if(name) localStorage.setItem('selectedTheme', name); }catch(e){}
    announce('Theme changed');
    updatePreview();
  }

  // initialize theme from localStorage if present
  try{
    const saved = localStorage.getItem('selectedTheme');
    if(saved) applyTheme(saved);
  }catch(e){ /* ignore */ }

  // Override saveCurrent to send to backend when authenticated
  async function saveCurrent(){
    if(!validateForm()) return;
    const token = getAuthToken();
    const data = collectForm();
    if(token){
      try{
        const res = await authFetch('/api/resumes', {method:'POST', body: JSON.stringify({data, template: templateSelect.value, name: (data.contact.name||'Resume')})});
        if(res && res.id){ alert('Saved to your account'); refreshSavedList(); return; }
        else alert(res.error || 'Save failed');
      }catch(e){ alert('Save failed: '+e.message); }
    } else {
      const name = prompt('Save name for this resume','My Resume');
      if(!name) return; let store = JSON.parse(localStorage.getItem('resumes')||'{}'); store[name] = {data, template: templateSelect.value, savedAt: new Date().toISOString()}; localStorage.setItem('resumes', JSON.stringify(store)); refreshSavedList();
    }
  }

  // refreshSavedList: if authenticated, load from server, otherwise from localStorage
  async function refreshSavedList(){
    // UI for saved list was removed — do nothing if element not present
    if(!savedList) return;
    const token = getAuthToken();
    savedList.innerHTML = '<option value="">Load saved...</option>';
    if(token){
      try{
        const items = await authFetch('/api/resumes');
        items.forEach(i=>{ const o=document.createElement('option'); o.value = i.id; o.textContent = i.name + ' ('+ new Date(i.createdAt).toLocaleString() +')'; savedList.appendChild(o); });
        return;
      }catch(e){ console.warn('Could not fetch remote resumes', e); }
    }
    const store = JSON.parse(localStorage.getItem('resumes')||'{}');
    Object.keys(store).forEach(k=>{ const o = document.createElement('option'); o.value=k; o.textContent = k + ' (' + new Date(store[k].savedAt).toLocaleString() + ')'; savedList.appendChild(o); });
  }

  // savedList UI removed; skip adding change handler if element missing
  if(savedList){
    savedList.addEventListener('change', async ()=>{
      const val = savedList.value; if(!val) return;
      const token = getAuthToken();
      if(token){
        try{ const recs = await authFetch('/api/resumes'); const rec = recs.find(r=>r.id===val); if(rec){ populateForm(rec.data); templateSelect.value = rec.template || 'classic'; preview.className = 'template-'+templateSelect.value; updatePreview(); } }
        catch(e){ alert('Failed to load resume'); }
      } else {
        const store = JSON.parse(localStorage.getItem('resumes')||'{}'); const rec = store[val]; if(rec){ populateForm(rec.data); templateSelect.value = rec.template || 'classic'; preview.className = 'template-'+templateSelect.value; updatePreview(); }
      }
    });
  }

})();
