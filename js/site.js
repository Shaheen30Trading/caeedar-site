(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOOK = 'https://calendar.app.google/uvTofgzo6mcxiUay5';

  /* header */
  var header=document.getElementById('top');
  var menuBtn=document.getElementById('menuBtn'), panel=document.getElementById('menuPanel');
  function setMenu(open){ document.body.classList.toggle('menu-open',open); menuBtn.setAttribute('aria-expanded',open); menuBtn.setAttribute('aria-label',open?'Close menu':'Open menu'); panel.setAttribute('aria-hidden',!open); }
  menuBtn.addEventListener('click',function(){ setMenu(!document.body.classList.contains('menu-open')); });
  panel.addEventListener('click',function(e){
    var a=e.target.closest('a'); if(!a) return;
    var hash=a.getAttribute('href');
    if(!hash || hash.charAt(0)!=='#'){ setMenu(false); return; }
    e.preventDefault();
    var target=document.querySelector(hash);
    setMenu(false);
    if(!target) return;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      var top=target.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({top:top, behavior: reduce?'auto':'smooth'});
      if(history.replaceState) history.replaceState(null,'',hash);
    }); });
  });
  addEventListener('keydown',function(e){ if(e.key==='Escape') setMenu(false); });
  function onScroll(){ header.classList.toggle('solid', scrollY>40); document.body.classList.toggle('show-bar', scrollY>420); }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();

  /* rotating hero captions */
  var rots=[].slice.call(document.querySelectorAll('.rot-item'));
  if(rots.length>1){ var ri=0;
    setInterval(function(){ rots[ri].classList.remove('is-on'); ri=(ri+1)%rots.length; rots[ri].classList.add('is-on'); }, 2600);
  }

  /* hero slideshow */
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  if(slides.length>1 && !reduce){ var si=0;
    var CAPS=['King Street, downtown Cobourg','Cobourg Harbour and the marina','Victoria Park Beach, Cobourg'];
    var cap=document.getElementById('shotCaption');
    // Seamless: the next slide starts fading in while the current clip is still moving,
    // so nothing ever freezes on a last frame or hard-cuts.
    var FADE=1400, timer=null;
    function go(){
      clearTimeout(timer);
      var prev=slides[si];
      prev.classList.remove('is-on');
      si=(si+1)%slides.length;
      show(si);
      // let the outgoing clip keep playing under the crossfade, then rest it
      var pv=prev.querySelector('video');
      if(pv) setTimeout(function(){ if(!prev.classList.contains('is-on')){ try{pv.pause();}catch(e){} } }, FADE+150);
    }
    var MAXPLAY=6.5;   // seconds of any clip before it hands off
    function schedule(v){
      var d=v.duration;
      if(d && isFinite(d)){
        var left=Math.max(1200, (Math.min(d, MAXPLAY) - v.currentTime)*1000 - FADE);
        clearTimeout(timer); timer=setTimeout(go, left);
      }
    }
    function show(i){
      var s=slides[i];
      var v=s.querySelector('video');
      var usable = v && getComputedStyle(v).display!=='none' && !v.error && v.networkState!==3;
      if(usable){
        try{ v.currentTime=0; }catch(e){}
        var p=v.play(); if(p&&p.catch) p.catch(function(){});
        clearTimeout(timer); timer=setTimeout(go, 5000);        // if the clip isn't ready, behave like a photo
        if(v.readyState>=2) schedule(v);
        else v.addEventListener('playing', function(){ if(slides[si]===s) schedule(v); }, {once:true});
      } else {
        clearTimeout(timer); timer=setTimeout(go, 5000);
      }
      s.classList.add('is-on');
      if(cap&&CAPS[i]) cap.textContent=CAPS[i];
    }
    show(0);
  }

  /* hero video: skip on reduced motion or save-data */
  var saveData = navigator.connection && navigator.connection.saveData;


  /* lazy videos */
  var lazy=[].slice.call(document.querySelectorAll('[data-lazyvideo]'));
  if(reduce || saveData){ lazy.forEach(function(v){ v.style.display='none'; }); }
  else if('IntersectionObserver' in window){
    var vio=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ var v=e.target; var s=v.querySelector('source[data-src]'); if(s){ s.src=s.dataset.src; s.removeAttribute('data-src'); v.load(); } var p=v.play(); if(p&&p.catch)p.catch(function(){}); vio.unobserve(v);} }); },{rootMargin:'200px'});
    lazy.forEach(function(v){ vio.observe(v); });
  }

  /* suites */
  var suites=normalize(JSON.parse(document.getElementById('suiteData').textContent));
  function normalize(raw){
    var arr = raw && raw.suites ? raw.suites : raw;
    return (arr||[]).map(function(s){
      var photos=(s.photos||[]).map(strip);
      return {unit:String(s.unit), type:s.type||typeFromLabel(s.label), label:s.label||labelFromType(s.type),
        sqft:+s.sqft||0, bath:+s.bath||1, price:+s.price||0,
        available: (s.availableNow || s.available==='now') ? 'now' : (s.availableDate||s.available||'now'),
        bf: !!(s.barrierFree || s.bf),
        plan: strip(s.plan) || ('img/plan-'+s.unit+'.jpg'),
        planThumb: strip(s.planThumb) || strip(s.plan) || ('img/plan-thumb-'+s.unit+'.jpg'),
        photos: photos};
    });
  }
  function strip(p){ return p ? String(p).replace(/^\//,'') : p; }
  var TYPES={studio:'Studio','1b':'1 Bedroom','1bd':'1 Bedroom + Den','2b':'2 Bedroom','2bd':'2 Bedroom + Den'};
  function labelFromType(t){ return TYPES[t]||'Suite'; }
  function typeFromLabel(l){ for(var k in TYPES){ if(TYPES[k]===l) return k; } return 'studio'; }
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function whenLabel(a){ if(a==='now') return 'Available now'; var d=new Date(a+'T12:00:00'); if(d<=new Date()) return 'Available now'; return months[d.getMonth()]+' '+d.getDate(); }
  function isNow(a){ return a==='now' || new Date(a+'T12:00:00')<=new Date(); }
  function monthKey(a){ return isNow(a)?'now':a.slice(0,7); }
  var types=[['all','All'],['studio','Studio'],['1b','1 bed'],['1bd','1 bed + den'],['2b','2 bed'],['2bd','2 bed + den']].filter(function(t){ return t[0]==='all' || suites.some(function(s){return s.type===t[0];}); });
  var fType='all', fBy='';
  function chips(el,list,cb){ el.innerHTML=list.map(function(t,i){ return '<button class="chip" data-v="'+t[0]+'" aria-pressed="'+(i===0)+'">'+t[1]+'</button>'; }).join(''); el.addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; [].forEach.call(el.children,function(c){c.setAttribute('aria-pressed','false');}); b.setAttribute('aria-pressed','true'); cb(b.dataset.v); render(); }); }
  chips(document.getElementById('typeChips'),types,function(v){fType=v;});
  // move-in date picker: readiness on or before the chosen day
  var moveBy=document.getElementById('moveBy'), moveByClear=document.getElementById('moveByClear');
  function readyOn(a){ return isNow(a) ? new Date(0) : new Date(a+'T12:00:00'); }
  function buildWhenChips(){
    if(!moveBy) return;
    var t=new Date(); t.setHours(12,0,0,0);
    moveBy.min=t.toISOString().slice(0,10);
    var latest=suites.reduce(function(m,s){ var d=readyOn(s.available); return d>m?d:m; }, t);
    var max=new Date(latest.getTime()); max.setFullYear(max.getFullYear()+1);
    moveBy.max=max.toISOString().slice(0,10);
  }
  buildWhenChips();
  if(moveBy){
    moveBy.addEventListener('change',function(){
      fBy=moveBy.value||'';
      moveBy.classList.toggle('has-date',!!fBy);
      if(moveByClear) moveByClear.hidden=!fBy;
      render();
    });
  }
  if(moveByClear){
    moveByClear.addEventListener('click',function(){
      moveBy.value=''; fBy=''; moveBy.classList.remove('has-date'); moveByClear.hidden=true; render(); moveBy.focus();
    });
  }
  var money=function(n){ return '$'+n.toLocaleString('en-CA'); };
  var list=document.getElementById('suiteList');
  function render(){
    var byDate = fBy ? new Date(fBy+'T12:00:00') : null;
    var rows=suites.filter(function(s){ return (fType==='all'||s.type===fType) && (!byDate || readyOn(s.available)<=byDate); })
      .sort(function(a,b){ var ak=isNow(a.available)?'0':a.available, bk=isNow(b.available)?'0':b.available; if(ak!==bk) return ak<bk?-1:1; return a.price-b.price; });
    list.innerHTML = rows.length ? rows.map(function(s){
      var TYPEPIC={studio:'img/int-open-plan.jpg?v=20260919','1b':'img/int-living-windows.jpg?v=20260919','1bd':'img/int-living-kitchen.jpg?v=20260919','2b':'img/int-island.jpg?v=20260919','2bd':'img/int-island.jpg?v=20260919'};
      var hasPhoto=s.photos.length>0, typePic=TYPEPIC[s.type], isType=!hasPhoto&&!!typePic;
      var img=hasPhoto?s.photos[0]:(typePic||s.planThumb);
      return '<article class="suite">'+
        '<button class="suite-media'+(hasPhoto||isType?'':' plan')+'" data-unit="'+s.unit+'" aria-label="View floor plan and photos for suite '+s.unit+'">'+
          '<img src="'+img+'" alt="'+(hasPhoto?'Photo of suite '+s.unit:(isType?'A '+s.label.toLowerCase()+' of the same layout at CAEEDAR':'Floor plan of suite '+s.unit))+'" loading="lazy">'+
          '<span class="when'+(isNow(s.available)?' now':'')+'">'+whenLabel(s.available)+'</span>'+
          '<span class="media-tag">'+(hasPhoto?(s.photos.length+' photos + floor plan'):(isType?'Similar suite \u00b7 view floor plan':'View floor plan'))+'</span>'+
        '</button>'+
        '<div class="suite-body">'+
          '<div class="suite-top"><h3>'+s.label+'</h3><span class="unitno">Suite '+s.unit+'</span></div>'+
          '<div class="meta"><span>'+s.sqft+' sq ft</span><span>'+s.bath+' bath</span>'+(s.bf?'<span class="bf">Barrier-free</span>':'')+'</div>'+
          '<div class="price-row"><div class="price">'+money(s.price)+' <small>/ month</small></div>'+
          '<div class="suite-actions"><a class="btn btn-wine btn-sm" href="'+BOOK+'" target="_blank" rel="noopener">Book</a></div></div>'+
        '</div></article>';
    }).join('') : '<div class="empty">'+(byDate?'Nothing is ready by '+byDate.toLocaleDateString('en-CA',{month:'long',day:'numeric',year:'numeric'})+'. Try a later date, or ':'No suites match right now. ')+'<a href="#contact">send us a message</a> and we\'ll let you know when one opens up.</div>';
  }
  render();
  function updateCounts(){
    var nowCount=suites.filter(function(s){return isNow(s.available);}).length;
    var ac=document.getElementById('availCount');
    if(ac) ac.textContent = 'Currently renting';
    var fp=document.getElementById('fromPrice');
    if(fp && suites.length) fp.textContent='From '+money(Math.min.apply(null,suites.map(function(s){return s.price;})));
  }
  updateCounts();

  fetch('data/contact.json',{cache:'no-store'}).then(function(r){ return r.ok?r.json():null; }).then(function(c){
    if(!c) return;
    if(c.bookingUrl){ BOOK=c.bookingUrl; document.querySelectorAll('[data-book]').forEach(function(a){ a.href=BOOK; }); render(); }
    if(c.phone){ var digits=c.phone.replace(/[^0-9]/g,''); var tel='+1'+digits.slice(-10);
      document.querySelectorAll('a[href^="tel:"]').forEach(function(a){ a.href=tel; if(/[0-9]{3}-[0-9]{3}-[0-9]{4}/.test(a.textContent)) a.textContent=a.textContent.replace(/[0-9]{3}-[0-9]{3}-[0-9]{4}/,c.phone); }); }
    if(c.email){ document.querySelectorAll('a[href^="mailto:"]').forEach(function(a){ a.href='mailto:'+c.email; if(a.textContent.indexOf('@')>-1) a.textContent=c.email; }); }
    var n=document.getElementById('notice');
    if(n && c.notice){ n.textContent=c.notice; n.style.display=''; }
  }).catch(function(){});

  fetch('data/suites.json',{cache:'no-store'}).then(function(r){ return r.ok?r.json():null; }).then(function(d){
    if(!d) return; var live=normalize(d); if(!live.length) return;
    suites=live; buildWhenChips(); render(); updateCounts();
  }).catch(function(){});

  /* modal gallery */
  var modal=document.getElementById('modal'), mImg=document.getElementById('mImg'), mThumbs=document.getElementById('mThumbs'), gal=[], gi=0, lastFocus=null;
  var galleries={
    suites:{title:'Inside the suites',sub:'Photos show a typical suite. Finishes may vary.',items:[['img/int-open-plan.jpg?v=20260919','Open-plan living'],['img/int-kitchen-detail.jpg?v=20260919','Kitchen'],['img/int-laundry.jpg?v=20260919','In-suite laundry'],['img/int-living-windows.jpg?v=20260919','Living room'],['img/int-bath.jpg?v=20260919','Bathroom'],['img/int-living-kitchen.jpg?v=20260919','Living and kitchen'],['img/int-island.jpg?v=20260919','Kitchen island']]},
    building:{title:'Around the building',sub:'325 University Ave W, Cobourg',items:[['img/ext-frontage.jpg?v=20260919','University Ave W frontage'],['img/aerial-corner.jpg?v=20260919','The corner of the building'],['img/ext-entrance.jpg?v=20260919','Main entrance'],['img/ext-sign.jpg?v=20260919','325 University Ave W'],['img/ext-breezeway.jpg?v=20260919','Breezeway to the courtyard'],['img/aerial-garden.jpg?v=20260919','Landscaping along the walkway'],['img/ext-trees.jpg?v=20260919','Lawn and young trees along the sidewalk'],['img/aerial-parking.jpg?v=20260919','Surface parking'],['img/ext-ev.jpg?v=20260919','EV charging'],['img/amenity-lounge.jpg?v=20260919','Resident lounge'],['img/amenity-wide.jpg?v=20260919','Resident lounge, wide view'],['img/amenity-kitchen.jpg?v=20260919','Lounge kitchen']]}
  };
  function openGal(title,sub,items,start,showBook){
    gal=items; gi=start||0; lastFocus=document.activeElement;
    document.getElementById('mTitle').textContent=title; document.getElementById('mSub').textContent=sub;
    document.getElementById('mBook').style.display=showBook?'':'none';
    mThumbs.innerHTML=items.map(function(it,i){ return '<button aria-label="'+it[1]+'"><img src="'+it[0]+'" alt=""></button>'; }).join('');
    show(gi); modal.classList.add('open'); document.body.style.overflow='hidden'; document.body.classList.add('modal-open'); document.getElementById('mClose').focus();
  }
  function show(i){ gi=(i+gal.length)%gal.length; mImg.src=gal[gi][0]; mImg.alt=gal[gi][1]; [].forEach.call(mThumbs.children,function(b,k){ b.setAttribute('aria-current',k===gi?'true':'false'); }); var multi=gal.length>1; document.getElementById('mPrev').style.display=document.getElementById('mNext').style.display=multi?'':'none'; }
  function close(){ modal.classList.remove('open'); document.body.style.overflow=''; document.body.classList.remove('modal-open'); if(lastFocus) lastFocus.focus(); }
  mThumbs.addEventListener('click',function(e){ var b=e.target.closest('button'); if(b) show([].indexOf.call(mThumbs.children,b)); });
  document.getElementById('mPrev').onclick=function(){show(gi-1)}; document.getElementById('mNext').onclick=function(){show(gi+1)};
  document.getElementById('mClose').onclick=close;
  modal.addEventListener('click',function(e){ if(e.target===modal) close(); });
  addEventListener('keydown',function(e){ if(!modal.classList.contains('open'))return; if(e.key==='Escape')close(); if(e.key==='ArrowLeft')show(gi-1); if(e.key==='ArrowRight')show(gi+1); });
  list.addEventListener('click',function(e){ var b=e.target.closest('.suite-media'); if(!b)return; var s=suites.filter(function(x){return x.unit===b.dataset.unit;})[0];
    var planItems=[[s.planThumb,'Floor plan']];
    if(s.plan && s.plan!==s.planThumb) planItems.push([s.plan,'Floor plan with location in the building']);
    var items=s.photos.map(function(p,i){return [p,'Photo '+(i+1)];}).concat(planItems);
    openGal(s.label+', Suite '+s.unit, s.sqft+' sq ft, '+s.bath+' bath, '+money(s.price)+'/month, '+whenLabel(s.available), items, 0, true); });
  document.querySelectorAll('[data-gal]').forEach(function(f){ f.addEventListener('click',function(){ var g=galleries[f.dataset.gal]; openGal(g.title,g.sub,g.items,+f.dataset.i,false); }); });

  /* reveal */
  if('IntersectionObserver' in window && !reduce){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }); },{threshold:.12});
    document.querySelectorAll('.reveal,.acro').forEach(function(el){io.observe(el);});
  } else { document.querySelectorAll('.reveal,.acro').forEach(function(el){el.classList.add('in');}); }

  /* admin login opens in its own window */
  var adminLink=document.getElementById('adminLink');
  if(adminLink){ adminLink.addEventListener('click',function(e){
    var w=Math.min(1280, screen.availWidth-80), hgt=Math.min(880, screen.availHeight-80);
    var win=window.open('/admin/','caeedarAdmin','width='+w+',height='+hgt+',left='+Math.max(0,(screen.availWidth-w)/2)+',top='+Math.max(0,(screen.availHeight-hgt)/2)+',resizable=yes,scrollbars=yes');
    if(win){ e.preventDefault(); win.focus(); }
  }); }

  /* form (Netlify Forms via fetch) */
  var form=document.getElementById('inquiryForm');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=form.querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Sending...';
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString()})
      .then(function(r){ if(!r.ok) throw 0; document.getElementById('thanks').style.display='block'; form.reset(); btn.textContent='Sent'; })
      .catch(function(){ var t=document.getElementById('thanks'); t.style.display='block'; t.innerHTML='Sorry, that didn\'t send. Please email <a href="mailto:leasing@livingincobourg.ca">leasing@livingincobourg.ca</a> or call 416-515-9191.'; btn.disabled=false; btn.textContent='Send message'; });
  });

  // building photo scroller
  (function(){
    var sc=document.getElementById('bldgScroller'); if(!sc) return;
    var btns=document.querySelectorAll('.gnav');
    function step(){ var f=sc.querySelector('figure'); return f? f.offsetWidth+16 : 320; }
    function sync(){
      var pad=sc.firstElementChild? sc.firstElementChild.offsetLeft : 0;
      var max=sc.scrollWidth-sc.clientWidth-2;
      btns.forEach(function(b){
        if(b.dataset.scroll==='prev') b.disabled = sc.scrollLeft<=pad+2;
        else b.disabled = sc.scrollLeft>=max;
      });
    }
    btns.forEach(function(b){ b.addEventListener('click',function(){
      sc.scrollBy({left:(b.dataset.scroll==='next'?1:-1)*step()*2, behavior:'smooth'});
    }); });
    sc.addEventListener('scroll',sync,{passive:true});
    window.addEventListener('resize',sync);
    sync();
  })();

})();
