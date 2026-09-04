(function(root,factory){if(typeof module==='object'&&module.exports){module.exports=factory();}else{root.FraminghamCore=factory();}})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const trackingKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'];
  function attributionFor(search,previous,landingUrl){
    const params=new URLSearchParams(search);
    const incoming=trackingKeys.some(k=>params.has(k));
    const old=previous&&typeof previous==='object'&&!Array.isArray(previous)?previous:{};
    const next={};
    if(!incoming) for(const key of [...trackingKeys,'landing_url']) if(typeof old[key]==='string')next[key]=old[key].slice(0,500);
    if(incoming)next.landing_url=landingUrl;
    for(const key of trackingKeys)if(params.has(key))next[key]=params.get(key).slice(0,500);
    return next;
  }
  function matchesVehicle(body,price,filter){
    const kind=String(body).toLowerCase();
    return filter==='all'||filter==='convertible'&&kind==='convertible'||filter==='truck'&&kind==='truck'||filter==='muscle'&&['coupe','hardtop','fastback'].includes(kind)||filter==='budget'&&typeof price==='number'&&price<30000;
  }
  function normalizePhone(value){
    const raw=String(value||'').trim();
    if(!raw||/[^\d\s()+.\-]/.test(raw))return null;
    let digits=raw.replace(/\D/g,'');
    if(raw.startsWith('00'))digits=digits.slice(2);
    if(raw.startsWith('+')||raw.startsWith('00')){
      if(digits.length<8||digits.length>15||digits.startsWith('0')||(digits.startsWith('1')&&digits.length!==11))return null;
      return '+'+digits;
    }
    if(digits.length===10)return '+1'+digits;
    if(digits.length===11&&digits.startsWith('1'))return '+'+digits;
    return null;
  }
  function inquiryFor(vehicle,fields,attribution,origin){
    const reason={availability:'Availability inquiry',questions:'Vehicle details question',visit:'Visit request',delivery:'Delivery question'}[fields.request]||'Vehicle inquiry';
    const subject=`${reason}: ${vehicle.title} — ${vehicle.stock||'stock to confirm'}`;
    const price=vehicle.price==null?'Please confirm':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(vehicle.price);
    const safeAttribution=attributionFor('',attribution,'');
    const message=[`Hello Framingham Classic Autos,`,'',`${reason} for ${vehicle.title}.`,`Stock: ${vehicle.stock||'Please confirm'}`,`Listed price: ${price}`,'',`Name: ${String(fields.name||'').trim()}`,`Email: ${String(fields.email||'').trim()}`,`Phone: ${String(fields.phone||'').trim()||'Not provided'}`,'',String(fields.message||'').trim()||'Please contact me about this vehicle.','',`Vehicle page: ${origin}/cars/${vehicle.id}/`,...Object.entries(safeAttribution).map(([k,v])=>`${k}: ${v}`)].join('\n');
    return {subject,message};
  }
  return {trackingKeys,attributionFor,matchesVehicle,normalizePhone,inquiryFor};
});
