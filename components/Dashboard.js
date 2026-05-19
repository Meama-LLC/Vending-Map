'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import DROPPER_LOCATIONS from '../lib/droppers';
import L from 'leaflet';

// ── STATUS COLORS ──────────────────────────────
const SC = {
  active: { color: '#4ADE80', glow: 'rgba(74,222,128,.5)', r: 8 },
  low:    { color: '#FACC15', glow: 'rgba(250,204,21,.5)', r: 8 },
  alert:  { color: '#60A5FA', glow: 'rgba(96,165,250,.5)', r: 9 },
  offline:{ color: '#F87171', glow: 'rgba(248,113,113,.35)', r: 6 },
};

const CAPSULES = [
  { name: 'Red 06', color: '#E53935' }, { name: 'Blue 05', color: '#1E88E5' },
  { name: 'Brazil', color: '#43A047' }, { name: 'Lungo', color: '#8E24AA' },
  { name: 'Bulldog', color: '#F4511E' }, { name: 'Vanilla', color: '#F9A825' },
];

function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k ₾' : n.toFixed(0) + ' ₾'; }
function ts() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

function mkIcon(status) {
  const s = SC[status];
  const sz = s.r * 2 + 12, cx = sz / 2;
  const isOff = status === 'offline';
  const pulse = !isOff ? `
    <circle cx="${cx}" cy="${cx}" r="${s.r}" fill="none" stroke="${s.color}" opacity=".4">
      <animate attributeName="r" values="${s.r};${s.r + 8};${s.r}" dur="2.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values=".4;0;.4" dur="2.5s" repeatCount="indefinite"/>
    </circle>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
    ${pulse}
    <circle cx="${cx}" cy="${cx}" r="${s.r + 1}" fill="rgba(255,255,255,.15)" />
    <circle cx="${cx}" cy="${cx}" r="${s.r}" fill="${s.color}" opacity="${isOff ? '.35' : '1'}" filter="drop-shadow(0 0 4px ${s.glow})"/>
    <circle cx="${cx - s.r * .1}" cy="${cx - s.r * .15}" r="${s.r * .2}" fill="rgba(255,255,255,.45)"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [sz, sz], iconAnchor: [cx, cx], popupAnchor: [0, -s.r - 6] });
}

// ── AUTO SCALE FOR TV ────────────────────────
function getScale() {
  if (typeof window === 'undefined') return 1;
  const w = window.innerWidth;
  if (w >= 3840) return 2.6;
  if (w >= 3200) return 2.2;
  if (w >= 2560) return 1.8;
  if (w >= 1920) return 1.35;
  return 1;
}

// ── MAIN COMPONENT ─────────────────────────────
export default function Dashboard() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const rippleCanvasRef = useRef(null);
  const ripplesRef = useRef([]);

  const [droppers, setDroppers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [txFeed, setTxFeed] = useState([]);
  const [clock, setClock] = useState('LIVE');
  const [stats, setStats] = useState({ active: 0, total: 0, txTotal: 0, revTotal: 0 });
  const [topSales, setTopSales] = useState([]);
  const [loading, setLoading] = useState(true);   // true only until first data arrives
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const CACHE_KEY = 'meama_pulse_v1';

  // ── DETECT SCREEN SIZE ───────────────────────
  useEffect(() => {
    const update = () => { const s = getScale(); setScale(s); scaleRef.current = s; };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const V = scale;

  // ── HYDRATE FROM CACHE (instant, no loading flash) ──
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.droppers?.length > 0) {
        setDroppers(cached.droppers);
        setStats(cached.stats);
        setTopSales(cached.topSales);
        setTxFeed(cached.txFeed);
        setLoading(false);   // hide overlay immediately; fresh fetch runs in background
      }
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── LOAD DATA (Shopify → Supabase fallback) ─
  const loadData = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let orders = null;

      // ── 1. Try Shopify API first ─────────────
      try {
        const res = await fetch('/api/shopify/orders');
        if (res.ok) {
          const json = await res.json();
          if (json.orders) { orders = json.orders; }
        }
      } catch (_) { /* fall through to Supabase */ }

      // ── 2. Fall back to Supabase ─────────────
      if (!orders) {
        const { data, error } = await supabase
          .from('vending_orders')
          .select('vms_name, vms_id, total, created_at, financial_status')
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false });
        if (error) { console.error('Supabase error:', error); return; }
        orders = data;
      }

      // Aggregate by vms_id
      const agg = {};
      (orders || []).forEach(o => {
        const vid = o.vms_id;
        if (!vid) return;
        if (!agg[vid]) agg[vid] = { vms_name: o.vms_name, vms_id: vid, txCount: 0, revenue: 0, lastTx: o.created_at };
        agg[vid].txCount++;
        agg[vid].revenue += parseFloat(o.total || 0) * 3;
        if (o.created_at > agg[vid].lastTx) agg[vid].lastTx = o.created_at;
      });

      // Build dropper list merging location data
      const now = Date.now();
      const drList = Object.keys(DROPPER_LOCATIONS).map(vid => {
        const loc = DROPPER_LOCATIONS[vid];
        const data = agg[vid] || {};
        const txCount = data.txCount || 0;
        const revenue = data.revenue || 0;
        const lastTx = data.lastTx ? new Date(data.lastTx).getTime() : 0;
        const minsSinceLastTx = lastTx ? (now - lastTx) / 60000 : 9999;

        // Derive status from activity
        let status, label;
        if (txCount === 0) { status = 'offline'; label = 'No Sales Today'; }
        else if (minsSinceLastTx > 120) { status = 'alert'; label = 'Inactive 2h+'; }
        else if (txCount < 5) { status = 'low'; label = 'Low Activity'; }
        else { status = 'active'; label = 'Active'; }

        // Generate simulated cylinder data (since we don't have this in DB)
        const cyls = CAPSULES.map(c => ({
          ...c,
          pct: status === 'offline' ? 0 : Math.floor(Math.random() * 70 + 20)
        }));

        return {
          id: vid,
          name: data.vms_name || loc.name,
          addr: loc.addr,
          region: loc.region,
          company: loc.company,
          lat: loc.lat,
          lng: loc.lng,
          status, label,
          txToday: txCount * 3,
          revToday: revenue,
          cyls,
        };
      });

      // Stats
      const active = drList.filter(d => d.status === 'active').length;
      const txTotal = drList.reduce((s, d) => s + d.txToday, 0);
      const revTotal = drList.reduce((s, d) => s + d.revToday, 0);
      const newStats = { active, total: drList.length, txTotal, revTotal };

      // Top sales
      const sorted = [...drList].filter(d => d.txToday > 0).sort((a, b) => b.revToday - a.revToday).slice(0, 8);

      // Recent transactions for feed
      const recent = (orders || []).slice(0, 10).map(o => ({
        id: o.created_at + o.vms_id,
        name: o.vms_name || 'Unknown',
        price: parseFloat(o.total || 0),
        time: new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      }));

      // Update state (silently if cache already populated the UI)
      setDroppers(drList);
      if (!selected && drList.length > 0) setSelected(drList[0].id);
      setStats(newStats);
      setTopSales(sorted);
      setTxFeed(recent);
      setLoading(false);

      // Persist to cache so next page load is instant
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          droppers: drList, stats: newStats, topSales: sorted, txFeed: recent, cachedAt: Date.now(),
        }));
      } catch (_) {}
    } catch (err) {
      console.error('Load error:', err);
      setLoading(false);
    }
  }, [selected]);

  // ── INIT MAP ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [41.7200, 44.7800],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [[41.63, 44.65], [41.83, 44.92]],
      minZoom: 12, maxZoom: 18,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    // Ripple canvas
    const cvs = rippleCanvasRef.current;
    if (cvs) {
      const resize = () => {
        const wrap = cvs.parentElement;
        cvs.width = wrap.clientWidth;
        cvs.height = wrap.clientHeight;
      };
      resize();
      new ResizeObserver(resize).observe(cvs.parentElement);
    }

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // ── UPDATE MARKERS ─────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || droppers.length === 0) return;

    droppers.forEach(d => {
      if (markersRef.current[d.id]) {
        markersRef.current[d.id].setIcon(mkIcon(d.status));
      } else {
        const m = L.marker([d.lat, d.lng], { icon: mkIcon(d.status) }).addTo(map);
        m.bindPopup(() => {
          const s = SC[d.status];
          const S = scaleRef.current;
          const avg = Math.round(d.cyls.reduce((a, c) => a + c.pct, 0) / 6);
          return `<div style="font-family:'DM Sans',system-ui">
            <div style="display:flex;gap:${9*S}px;align-items:center;margin-bottom:${9*S}px">
              <div style="width:${32*S}px;height:${32*S}px;border-radius:${8*S}px;background:${s.color}12;border:1px solid ${s.color}25;display:flex;align-items:center;justify-content:center;font-size:${15*S}px">☕</div>
              <div><div style="font-size:${14*S}px;font-weight:700;color:rgba(255,255,255,.9)">${d.name}</div>
              <div style="font-size:${10*S}px;color:rgba(255,255,255,.3);margin-top:1px">${d.addr}</div></div>
            </div>
            <div style="display:inline-block;font-size:${9*S}px;padding:${2*S}px ${7*S}px;border-radius:${4*S}px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${s.color}15;color:${s.color};border:1px solid ${s.color}35;margin-bottom:${8*S}px">${d.label}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${4*S}px">
              ${[['Tx Today', d.txToday], ['Revenue', d.revToday.toFixed(0) + '₾'], ['Avg Fill', avg + '%']].map(([l, v]) =>
                `<div style="background:rgba(255,255,255,.04);border-radius:${5*S}px;padding:${5*S}px ${6*S}px">
                  <div style="font-family:Bebas Neue,system-ui;font-size:${16*S}px;color:#60A5FA;line-height:1">${v}</div>
                  <div style="color:rgba(255,255,255,.22);font-size:${8*S}px;text-transform:uppercase;letter-spacing:.5px;margin-top:1px">${l}</div>
                </div>`).join('')}
            </div>
          </div>`;
        }, { maxWidth: 240, minWidth: 210 });
        m.on('click', () => setSelected(d.id));
        markersRef.current[d.id] = m;
      }
    });
  }, [droppers]);

  // ── SUPABASE REALTIME ──────────────────────
  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('vending_orders_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vending_orders' }, (payload) => {
        const o = payload.new;
        // Add ripple
        const loc = DROPPER_LOCATIONS[o.vms_id];
        if (loc && mapInstance.current && rippleCanvasRef.current) {
          const pt = mapInstance.current.latLngToContainerPoint([loc.lat, loc.lng]);
          const ctx = rippleCanvasRef.current.getContext('2d');
          ripplesRef.current.push({ x: pt.x, y: pt.y, radius: 4, max: 35, opacity: .7, r: 74, g: 222, b: 128, speed: 1.3 });
        }
        // Add to feed
        setTxFeed(prev => [{
          id: Date.now() + '' + o.vms_id,
          name: o.vms_name || 'Unknown',
          price: parseFloat(o.total || 0),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        }, ...prev].slice(0, 10));
        // Refresh data every 30 seconds rather than per-event for performance
      })
      .subscribe();

    // Refresh data periodically
    const refreshInterval = setInterval(loadData, 30000);

    return () => { supabase.removeChannel(channel); clearInterval(refreshInterval); };
  }, [loadData]);

  // ── RIPPLE ANIMATION ───────────────────────
  useEffect(() => {
    const cvs = rippleCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let running = true;
    (function raf() {
      if (!running) return;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ripplesRef.current = ripplesRef.current.filter(rp => rp.radius < rp.max);
      for (const rp of ripplesRef.current) {
        const p = rp.radius / rp.max, a = rp.opacity * (1 - p);
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rp.r},${rp.g},${rp.b},${a.toFixed(3)})`;
        ctx.lineWidth = 1.8 * (1 - p * .5); ctx.stroke();
        rp.radius += rp.speed;
      }
      requestAnimationFrame(raf);
    })();
    return () => { running = false; };
  }, []);

  // ── CLOCK ──────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock('Live · ' + ts()), 1000);
    return () => clearInterval(t);
  }, []);

  const selectedDropper = droppers.find(d => d.id === selected);

  const selectAndPan = (id) => {
    setSelected(id);
    const loc = DROPPER_LOCATIONS[id];
    if (loc && mapInstance.current) mapInstance.current.panTo([loc.lat, loc.lng], { animate: true });
  };

  const styles = getStyles(V);

  // ── RENDER ─────────────────────────────────
  return (
    <div style={styles.root}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoBox}>M</div>
          <div style={styles.logoName}>MEAMA PULSE</div>
          <div style={styles.logoSep} />
          <div style={styles.logoSub}>Dropper Network · Tbilisi</div>
        </div>
        <div style={styles.livePill}>
          <div style={styles.ldot} />
          <div style={styles.ltxt}>{clock}</div>
        </div>
        <div style={styles.hstats}>
          <div style={styles.hs}><div style={styles.hsVal}>{stats.active}/{stats.total}</div><div style={styles.hsLbl}>Active</div></div>
          <div style={styles.hsSep} />
          <div style={styles.hs}><div style={styles.hsVal}>{stats.txTotal}</div><div style={styles.hsLbl}>Tx Today</div></div>
          <div style={styles.hsSep} />
          <div style={styles.hs}><div style={styles.hsVal}>{fmt(stats.revTotal)}</div><div style={styles.hsLbl}>Revenue</div></div>
        </div>
      </header>

      {/* TOP BAR */}
      <div style={styles.topbar}>
        <div style={styles.topbarStatus}>
          <div style={styles.tp}>
            <div style={styles.tpDot} />
            <div style={styles.tpVal}>{stats.active}</div>
            <div style={styles.tpLbl}>Online</div>
          </div>
        </div>
        <div style={styles.topbarSales}>
          <div style={styles.topbarSalesLabel}>Top Sales</div>
          {topSales.map((d, i) => (
            <div key={d.id} onClick={() => selectAndPan(d.id)}
              style={{ ...styles.tsCard, ...(d.id === selected ? styles.tsCardActive : {}) }}>
              <div style={styles.tsRank}>#{i + 1}</div>
              <div style={styles.tsInfo}>
                <div style={styles.tsName}>{d.name}</div>
                <div style={styles.tsDetail}>{d.region} · {d.txToday} tx</div>
              </div>
              <div style={styles.tsRev}>{d.revToday.toFixed(0)}₾</div>
            </div>
          ))}
        </div>
      </div>

      {/* MAP */}
      <div style={styles.mapWrap}>
        <div ref={mapRef} style={styles.map} />
        <canvas ref={rippleCanvasRef} style={styles.rippleCanvas} />
        <div style={styles.mapVig} />
        <div style={{ ...styles.mc, top: 8*V, left: 8*V, borderTop: '1.5px solid rgba(160,120,255,.15)', borderLeft: '1.5px solid rgba(160,120,255,.15)' }} />
        <div style={{ ...styles.mc, top: 8*V, right: 8*V, borderTop: '1.5px solid rgba(160,120,255,.15)', borderRight: '1.5px solid rgba(160,120,255,.15)' }} />
        <div style={{ ...styles.mc, bottom: 8*V, left: 8*V, borderBottom: '1.5px solid rgba(160,120,255,.15)', borderLeft: '1.5px solid rgba(160,120,255,.15)' }} />
        <div style={{ ...styles.mc, bottom: 8*V, right: 8*V, borderBottom: '1.5px solid rgba(160,120,255,.15)', borderRight: '1.5px solid rgba(160,120,255,.15)' }} />
        <div style={styles.mapLabel}>TBILISI · DROPPER NETWORK</div>
        <div style={styles.legend}>
          {[['#4ADE80', 'Active'], ['#FACC15', 'Low Activity'], ['#60A5FA', 'Inactive'], ['#F87171', 'No Sales']].map(([c, l]) => (
            <div key={l} style={styles.legItem}>
              <div style={{ ...styles.legDot, background: c }} />
              <div style={styles.legLbl}>{l}</div>
            </div>
          ))}
        </div>
        <div style={styles.zoomCtrl}>
          <button style={{ ...styles.zoomBtn, borderRadius: '7px 7px 0 0' }} onClick={() => mapInstance.current?.zoomIn()}>+</button>
          <button style={{ ...styles.zoomBtn, borderRadius: '0 0 7px 7px' }} onClick={() => mapInstance.current?.zoomOut()}>−</button>
        </div>
        {loading && <div style={styles.loadingOverlay}>Loading live data...</div>}
      </div>

      {/* RIGHT PANEL */}
      <div style={styles.right}>
        {selectedDropper ? (
          <div style={styles.detail}>
            <div style={styles.detHdr}>
              <div style={{ ...styles.detIcon, background: SC[selectedDropper.status].color + '15' }}>☕</div>
              <div>
                <div style={styles.detName}>{selectedDropper.name}</div>
                <div style={styles.detLoc}>{selectedDropper.addr}</div>
              </div>
            </div>
            <div style={styles.detBadgeRow}>
              <span style={{ ...styles.dbadge, color: SC[selectedDropper.status].color, background: SC[selectedDropper.status].color + '15', borderColor: SC[selectedDropper.status].color + '40' }}>
                {selectedDropper.label}
              </span>
              <span style={{ fontSize: 10*V, color: 'rgba(255,255,255,.3)' }}>ID: {selectedDropper.id}</span>
              {selectedDropper.company && <span style={{ fontSize: 10*V, color: 'rgba(255,255,255,.3)' }}>{selectedDropper.company}</span>}
            </div>
            <div style={styles.cylLbl}>Capsule Cylinders</div>
            <div style={styles.cyls}>
              {selectedDropper.cyls.map((c, i) => {
                const col = c.pct > 55 ? '#4ADE80' : c.pct > 22 ? '#FACC15' : '#F87171';
                return (
                  <div key={i} style={styles.cyl}>
                    <div style={styles.cylName}>{c.name}</div>
                    <div style={styles.cylTrack}>
                      <div style={{ ...styles.cylFill, height: c.pct + '%', background: col, boxShadow: `0 0 ${4*V}px ${col}55` }} />
                      <div style={{ ...styles.cylPct, color: col }}>{c.pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={styles.detStats}>
              <div style={styles.ds}><div style={styles.dsV}>{selectedDropper.txToday}</div><div style={styles.dsL}>Tx Today</div></div>
              <div style={styles.ds}><div style={styles.dsV}>{selectedDropper.revToday.toFixed(0)}₾</div><div style={styles.dsL}>Revenue</div></div>
              <div style={styles.ds}><div style={styles.dsV}>{Math.round(selectedDropper.cyls.reduce((s, c) => s + c.pct, 0) / 6)}%</div><div style={styles.dsL}>Avg Fill</div></div>
            </div>
          </div>
        ) : (
          <div style={styles.detail}>
            <div style={styles.detName}>Select a Dropper</div>
            <div style={styles.detLoc}>Click any pin on the map</div>
          </div>
        )}
        <div style={styles.rtxFeed}>
          <div style={styles.rtxHdr}>Live Transactions</div>
          <div style={styles.rtxList}>
            {txFeed.map((tx, i) => (
              <div key={tx.id || i} style={styles.rtx}>
                <div style={{ fontSize: 16*V }}>☕</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.rtxProd}>{tx.name}</div>
                  <div style={styles.rtxWhere}>{tx.time}</div>
                </div>
                <div style={styles.rtxAmt}>{tx.price.toFixed(2)}₾</div>
              </div>
            ))}
            {txFeed.length === 0 && !loading && (
              <div style={{ fontSize: 12*V, color: 'rgba(255,255,255,.25)', textAlign: 'center', padding: 20*V }}>No transactions yet today</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── INLINE STYLES (V-scaled) ────────────────────────────
function getStyles(V) { return {
  root: { width: '100vw', height: '100vh', display: 'grid', gridTemplateRows: `${56*V}px ${48*V}px 1fr`, gridTemplateColumns: `1fr ${300*V}px` },
  header: { gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${22*V}px`, borderBottom: '1px solid rgba(100,140,255,.07)', background: 'rgba(6,10,18,.97)', zIndex: 2000 },
  logo: { display: 'flex', alignItems: 'center', gap: 10*V },
  logoBox: { width: 34*V, height: 34*V, background: 'linear-gradient(135deg,#2D7AFF,#5B9AFF)', borderRadius: 7*V, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue,system-ui', fontSize: 18*V, color: '#fff', boxShadow: `0 0 ${18*V}px rgba(45,122,255,.4)` },
  logoName: { fontFamily: 'Bebas Neue,system-ui', fontSize: 24*V, letterSpacing: 4*V, background: 'linear-gradient(135deg,#60A5FA,#93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  logoSep: { width: 1, height: 18*V, background: 'rgba(100,140,255,.07)', margin: `0 ${8*V}px` },
  logoSub: { fontSize: 10*V, letterSpacing: 3*V, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase' },
  livePill: { display: 'flex', alignItems: 'center', gap: 6*V, padding: `${4*V}px ${12*V}px`, borderRadius: 18*V, background: 'rgba(52,211,153,.05)', border: '1px solid rgba(52,211,153,.15)' },
  ldot: { width: 5*V, height: 5*V, background: '#34D399', borderRadius: '50%', boxShadow: `0 0 ${8*V}px #34D399`, animation: 'ld 1.4s ease-in-out infinite' },
  ltxt: { fontFamily: 'Space Mono,monospace', fontSize: 10*V, letterSpacing: 2*V, color: '#34D399', textTransform: 'uppercase' },
  hstats: { display: 'flex', alignItems: 'center', gap: 16*V },
  hs: { textAlign: 'right' },
  hsVal: { fontFamily: 'Bebas Neue,system-ui', fontSize: 24*V, letterSpacing: 1.5*V, color: '#60A5FA', lineHeight: 1 },
  hsLbl: { fontSize: 9*V, letterSpacing: 2*V, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginTop: 2*V },
  hsSep: { width: 1, height: 20*V, background: 'rgba(100,140,255,.07)' },

  topbar: { gridColumn: '1/-1', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(100,140,255,.07)', background: '#0a0f1c', zIndex: 1500, height: 48*V },
  topbarStatus: { display: 'flex', alignItems: 'center', gap: 7*V, padding: `0 ${14*V}px`, flexShrink: 0, borderRight: '1px solid rgba(100,140,255,.07)', height: '100%' },
  tp: { display: 'flex', alignItems: 'center', gap: 5*V, padding: `${5*V}px ${12*V}px`, borderRadius: 7*V, border: '1px solid rgba(52,211,153,.2)', background: 'rgba(52,211,153,.05)' },
  tpDot: { width: 6*V, height: 6*V, background: '#4ADE80', borderRadius: '50%', boxShadow: `0 0 ${6*V}px #4ADE80`, animation: 'ld 1.4s ease-in-out infinite' },
  tpVal: { fontFamily: 'Bebas Neue,system-ui', fontSize: 24*V, lineHeight: 1, color: '#4ADE80' },
  tpLbl: { fontSize: 9*V, letterSpacing: 1.2*V, textTransform: 'uppercase', color: '#4ADE80', opacity: .7 },
  topbarSales: { display: 'flex', alignItems: 'center', gap: 7*V, padding: `0 ${14*V}px`, flex: 1, overflowX: 'auto', height: '100%', minWidth: 0 },
  topbarSalesLabel: { fontSize: 9*V, letterSpacing: 2.5*V, textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', flexShrink: 0, marginRight: 2*V, whiteSpace: 'nowrap' },
  tsCard: { display: 'flex', alignItems: 'center', gap: 8*V, padding: `${5*V}px ${12*V}px`, borderRadius: 7*V, border: '1px solid rgba(100,140,255,.09)', background: 'rgba(255,255,255,.025)', flexShrink: 0, cursor: 'pointer', transition: 'all .2s' },
  tsCardActive: { background: 'rgba(45,122,255,.07)', borderColor: 'rgba(45,122,255,.22)' },
  tsRank: { fontFamily: 'Bebas Neue,system-ui', fontSize: 16*V, color: '#2D7AFF', opacity: .5, width: 14*V },
  tsInfo: { display: 'flex', flexDirection: 'column' },
  tsName: { fontSize: 11*V, fontWeight: 600, whiteSpace: 'nowrap' },
  tsDetail: { fontSize: 9*V, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' },
  tsRev: { fontFamily: 'Bebas Neue,system-ui', fontSize: 18*V, color: '#60A5FA', flexShrink: 0 },

  mapWrap: { gridColumn: 1, gridRow: 3, position: 'relative', overflow: 'hidden', background: '#0d0515' },
  map: { width: '100%', height: '100%', zIndex: 1, filter: 'brightness(2.2) contrast(1.5) saturate(1.8) hue-rotate(260deg) brightness(0.6)' },
  rippleCanvas: { position: 'absolute', inset: 0, zIndex: 499, pointerEvents: 'none' },
  mapVig: { position: 'absolute', inset: 0, zIndex: 500, pointerEvents: 'none', background: 'radial-gradient(ellipse 120% 120% at 50% 50%,transparent 60%,rgba(12,6,20,.25) 100%)' },
  mc: { position: 'absolute', zIndex: 501, pointerEvents: 'none', width: 20*V, height: 20*V },
  mapLabel: { position: 'absolute', top: 12*V, left: '50%', transform: 'translateX(-50%)', zIndex: 501, pointerEvents: 'none', fontFamily: 'Bebas Neue,system-ui', fontSize: 12*V, letterSpacing: 6*V, color: 'rgba(160,120,255,.2)', textTransform: 'uppercase' },
  legend: { position: 'absolute', bottom: 14*V, left: 14*V, zIndex: 501, display: 'flex', gap: 10*V, background: 'rgba(16,10,24,.85)', backdropFilter: 'blur(10px)', padding: `${6*V}px ${12*V}px`, borderRadius: 7*V, border: '1px solid rgba(160,120,255,.08)' },
  legItem: { display: 'flex', alignItems: 'center', gap: 4*V },
  legDot: { width: 7*V, height: 7*V, borderRadius: '50%' },
  legLbl: { fontSize: 9*V, color: 'rgba(255,255,255,.5)', letterSpacing: .5*V },
  zoomCtrl: { position: 'absolute', bottom: 14*V, right: 14*V, zIndex: 501, display: 'flex', flexDirection: 'column', gap: 1 },
  zoomBtn: { width: 30*V, height: 30*V, background: 'rgba(16,10,24,.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(160,120,255,.08)', color: 'rgba(255,255,255,.5)', fontSize: 15*V, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { position: 'absolute', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,10,18,.8)', fontFamily: 'Space Mono,monospace', fontSize: 14*V, color: '#60A5FA', letterSpacing: 2*V },

  right: { gridColumn: 2, gridRow: 3, background: '#0a0f1c', borderLeft: '1px solid rgba(100,140,255,.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 600 },
  detail: { padding: `${14*V}px ${15*V}px`, borderBottom: '1px solid rgba(100,140,255,.07)', flexShrink: 0 },
  detHdr: { display: 'flex', alignItems: 'center', gap: 10*V, marginBottom: 10*V },
  detIcon: { width: 38*V, height: 38*V, borderRadius: 10*V, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18*V, flexShrink: 0, border: '1px solid rgba(100,140,255,.09)' },
  detName: { fontSize: 15*V, fontWeight: 700, lineHeight: 1.25 },
  detLoc: { fontSize: 11*V, color: 'rgba(255,255,255,.3)', marginTop: 2*V, lineHeight: 1.3 },
  detBadgeRow: { display: 'flex', alignItems: 'center', gap: 5*V, marginBottom: 10*V, flexWrap: 'wrap' },
  dbadge: { fontSize: 10*V, fontWeight: 700, letterSpacing: 1.2*V, textTransform: 'uppercase', padding: `${2*V}px ${7*V}px`, borderRadius: 4*V, border: '1px solid' },
  cylLbl: { fontSize: 10*V, letterSpacing: 2*V, textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 5*V },
  cyls: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 3*V },
  cyl: { borderRadius: 6*V, padding: `${4*V}px ${2*V}px`, textAlign: 'center', border: '1px solid rgba(100,140,255,.09)', background: 'rgba(255,255,255,.025)' },
  cylName: { fontSize: 8*V, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginBottom: 2*V, lineHeight: 1.1 },
  cylTrack: { height: 30*V, borderRadius: 3*V, background: 'rgba(255,255,255,.03)', position: 'relative', overflow: 'hidden' },
  cylFill: { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 3*V, transition: 'height .9s ease' },
  cylPct: { fontFamily: 'Space Mono,monospace', fontSize: 9*V, position: 'absolute', bottom: 2*V, left: 0, right: 0, textAlign: 'center', lineHeight: 1 },
  detStats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4*V, marginTop: 9*V },
  ds: { background: 'rgba(255,255,255,.025)', borderRadius: 7*V, padding: `${6*V}px ${7*V}px`, border: '1px solid rgba(100,140,255,.09)' },
  dsV: { fontFamily: 'Bebas Neue,system-ui', fontSize: 20*V, color: '#60A5FA', lineHeight: 1 },
  dsL: { fontSize: 9*V, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: .8*V, marginTop: 1*V },

  rtxFeed: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  rtxHdr: { padding: `${9*V}px ${15*V}px ${5*V}px`, fontSize: 10*V, letterSpacing: 3*V, textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', flexShrink: 0 },
  rtxList: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3*V, padding: `0 ${8*V}px ${8*V}px` },
  rtx: { padding: `${7*V}px ${9*V}px`, borderRadius: 7*V, border: '1px solid rgba(100,140,255,.09)', background: 'rgba(255,255,255,.025)', display: 'flex', alignItems: 'center', gap: 7*V, flexShrink: 0 },
  rtxProd: { fontSize: 13*V, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rtxWhere: { fontSize: 11*V, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' },
  rtxAmt: { fontFamily: 'Bebas Neue,system-ui', fontSize: 18*V, color: '#60A5FA', flexShrink: 0 },
}; }
