(() => {
  'use strict';
  const data=JSON.parse(document.getElementById('page-data').textContent);
  const forms=[...document.querySelectorAll('[data-inquiry-form]')];
  const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  let attribution={};try{attribution=JSON.parse(sessionStorage.getItem('framingham-attribution-v1')||'{}');}catch{/* Storage is optional. */}
  const vehicleFor=form=>data.inventory.find(v=>v.id===form.elements.vehicle.value);
  const contextFor=form=>{
    const v=vehicleFor(form),box=form.querySelector('[data-inquiry-context]');box.replaceChildren();
    const details=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('span');
    title.textContent=v?v.title:'Choose the classic you want to discuss.';meta.textContent=v?`${v.stock} · ${currency(v.price)}`:'Your request stays with the exact listing.';
    if(v){const img=document.createElement('img');img.src=v.images[0].small;img.alt=v.title;img.width=100;img.height=70;box.append(img);}details.append(title,meta);box.append(details);
  };
  const fieldError=field=>{
    if(field.type==='checkbox'&&field.required&&!field.checked)return 'Please agree to be contacted about this request.';
    if(field.required&&!field.value.trim())return ({vehicle:'Please choose a vehicle.',name:'Please enter your name.',lastName:'Please enter your last name.',phone:'Please enter your phone number.',email:'Please enter your email address.',message:'Please enter your question.'})[field.name]||'Please complete this field.';
    if(field.name==='phone'&&!window.FraminghamCore.normalizePhone(field.value))return 'Enter a 10-digit US/Canada number, or include + and your country code.';
    if(field.validity.typeMismatch)return 'Please enter a valid email address.';
    if(!field.validity.valid)return 'Please check this field.';
    return '';
  };
  function feedback(field,message){
    let error=document.getElementById(field.id+'-error');
    if(!error){error=document.createElement('p');error.id=field.id+'-error';error.className='field-error';(field.type==='checkbox'?field.closest('.field'):field.name==='phone'?field.closest('.phone-input'):field).insertAdjacentElement(field.type==='checkbox'?'beforeend':'afterend',error);}
    error.textContent=message;error.hidden=!message;
    const hint=field.name==='phone'?field.id+'-hint':'';
    if(message){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',[hint,error.id].filter(Boolean).join(' '));}else{field.removeAttribute('aria-invalid');if(hint)field.setAttribute('aria-describedby',hint);else field.removeAttribute('aria-describedby');}
  }
  function validate(form){let first;for(const field of form.querySelectorAll('input[required],select[required],textarea[required]')){const error=fieldError(field);feedback(field,error);if(error&&!first)first=field;}if(first){first.focus();first.scrollIntoView({block:'center',behavior:'instant'});return false;}return true;}
  function statusFor(form,message,state){const status=form.querySelector('.form-status');status.className='form-status '+state;status.textContent=message;return status;}
  function draftFor(form,vehicle,fields){
    const request={...fields,name:[fields.name,fields.lastName].filter(Boolean).join(' '),request:fields.request||'question',message:[fields.message,fields.purchaseMethod?'Purchase preference: '+fields.purchaseMethod:'',fields.deliveryNeeded?'Delivery may be needed.':'', 'Contact consent: '+(fields.contactConsent?'yes':'no')].filter(Boolean).join('\n')};
    return window.FraminghamCore.inquiryFor(vehicle,request,attribution,location.origin);
  }
  const delivered=new Map();
  for(const form of forms){
    form.noValidate=true;contextFor(form);
    const phone=form.elements.phone;
    const showPrefix=()=>{phone.closest('.phone-input').querySelector('.phone-prefix').hidden=/^(\+|00)/.test(phone.value.trim());};
    phone.addEventListener('input',showPrefix);phone.addEventListener('change',showPrefix);showPrefix();
    form.elements.vehicle.addEventListener('change',()=>contextFor(form));
    for(const field of form.querySelectorAll('[required]'))for(const event of ['input','change'])field.addEventListener(event,()=>{if(field.hasAttribute('aria-invalid'))feedback(field,fieldError(field));});
    const fallback=form.querySelector('.email-fallback');
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(form.dataset.submitting==='true')return;
      if(!validate(form)){statusFor(form,'Please check the highlighted fields.','error');return;}
      const fields=Object.fromEntries(new FormData(form)),vehicle=vehicleFor(form);if(!vehicle)return;
      fields.phone=window.FraminghamCore.normalizePhone(fields.phone);
      const {subject,message}=draftFor(form,vehicle,fields);
      const key=JSON.stringify([form.dataset.formKind,vehicle.id,fields.name,fields.lastName,fields.phone,fields.email,fields.message,fields.request,fields.purchaseMethod,fields.deliveryNeeded]);
      if(delivered.has(key)&&Date.now()-delivered.get(key)<5000){statusFor(form,'Your request has already been sent. Please allow us time to respond.','success');return;}
      const button=form.querySelector('[type=submit]');
      if(data.leadMode==='endpoint'&&data.leadEndpoint){
        form.dataset.submitting='true';button.disabled=true;fallback.hidden=true;statusFor(form,'Sending your request…','pending');
        try{
          const payload={type:form.dataset.formKind==='chat'?'chat-question':'vehicle-inquiry',dealerId:data.dealerId,dealerName:data.dealer,landingId:data.dealerId,vehicle:vehicle.title,vehicleSlug:vehicle.id,vehicleStock:vehicle.stock,vehiclePrice:vehicle.price,name:[fields.name,fields.lastName].filter(Boolean).join(' '),firstName:fields.name,lastName:fields.lastName||'',email:fields.email.trim(),phone:fields.phone.trim(),message,requestType:form.elements.request?.selectedOptions[0].textContent||'Question about this vehicle',purchaseMethod:fields.purchaseMethod||'',deliveryNeeded:Boolean(fields.deliveryNeeded),contactConsent:Boolean(fields.contactConsent),website:fields.website||'',leadId:crypto.randomUUID(),pageUrl:location.origin+'/cars/'+vehicle.id+'/',attribution};
          const response=await fetch(data.leadEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});const result=await response.json();
          if(!response.ok||result.ok!==true||!Number.isInteger(result.telegramMessageId))throw new Error('Delivery not confirmed');
          delivered.set(key,Date.now());statusFor(form,'Thank you! Your request has been sent. Please expect a call from the dealer shortly.','success').focus();return;
        }catch{statusFor(form,'We could not confirm delivery. Your details are still here. Please try again, call either sales line, or email us.','error');}
        finally{delete form.dataset.submitting;button.disabled=false;}
      }else statusFor(form,'Online requests are temporarily unavailable. No request was sent. Please call either sales line or email us.','error');
      fallback.querySelector('[data-email-preview]').value=message;
      fallback.querySelector('[data-open-email]').href=`mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      fallback.hidden=false;
    });
    form.querySelector('[data-copy-inquiry]').addEventListener('click',async()=>{const preview=fallback.querySelector('[data-email-preview]');try{await navigator.clipboard.writeText(preview.value);statusFor(form,'Inquiry copied. Paste it into an email to '+data.email+'.','preview');}catch{preview.focus();preview.select();statusFor(form,'Select and copy the message, then paste it into your email.','preview');}});
  }
  const main=document.getElementById('inquiry-form');
  for(const button of document.querySelectorAll('[data-request]'))button.addEventListener('click',()=>{if(!main)return;main.elements.request.value=button.dataset.request;if(data.vehicle)main.elements.vehicle.value=data.vehicle.id;contextFor(main);});
  const panel=document.getElementById('chat-panel'),chat=document.getElementById('chat-form');let opener=null,previousOverflow='';
  for(const button of document.querySelectorAll('[data-chat-open]'))button.addEventListener('click',()=>{opener=button;const selected=main?.elements.vehicle.value||data.vehicle?.id;if(selected)chat.elements.vehicle.value=selected;contextFor(chat);previousOverflow=document.body.style.overflow;panel.showModal();document.body.style.overflow='hidden';document.documentElement.classList.add('question-open');});
  panel.querySelector('[data-chat-close]').addEventListener('click',()=>panel.close());
  panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close();}});
  panel.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;document.documentElement.classList.remove('question-open');opener?.focus();});
})();
