(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('page-data').textContent);
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  // Store attribution only. Never persist contact fields or messages.
  const {trackingKeys,attributionFor,matchesVehicle,inquiryFor} = window.FraminghamCore;
  const attributionKey = 'framingham-attribution-v1';
  let attribution = {};
  try { attribution = JSON.parse(sessionStorage.getItem(attributionKey) || '{}'); } catch { /* Storage may be blocked. */ }
  attribution = attributionFor(location.search,attribution,location.origin+location.pathname);
  try { sessionStorage.setItem(attributionKey, JSON.stringify(attribution)); } catch { /* Contact still works. */ }
  for (const link of $$('a[href]')) {
    // Same-page actions must not change the query string and reload form state.
    if (link.getAttribute('href').startsWith('#')) continue;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || !/^https?:$/.test(target.protocol)) continue;
    if (link.classList.contains('gallery-thumb') || link.classList.contains('gallery-open')) continue;
    for (const key of trackingKeys) if(attribution[key]) target.searchParams.set(key, attribution[key]);
    link.href = target.href;
  }
  const menu = $('.menu-toggle');
  const nav = $('#main-nav');
  menu?.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(expanded));
    menu.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
    nav.classList.toggle('open', expanded);
  });
  const closeMenu = () => { nav?.classList.remove('open'); menu?.setAttribute('aria-expanded','false'); menu?.setAttribute('aria-label','Open navigation'); };
  nav?.addEventListener('click', e => { if(e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMenu(); });
  const grid = $('#inventory-grid');
  if (grid) {
    const cards = [...grid.children];
    let filter = 'all';
    let limit = 6;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn-outline load-more';
    more.setAttribute('aria-controls','inventory-grid');
    grid.after(more);
    const update = () => {
      const sort = $('#sort').value;
      const sorted = [...cards].sort((a,b) => sort === 'featured' ? cards.indexOf(a)-cards.indexOf(b) : (Number(a.dataset.price)-Number(b.dataset.price))*(sort==='price-asc'?1:-1));
      let count = 0;
      for(const card of sorted) {
        const matches = matchesVehicle(card.dataset.category,Number(card.dataset.price),filter);
        if(matches) count++;
        card.hidden = !matches || count > limit;
        grid.append(card);
      }
      $('#empty-state').hidden = count !== 0;
      more.hidden = count <= limit;
      more.textContent = `View all ${count} classics`;
      $('#inventory-count').textContent = `Showing ${Math.min(count,limit)} of ${count} ${count===1?'vehicle':'vehicles'} in this view`;
    };
    $$('.filter-tab').forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.filter;
      limit = Infinity;
      $$('.filter-tab').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
      update();
    }));
    $('#sort').addEventListener('change',update);
    more.addEventListener('click',()=>{limit=Infinity;update();});
    update();
  }
  let activeImage = 0;
  const pictures = data.vehicle?.images || [];
  const dialog = $('#photo-dialog');
  const showImage = n => {
    activeImage = (n + pictures.length) % pictures.length;
    const pic = pictures[activeImage];
    const main = $('#main-vehicle-photo');
    main.src = pic.src;
    main.srcset = `${pic.small} 640w, ${pic.src} 1280w`;
    main.alt = pic.alt;
    $('#gallery-open').href = pic.src;
    $('#gallery-count').textContent = `${activeImage+1} / ${pictures.length} photos`;
    $$('.gallery-thumb').forEach((t,i)=>t.setAttribute('aria-current',String(i===activeImage)));
    $('#dialog-image').src = pic.src;
    $('#dialog-image').alt = pic.alt;
    $('#dialog-counter').textContent = `Photo ${activeImage+1} of ${pictures.length} · Use the arrow keys to browse`;
  };
  if(pictures.length && dialog) {
    $$('.gallery-thumb').forEach(thumb=>thumb.addEventListener('click',e=>{e.preventDefault();showImage(Number(thumb.dataset.image));}));
    $('#gallery-open').addEventListener('click',e=>{e.preventDefault();dialog.showModal();document.body.style.overflow='hidden';});
    $('.dialog-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{document.body.style.overflow='';$('#gallery-open').focus();});
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    $('.gallery-prev').addEventListener('click',()=>showImage(activeImage-1));
    $('.gallery-next').addEventListener('click',()=>showImage(activeImage+1));
    dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();showImage(activeImage+1);}if(e.key==='ArrowLeft'){e.preventDefault();showImage(activeImage-1);}});
    if(pictures.length===1){$('.gallery-prev').hidden=true;$('.gallery-next').hidden=true;}
  }
})();
