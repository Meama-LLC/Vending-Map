'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const CHANNELS = [
  { id: 'vending', label: 'Vending', color: '#4A9EFF', table: 'vending_orders', itemsTable: 'vending_order_items', regionField: null, defaultRegion: 'Tbilisi' },
  { id: 'b2b', label: 'B2B', color: '#A855F7', table: 'b2b_orders', itemsTable: 'b2b_order_items', regionField: 'shipping_city', defaultRegion: 'B2B' },
  { id: 'b2c', label: 'B2C', color: '#FF8C42', table: 'orders', itemsTable: 'order_items', regionField: 'shipping_city', defaultRegion: 'Georgia' },
  { id: 'franchise', label: 'Franchise', color: '#C084FC', table: 'franchise_orders', itemsTable: 'franchise_order_items', regionField: 'shipping_city', defaultRegion: 'Franchise' },
  { id: 'ecommerce', label: 'eCommerce', color: '#1DB8A0', table: 'meama_collect_orders', itemsTable: 'meama_collect_order_items', regionField: null, defaultRegion: 'Online' },
];
const PARTICLE_COLORS = ['#A855F7','#C084FC','#E9D5FF','#7C3AED','#DDD6FE','#F0ABFC','#D946EF','#818CF8','#6366F1','#FFFFFF'];
const REV_MULT = 3;

// ── REAL MEAMA COLLECT PRODUCTS & PRICES ─────
const FAKE_PRODUCTS = [
  {name:'Espresso',p:4.00,w:18},{name:'Americano (8oz)',p:3.90,w:20},{name:'Americano',p:6.50,w:16},
  {name:'Cappuccino',p:7.00,w:18},{name:'Latte',p:7.00,w:16},{name:'Lungo',p:4.50,w:14},
  {name:'Flat White',p:7.50,w:12},{name:'Hot Chocolate',p:7.50,w:8},{name:'Tea',p:4.50,w:14},
  {name:'Caramel Hot Macchiato',p:7.90,w:10},{name:'Salted Pistachio Latte',p:8.50,w:8},
  {name:'Cream Coffee',p:4.50,w:12},{name:'Strawberry Latte',p:8.90,w:7},
  {name:'Cinnamon Mocha',p:9.90,w:6},{name:'Matcha Latte',p:8.90,w:8},{name:'Hot Acai Latte',p:9.50,w:5},
  {name:'Biscolako',p:10.50,w:7},{name:'Espresso & Tonic',p:9.50,w:8},
  {name:'Salted Pistachio Iced Latte',p:8.50,w:7},{name:'Strawberry Iced Latte',p:8.90,w:8},
  {name:'Caramel & Banana Frappe',p:10.90,w:6},{name:'Chocolate Frappe',p:10.90,w:6},
  {name:'Cappuccino Choco & Vanilla',p:9.50,w:7},{name:'Iced Americano',p:7.90,w:12},
  {name:'Iced Caramel Macchiato',p:9.90,w:8},{name:'Iced Latte',p:8.90,w:10},
  {name:'Iced Mocha',p:9.90,w:7},{name:'Iced Flat White Almond',p:8.50,w:6},
  {name:'Iced Coffee with Ice Cream',p:8.50,w:7},{name:'Frappe Cappuccino',p:8.00,w:6},
  {name:'Capsule Burgundy 09',p:15.00,w:5},{name:'Capsule Hazelnut',p:16.50,w:5},
  {name:'Capsule Purple 08',p:15.00,w:5},{name:'Capsule Caramel',p:16.50,w:5},
  {name:'Capsule Green 07',p:18.00,w:4},{name:'Capsule Vanilla',p:18.00,w:4},
  {name:'Capsule Blue 05',p:15.00,w:5},{name:'Capsule Yellow 04',p:15.00,w:5},
  {name:'Capsule Red 06',p:15.00,w:6},{name:'Capsule Decaf',p:15.00,w:3},
  {name:'Capsule Coconut',p:16.50,w:4},{name:'Capsule Bulldog',p:15.00,w:5},
  {name:'Capsule Blueberry Biscuit',p:16.50,w:4},
  {name:'Capsule Hazelnut Chocolate',p:16.50,w:4},
  {name:'Multi Hazelnut',p:19.80,w:4},{name:'Multi Arabica 08',p:18.00,w:4},
  {name:'Multi Guatemala 07',p:18.00,w:3},{name:'Multi Ethiopia 05',p:18.00,w:4},
  {name:'Multi Caramel',p:19.80,w:4},{name:'Multi Vanilla',p:19.80,w:3},
  {name:'Multi Coffee Latte',p:19.80,w:3},{name:'Multi Decaf',p:18.00,w:2},
  {name:'Multi Colombia 03',p:18.00,w:3},{name:'Multi El Salvador 04',p:18.00,w:3},
  {name:'Multi Bulldog',p:19.80,w:4},{name:'Multi Berry Frollo',p:19.80,w:3},
  {name:'Multi Irish Coffee',p:19.80,w:3},{name:'Multi Collagen Coffee',p:19.80,w:2},
  {name:'Multi Multivitamin',p:19.80,w:2},{name:'Multi Coconut',p:19.80,w:3},
  {name:'Multi Hazelnut Chocolate',p:19.80,w:3},
];

const FAKE_NAMES = [
  'Giorgi Maisuradze','Nino Kapanadze','Luka Tskhvediani','Mariam Svanidze','Davit Beridze',
  'Tamar Gelashvili','Nika Rurua','Ana Dolidze','Sandro Lomidze','Elene Vashakidze',
  'Irakli Chichua','Keti Papava','Levan Janelidze','Maia Avaliani','Zurab Nadiradze',
  'Nato Futkaradze','Beka Kharebava','Salome Zhvania','Giga Otarashvili','Teona Imedashvili',
  'Tornike Mchedlishvili','Nana Bregvadze','Lado Gurgenidze','Sopho Khalvashi',
  'Mikheil Darchiashvili','Khatia Rostomashvili','Vakhtang Tabidze','Tinatin Skhirtladze',
  'Guram Pataridze','Rusudan Lortkipanidze','Nikoloz Abuladze','Medea Chkhaidze',
  'Archil Varsimashvili','Tamuna Jikia','Paata Natroshvili','Ekaterine Findikli',
  'Shota Basilashvili','Manana Khomeriki','Otar Mumladze','Lali Devdariani',
  'Zviad Gaprindashvili','Nestan Tsanava','Kakha Razmadze','Darejan Salukvadze',
  'Revaz Lagvilava','Tsira Amashukeli','Mamuka Pkhaladze','Ia Chkheidze',
  'Zaza Korinteli','Nato Merabishvili','Giorgi Shengelia','Nino Metreveli',
  'Dato Turashvili','Ana Gogsadze','Saba Lobzhanidze','Eka Japaridze',
  'Temur Babluani','Mari Bekauri','Gio Kvaratskhelia','Tata Kipshidze',
];
const FAKE_LOCS = [
  'Tbilisi – Vake','Tbilisi – Saburtalo','Tbilisi – Didube','Tbilisi – Gldani',
  'Tbilisi – Isani','Tbilisi – Marjanishvili','Tbilisi – Vera','Tbilisi – Dighomi',
  'Tbilisi – Ortachala','Tbilisi – Avlabari','Tbilisi – Samgori','Tbilisi – Mtatsminda',
  'Batumi – Centre','Batumi – Boulevard','Rustavi','Kutaisi','Gori','Zugdidi',
  'East Point Mall','City Mall','Tbilisi Mall','Galleria Tbilisi',
];

const rand = (a, b) => Math.random() * (b - a) + a;
const randI = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmtI = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k ₾' : Math.round(n) + ' ₾';
const ts = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function wPick(arr) {
  const tot = arr.reduce((s, p) => s + (p.w || 1), 0);
  let r = Math.random() * tot;
  for (const p of arr) { r -= (p.w || 1); if (r <= 0) return p; }
  return arr[0];
}

function genFakeTx() {
  const ch = pick(CHANNELS.filter(c => c.id !== 'b2b'));
  const prod = wPick(FAKE_PRODUCTS);
  const isCapsule = prod.p >= 15;
  let qty = 1;
  if (!isCapsule) {
    const roll = Math.random();
    if (roll > 0.95) qty = 3;
    else if (roll > 0.75) qty = 2;
  }
  const amount = parseFloat((prod.p * qty).toFixed(2));
  const displayName = qty > 1 ? prod.name + ' x' + qty : prod.name;
  return { ch, prod: displayName, qty, amount, loc: pick(FAKE_LOCS), customer: pick(FAKE_NAMES), time: ts(), ts: Date.now(), isFake: true };
}

function cleanEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const local = email.split('@')[0].replace(/[._0-9]/g, ' ').trim();
  return local.split(' ').filter(w => w.length > 1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── AUTO SCALE ─────────────────────────────────
function getScale() {
  if (typeof window === 'undefined') return 1;
  const w = window.innerWidth;
  if (w >= 3840) return 2.6;
  if (w >= 3200) return 2.2;
  if (w >= 2560) return 1.8;
  if (w >= 1920) return 1.35;
  return 1;
}

export default function LiveOrders() {
  const streamRef = useRef(null);
  const streamElsRef = useRef([]);
  const S_data = useRef({ orders: 0, revenue: 0, maxAmt: 0, chCounts: {}, prodRev: {}, buf: [], times: [], lastBigClient: null });
  const [, forceUpdate] = useState(0);
  const tickerRef1 = useRef(null);
  const tickerRef2 = useRef(null);
  const scrollPos = useRef({ s1: 0, s2: 0, lastT: 0 });
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  CHANNELS.forEach(c => { if (!S_data.current.chCounts[c.id]) S_data.current.chCounts[c.id] = 0; });

  // ── DETECT SCREEN SIZE ───────────────────────
  useEffect(() => {
    const update = () => { const s = getScale(); setScale(s); scaleRef.current = s; };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const V = scale; // alias for CSS template

  const particleBurst = useCallback((ox, oy, count = 36, big = false) => {
    const S = scaleRef.current;
    const ring = document.createElement('div');
    Object.assign(ring.style, { position:'fixed',pointerEvents:'none',zIndex:'9998',width:(10*S)+'px',height:(10*S)+'px',borderRadius:'50%',border:(2*S)+'px solid '+pick(PARTICLE_COLORS)+'99',left:(ox-5*S)+'px',top:(oy-5*S)+'px',animation:'ringExpand .7s ease-out forwards' });
    document.body.appendChild(ring); setTimeout(() => ring.remove(), 750);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        const sz = (big ? rand(4,10) : rand(3,7)) * S; const color = pick(PARTICLE_COLORS);
        const angle = rand(-200,20), dist = (big ? rand(180,420) : rand(100,280)) * S;
        const rad = angle*(Math.PI/180), tx = Math.sin(rad)*dist, ty = -Math.abs(Math.cos(rad))*dist - rand(40,100)*S;
        const dur = big ? rand(1.4,2.6) : rand(1.0,1.9);
        Object.assign(p.style, { position:'fixed',pointerEvents:'none',zIndex:'9999',width:sz+'px',height:sz+'px',borderRadius:Math.random()<.5?'50%':'2px',background:color,boxShadow:'0 0 '+(big?8:5)*S+'px '+color+'88',left:ox+'px',top:oy+'px',animation:'particleFly '+dur+'s ease-out forwards','--tx':tx+'px','--ty':ty+'px','--rot':rand(-400,400)+'deg' });
        document.body.appendChild(p); setTimeout(() => p.remove(), dur*1000+100);
      }, Math.random()*(big?300:150));
    }
  }, []);

  const addToStream = useCallback((tx) => {
    const stream = streamRef.current; if (!stream) return;
    const S = scaleRef.current;
    const el = document.createElement('div');
    const c = tx.ch.color;
    const displayAmt = tx.amount.toFixed(2);
    const customerDisplay = tx.customer || '';
    el.className = 'notif-card'; el.style.background = 'linear-gradient(135deg,'+c+'18,'+c+'08)'; el.style.borderColor = c+'40';
    el.innerHTML = '<div class="nc-glow" style="background:'+c+'"></div><div class="nc-icon" style="background:'+c+'18;color:'+c+'">☕</div><div class="nc-body"><div class="nc-top"><span class="nc-label" style="color:'+c+'">New Order · '+tx.ch.label+'</span><span class="nc-new" style="background:'+c+'22;color:'+c+';border:1px solid '+c+'44;">● LIVE</span></div><div class="nc-prod">'+tx.prod+'</div><div class="nc-meta">'+tx.loc+' · '+(tx.qty>1?tx.qty+' items':'1 item')+(customerDisplay?' · '+customerDisplay:'')+'</div></div><div class="nc-right"><div class="nc-amount" style="color:'+c+'">₾'+displayAmt+'</div><div class="nc-qty">'+(tx.qty>1?tx.qty+'x':'single')+'</div><div class="nc-time">'+tx.time+'</div></div>';
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      const r = el.getBoundingClientRect(); const big = tx.amount > 60; const pts = big ? 8 : 4;
      for (let p = 0; p < pts; p++) particleBurst(r.left+(r.width/pts)*p, r.top+r.height*rand(.2,.8), big?10:5, big);
    }); });
    stream.insertBefore(el, stream.firstChild); streamElsRef.current.unshift(el);
    while (streamElsRef.current.length > 9) { const old = streamElsRef.current.pop(); old.style.opacity='0'; old.style.transform='translateX(12px)'; old.style.transition='opacity .35s,transform .35s'; setTimeout(()=>old.remove(),360); }
  }, [particleBurst]);

  const processTx = useCallback((tx) => {
    const st = S_data.current;
    st.orders++; st.revenue = parseFloat((st.revenue + tx.amount * REV_MULT).toFixed(2));
    st.chCounts[tx.ch.id] = (st.chCounts[tx.ch.id]||0) + 1;
    const prodKey = tx.prod.length > 40 ? tx.prod.slice(0,40)+'...' : tx.prod;
    if (!st.prodRev[prodKey]) st.prodRev[prodKey] = { rev: 0 };
    st.prodRev[prodKey].rev += tx.amount * REV_MULT;
    st.times.push(Date.now());
    st.buf.push(tx); if (st.buf.length>60) st.buf.shift();
    if (tx.amount > st.maxAmt && tx.ch.id !== 'b2b') {
      st.maxAmt = tx.amount;
      st.lastBigClient = { name: tx.customer || tx.prod, channel: tx.ch.label, loc: tx.loc, amount: tx.amount, time: tx.time };
    }
    addToStream(tx);
    forceUpdate(n=>n+1);
  }, [addToStream]);

  useEffect(() => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    (async () => {
      const results = await Promise.allSettled(CHANNELS.map(ch => {
        let sel = 'shopify_id,name,total,created_at,financial_status,tags,customer_email';
        if (ch.regionField) sel += ','+ch.regionField;
        if (ch.id==='vending') sel += ',vms_name,vms_id';
        return supabase.from(ch.table).select(sel).gte('created_at', todayStart.toISOString()).order('created_at',{ascending:false}).limit(200);
      }));
      const itemResults = await Promise.allSettled(CHANNELS.map(ch => supabase.from(ch.itemsTable).select('order_shopify_id,title,quantity').limit(1500)));
      const itemsByStore = {};
      CHANNELS.forEach((ch,i) => { const data = (itemResults[i].status==='fulfilled'&&itemResults[i].value.data)||[]; const map = {}; data.forEach(it=>{if(!map[it.order_shopify_id])map[it.order_shopify_id]=[];map[it.order_shopify_id].push(it);}); itemsByStore[ch.id]=map; });
      const st = S_data.current; let allTx = [];
      CHANNELS.forEach((ch,i) => {
        const data = (results[i].status==='fulfilled'&&results[i].value.data)||[];
        data.forEach(raw => {
          const amount = parseFloat(raw.total||0); if (amount<=0) return;
          const items = (itemsByStore[ch.id]||{})[raw.shopify_id]||[];
          let prod;
          if (items.length > 0) { prod = items.map(it => { let t = it.title||'Product'; if(t.length>50) t=t.slice(0,47)+'...'; return t+(it.quantity>1?' x'+it.quantity:''); }).join(', '); }
          else { prod = raw.vms_name || raw.tags || 'Coffee Order'; }
          const qty = items.reduce((s,it)=>s+(it.quantity||1),0)||1;
          const loc = (ch.regionField&&raw[ch.regionField])||ch.defaultRegion||'';
          let customer = cleanEmail(raw.customer_email);
          if (!customer && raw.vms_name) customer = raw.vms_name;
          const createdAt = raw.created_at ? new Date(raw.created_at) : new Date();
          const tx = { ch, prod, qty, amount, loc, customer, time: createdAt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), ts: createdAt.getTime() };
          allTx.push(tx);
          st.orders++; st.revenue += amount * REV_MULT; st.chCounts[ch.id]=(st.chCounts[ch.id]||0)+1;
          const pk = prod.length>40?prod.slice(0,40)+'...':prod;
          if(!st.prodRev[pk]) st.prodRev[pk]={rev:0}; st.prodRev[pk].rev+=amount*REV_MULT;
          st.buf.push(tx); if(st.buf.length>60) st.buf.shift();
          if(amount>st.maxAmt && ch.id!=='b2b'){st.maxAmt=amount;st.lastBigClient={name:customer||prod,channel:ch.label,loc,amount:amount,time:tx.time};}
        });
      });
      allTx.sort((a,b)=>b.ts-a.ts);
      allTx.slice(0,7).reverse().forEach(tx=>addToStream(tx));
      forceUpdate(n=>n+1);
    })();
    const channels = CHANNELS.map(ch => supabase.channel('rt_'+ch.table).on('postgres_changes',{event:'INSERT',schema:'public',table:ch.table},(payload)=>{
      const raw=payload.new; const amount=parseFloat(raw.total||0); if(amount<=0)return;
      let customer = cleanEmail(raw.customer_email);
      if (!customer && raw.vms_name) customer = raw.vms_name;
      processTx({ch,prod:raw.vms_name||raw.tags||'New Order',qty:1,amount,loc:(ch.regionField&&raw[ch.regionField])||ch.defaultRegion||'',customer,time:ts()});
    }).subscribe());
    function pushSmall() {
      const smallProducts = FAKE_PRODUCTS.filter(p => p.p <= 7);
      const prod = pick(smallProducts);
      processTx({ ch: pick(CHANNELS.filter(c=>c.id!=='b2b')), prod: prod.name, qty: 1, amount: prod.p, loc: pick(FAKE_LOCS), customer: pick(FAKE_NAMES), time: ts(), ts: Date.now(), isFake: true });
    }
    function scheduleFake() {
      return setTimeout(() => {
        processTx(genFakeTx());
        setTimeout(pushSmall, randI(400, 900));
        if (Math.random() < 0.5) setTimeout(pushSmall, randI(1200, 2000));
        scheduleFake();
      }, randI(3000, 5000));
    }
    const fakeTimer = scheduleFake();
    const rid = setInterval(()=>forceUpdate(n=>n+1),60000);
    return ()=>{channels.forEach(c=>supabase.removeChannel(c));clearInterval(rid);clearTimeout(fakeTimer);};
  }, [addToStream, processTx]);

  useEffect(()=>{const t=setInterval(()=>{const el=document.getElementById('live-clock');if(el)el.textContent='Live · '+ts();const st=S_data.current;const now=Date.now();st.times=st.times.filter(t=>now-t<60000);const r=document.getElementById('h-rate');if(r)r.textContent=st.times.length+'/min';},1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{let running=true;const raf=(timestamp)=>{if(!running)return;const sp=scrollPos.current;if(sp.lastT){const dt=Math.min(timestamp-sp.lastT,50);const e1=tickerRef1.current,e2=tickerRef2.current;if(e1&&e1.scrollWidth>10){sp.s1=(sp.s1+.044*dt)%(e1.scrollWidth/2);e1.style.transform='translateX(-'+sp.s1+'px)';}if(e2&&e2.scrollWidth>10){sp.s2=(sp.s2+.044*dt)%(e2.scrollWidth/2);e2.style.transform='translateX(-'+sp.s2+'px)';}}sp.lastT=timestamp;requestAnimationFrame(raf);};requestAnimationFrame(raf);return()=>{running=false;};},[]);

  const st = S_data.current;
  const aov = st.orders>0?fmtI(st.revenue/st.orders):'0 ₾';
  const chSorted = [...CHANNELS].sort((a,b)=>(st.chCounts[b.id]||0)-(st.chCounts[a.id]||0));
  const chTotal = Object.values(st.chCounts).reduce((a,b)=>a+b,0)||1;
  const topProds = Object.entries(st.prodRev).sort((a,b)=>b[1].rev-a[1].rev).slice(0,4);
  const bigClient = st.lastBigClient;
  const tickerRecent = [...st.buf,...st.buf].map(tx=>'<span style="display:inline-flex;align-items:center;gap:'+6*V+'px;font-size:'+13*V+'px"><span style="width:'+5*V+'px;height:'+5*V+'px;border-radius:50%;background:'+tx.ch.color+';flex-shrink:0"></span><span style="color:rgba(255,255,255,.58)">'+((tx.prod||'').slice(0,28))+'</span><span style="color:rgba(255,255,255,.18)">·</span><span style="color:'+tx.ch.color+';font-family:Space Mono,monospace;font-size:'+12*V+'px">'+tx.amount.toFixed(2)+' ₾</span></span>').join('<span style="width:'+34*V+'px;display:inline-block"></span>');
  const chRevTicker = CHANNELS.map(ch=>({ch,rev:st.buf.filter(t=>t.ch.id===ch.id).reduce((s,t)=>s+t.amount*REV_MULT,0)})).sort((a,b)=>b.rev-a.rev);
  const tickerCh = [...chRevTicker,...chRevTicker].map(({ch,rev})=>'<span style="display:inline-flex;align-items:center;gap:'+6*V+'px;font-size:'+13*V+'px"><span style="width:'+5*V+'px;height:'+5*V+'px;border-radius:50%;background:'+ch.color+'"></span><span style="color:'+ch.color+';font-weight:500">'+ch.label+'</span><span style="color:rgba(255,255,255,.18)">·</span><span style="color:'+ch.color+';font-family:Space Mono,monospace;font-size:'+12*V+'px">'+fmtI(rev)+'</span></span>').join('<span style="width:'+34*V+'px;display:inline-block"></span>');

  return (<>
    <style>{`
      :root{--black:#08060e;--card:#16121f;--border:rgba(180,140,255,0.08);--gold:#A855F7;--gold2:#C084FC;--cream:#E9D5FF;--green:#2ECC71;--dim:rgba(255,255,255,0.28);--mid:rgba(255,255,255,0.58);--full:rgba(255,255,255,0.92);}
      *{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:var(--black);font-family:'DM Sans',system-ui,sans-serif;color:var(--full);overflow:hidden;}
      .bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(168,85,247,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,.04) 1px,transparent 1px);background-size:${60*V}px ${60*V}px;}
      .bg-glow{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(168,85,247,.10),transparent 65%);animation:gp 5s ease-in-out infinite;}
      @keyframes gp{0%,100%{opacity:.5}50%{opacity:1}}
      .wrapper{position:relative;z-index:1;width:100vw;height:100vh;display:grid;grid-template-rows:${70*V}px 1fr ${100*V}px;grid-template-columns:1fr ${340*V}px;}
      header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:0 ${26*V}px;border-bottom:1px solid var(--border);background:rgba(8,6,14,.98);}
      .logo-wrap{display:flex;align-items:center;gap:${11*V}px;}.logo-icon{width:${36*V}px;height:${36*V}px;background:linear-gradient(135deg,#A855F7,#C084FC);border-radius:${8*V}px;display:flex;align-items:center;justify-content:center;font-family:Bebas Neue,system-ui;font-size:${19*V}px;color:#fff;box-shadow:0 0 ${18*V}px rgba(168,85,247,.5);}
      .logo-text{font-family:Bebas Neue,system-ui;font-size:${24*V}px;letter-spacing:${4*V}px;background:linear-gradient(135deg,#C084FC,#E9D5FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
      .live-wrap{display:flex;align-items:center;gap:${7*V}px;}.live-dot{width:${7*V}px;height:${7*V}px;background:#2ECC71;border-radius:50%;box-shadow:0 0 ${7*V}px #2ECC71;animation:ld 1.4s ease-in-out infinite;}
      @keyframes ld{0%,100%{opacity:1}50%{opacity:.3}}.live-txt{font-family:Space Mono,monospace;font-size:${12*V}px;letter-spacing:${2.5*V}px;color:#2ECC71;text-transform:uppercase;}
      .hstats{display:flex;align-items:center;gap:${22*V}px;}.hs{text-align:right;}.hs-val{font-family:Bebas Neue,system-ui;font-size:${26*V}px;letter-spacing:${1.5*V}px;color:#C084FC;line-height:1;}.hs-lbl{font-size:${10*V}px;letter-spacing:${2*V}px;color:var(--dim);text-transform:uppercase;margin-top:${1*V}px;}.hs-sep{width:1px;height:${26*V}px;background:var(--border);}
      .main-feed{grid-column:1;grid-row:2;padding:${16*V}px ${16*V}px ${16*V}px ${26*V}px;overflow:hidden;display:flex;flex-direction:column;}
      .feed-hdr{display:flex;align-items:center;gap:${10*V}px;margin-bottom:${12*V}px;}.feed-lbl{font-size:${11*V}px;letter-spacing:${3*V}px;color:var(--dim);text-transform:uppercase;flex:1;display:flex;align-items:center;gap:${8*V}px;}.feed-lbl::after{content:'';flex:1;height:1px;background:var(--border);}.feed-count{font-family:Space Mono,monospace;font-size:${13*V}px;color:#A855F7;}
      .stream{flex:1;overflow:hidden;display:flex;flex-direction:column;gap:${6*V}px;}
      .notif-card{border-radius:${14*V}px;padding:${14*V}px ${16*V}px;display:flex;align-items:center;gap:${13*V}px;position:relative;overflow:hidden;flex-shrink:0;border:1px solid;animation:nIn .42s cubic-bezier(.34,1.5,.64,1) both;}@keyframes nIn{from{opacity:0;transform:translateX(-${22*V}px) scale(.94)}to{opacity:1;transform:none}}
      .notif-card .nc-glow{position:absolute;inset:0;border-radius:${14*V}px;opacity:.07;pointer-events:none;}.notif-card .nc-icon{width:${52*V}px;height:${52*V}px;border-radius:${13*V}px;display:flex;align-items:center;justify-content:center;font-size:${20*V}px;flex-shrink:0;border:1px solid rgba(255,255,255,.1);}
      .nc-body{flex:1;min-width:0;}.nc-top{display:flex;align-items:center;gap:${7*V}px;margin-bottom:${4*V}px;}.nc-label{font-size:${10*V}px;letter-spacing:${2*V}px;text-transform:uppercase;font-weight:700;opacity:.9;}.nc-new{font-size:${10*V}px;font-weight:700;letter-spacing:${1.5*V}px;text-transform:uppercase;padding:${1*V}px ${6*V}px;border-radius:${20*V}px;margin-left:auto;opacity:.9;}
      .nc-prod{font-size:${16*V}px;font-weight:700;line-height:1.25;margin-bottom:${3*V}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.nc-meta{font-size:${12*V}px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .nc-right{text-align:right;flex-shrink:0;}.nc-amount{font-family:Bebas Neue,system-ui;font-size:${36*V}px;letter-spacing:${1.5*V}px;line-height:1;}.nc-qty{font-size:${11*V}px;opacity:.6;margin-top:${2*V}px;}.nc-time{font-family:Space Mono,monospace;font-size:${10*V}px;opacity:.5;margin-top:${3*V}px;}
      .notif-card::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);animation:shimmer .8s .1s ease-out forwards;}@keyframes shimmer{0%{left:-100%}100%{left:150%}}
      .sidebar{grid-column:2;grid-row:2;border-left:1px solid var(--border);padding:${16*V}px;display:flex;flex-direction:column;gap:${14*V}px;overflow:hidden;background:rgba(10,8,16,.85);}
      .sb-title{font-size:${10*V}px;letter-spacing:${3*V}px;text-transform:uppercase;color:var(--dim);margin-bottom:${8*V}px;display:flex;align-items:center;gap:${7*V}px;}.sb-title::after{content:'';flex:1;height:1px;background:var(--border);}
      .spotlight{background:linear-gradient(135deg,rgba(168,85,247,.14),rgba(168,85,247,.03));border:1px solid rgba(168,85,247,.22);border-radius:${11*V}px;padding:${12*V}px ${13*V}px;position:relative;overflow:hidden;}
      .spot-crown{position:absolute;right:${10*V}px;top:${9*V}px;font-size:${18*V}px;opacity:.5;}.spot-lbl{font-size:${9*V}px;letter-spacing:${3*V}px;text-transform:uppercase;color:#A855F7;margin-bottom:${4*V}px;}.spot-prod{font-size:${14*V}px;font-weight:700;margin-bottom:${2*V}px;padding-right:${26*V}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.spot-ch{font-size:${11*V}px;color:var(--dim);margin-bottom:${6*V}px;}.spot-amt{font-family:Bebas Neue,system-ui;font-size:${36*V}px;letter-spacing:${2*V}px;color:#C084FC;line-height:1;}.spot-amt small{font-size:${14*V}px;color:#A855F7;}
      .ch-bars{display:flex;flex-direction:column;gap:${5.5*V}px;}.ch-row{display:flex;align-items:center;gap:${6*V}px;}.ch-name{font-size:${11*V}px;font-weight:500;text-transform:uppercase;letter-spacing:${.4*V}px;width:${80*V}px;flex-shrink:0;}.ch-track{flex:1;height:${6*V}px;background:rgba(255,255,255,.06);border-radius:${3*V}px;overflow:hidden;}.ch-fill{height:100%;border-radius:${3*V}px;transition:width 1s ease;}.ch-cnt{font-family:Space Mono,monospace;font-size:${12*V}px;width:${24*V}px;text-align:right;color:var(--dim);}
      .top-prods{display:flex;flex-direction:column;gap:${4*V}px;}.tp-row{display:flex;align-items:center;gap:${7*V}px;padding:${6*V}px ${8*V}px;background:rgba(255,255,255,.025);border-radius:${7*V}px;border:1px solid var(--border);}.tp-rank{font-family:Bebas Neue,system-ui;font-size:${16*V}px;color:var(--dim);width:${14*V}px;text-align:center;}.tp-name{flex:1;font-size:${12*V}px;font-weight:500;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tp-rev{font-family:Bebas Neue,system-ui;font-size:${16*V}px;color:#C084FC;}
      .tech-stack{display:flex;flex-wrap:wrap;gap:${4*V}px;margin-top:${2*V}px;}.tech-badge{font-size:${9*V}px;font-weight:600;letter-spacing:${1*V}px;text-transform:uppercase;padding:${2*V}px ${7*V}px;border-radius:${3*V}px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.18);color:#C084FC;white-space:nowrap;}
      .ticker-bar{grid-column:1/-1;grid-row:3;border-top:1px solid var(--border);background:rgba(8,6,14,.99);padding:0 ${26*V}px;display:flex;flex-direction:column;justify-content:center;gap:${8*V}px;}
      .t-row{display:flex;align-items:center;overflow:hidden;}.t-lbl{font-size:${10*V}px;letter-spacing:${3*V}px;text-transform:uppercase;color:var(--dim);white-space:nowrap;margin-right:${14*V}px;padding-right:${14*V}px;border-right:1px solid var(--border);flex-shrink:0;}.t-track{flex:1;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 ${36*V}px,#000 calc(100% - ${36*V}px),transparent);}.t-inner{display:flex;gap:${34*V}px;white-space:nowrap;width:max-content;}
      @keyframes particleFly{0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1);}60%{opacity:.8;}100%{opacity:0;transform:translate(var(--tx,0px),var(--ty,-200px)) rotate(var(--rot,360deg)) scale(0);}}
      @keyframes ringExpand{0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(12);border-width:0.5px;}}
      ::-webkit-scrollbar{display:none;}
    `}</style>
    <div className="bg-grid"/><div className="bg-glow"/>
    <div className="wrapper">
      <header>
        <div className="logo-wrap"><div className="logo-icon">M</div><div className="logo-text">MEAMA</div></div>
        <div className="live-wrap"><div className="live-dot"/><div className="live-txt" id="live-clock">Live Orders</div></div>
        <div className="hstats">
          <div className="hs"><div className="hs-val">{st.orders}</div><div className="hs-lbl">Orders Today</div></div><div className="hs-sep"/>
          <div className="hs"><div className="hs-val">{fmtI(st.revenue)}</div><div className="hs-lbl">Revenue Today</div></div><div className="hs-sep"/>
          <div className="hs"><div className="hs-val">{aov}</div><div className="hs-lbl">Avg Order</div></div><div className="hs-sep"/>
          <div className="hs"><div className="hs-val" id="h-rate" style={{color:'#2ECC71'}}>0/min</div><div className="hs-lbl">Order Rate</div></div>
        </div>
      </header>
      <div className="main-feed">
        <div className="feed-hdr"><div className="feed-lbl">Transaction Stream <span className="feed-count">{st.orders.toLocaleString()} orders</span></div></div>
        <div className="stream" ref={streamRef}/>
      </div>
      <div className="sidebar">
        <div><div className="sb-title">Last Client · Largest Order</div>
          <div className="spotlight"><div className="spot-crown">👑</div><div className="spot-lbl">◆ Top Client</div>
            <div className="spot-prod">{bigClient?bigClient.name:'Waiting for orders...'}</div>
            <div className="spot-ch">{bigClient?bigClient.channel+' · '+bigClient.loc:'-'}</div>
            <div className="spot-amt"><small>₾ </small>{bigClient?bigClient.amount.toFixed(2):'0'}</div>
        </div></div>
        <div><div className="sb-title">By Channel</div><div className="ch-bars">{chSorted.map(ch=>{const cnt=st.chCounts[ch.id]||0;const pct=((cnt/chTotal)*100).toFixed(0);return(<div className="ch-row" key={ch.id}><div className="ch-name" style={{color:ch.color}}>{ch.label}</div><div className="ch-track"><div className="ch-fill" style={{width:pct+'%',background:ch.color}}/></div><div className="ch-cnt" style={{color:ch.color}}>{cnt}</div></div>);})}</div></div>
        <div><div className="sb-title">Top Products</div><div className="top-prods">{topProds.map(([name,d],i)=>(<div className="tp-row" key={name}><div className="tp-rank">{i+1}</div><div className="tp-name">{name}</div><div className="tp-rev">{fmtI(d.rev)}</div></div>))}{topProds.length===0&&<div style={{fontSize:10*V,color:'rgba(255,255,255,.3)'}}>Loading...</div>}</div></div>
        <div><div className="sb-title">Tech Stack</div><div className="tech-stack">{['Supabase','Next.js','Vercel','Shopify','Realtime','PostgreSQL','React'].map(t=><span className="tech-badge" key={t}>{t}</span>)}</div></div>
      </div>
      <div className="ticker-bar">
        <div className="t-row"><div className="t-lbl">Recent</div><div className="t-track"><div className="t-inner" ref={tickerRef1} dangerouslySetInnerHTML={{__html:tickerRecent}}/></div></div>
        <div className="t-row"><div className="t-lbl">By Channel</div><div className="t-track"><div className="t-inner" ref={tickerRef2} dangerouslySetInnerHTML={{__html:tickerCh}}/></div></div>
      </div>
    </div>
  </>);
}
