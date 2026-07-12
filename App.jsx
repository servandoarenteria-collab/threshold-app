import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, Clock, Scissors, Settings, Check, X, Plus, Trash2, ChevronLeft, ChevronRight, Loader2, LogOut } from "lucide-react";

const SUPABASE_URL = "https://ojwjtvbeugjfnqekpfpv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hmcl41xWWsZ5J3VlgnIZfQ___Zh3N85";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_HOURS_SEED = [
  { day_of_week: 0, is_closed: true, open_time: "09:00", close_time: "17:00" },
  { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "17:00" },
  { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "17:00" },
  { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "17:00" },
  { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "17:00" },
  { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "15:00" },
  { day_of_week: 6, is_closed: true, open_time: "09:00", close_time: "17:00" },
];

// ---------- low-level Supabase REST + Auth helpers (no supabase-js needed) ----------
async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.msg || data?.message || `Auth error (${res.status})`);
  return data;
}

async function sbRest(path, { method = "GET", body, token, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers["Prefer"] = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function useFonts() {
  useEffect(() => {
    const id = "threshold-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap";
    document.head.appendChild(link);
  }, []);
}

function pad(n) { return String(n).padStart(2, "0"); }
function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function timeToMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(mins) { const h = Math.floor(mins / 60); const m = mins % 60; return `${pad(h)}:${pad(m)}`; }
function formatTime12(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m)} ${period}`;
}
function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function App() {
  useFonts();
  const [view, setView] = useState("customer");
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen bg-[#14181F] text-[#E9E6DD]">
      <TopNav view={view} setView={setView} />
      {view === "customer" ? <CustomerView /> : <AdminView />}
      <footer className="text-center text-xs text-[#5C5C52] py-8 px-6">
        Threshold — now backed by a real Supabase database. Data here is real and persists.
      </footer>
    </div>
  );
}

function TopNav({ view, setView }) {
  return (
    <div className="border-b border-[#262B34] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#14181F]/95 backdrop-blur z-10">
      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold tracking-tight text-[#E9E6DD]">Threshold</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#C99A56] font-mono" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>live</span>
      </div>
      <div className="flex gap-1 bg-[#1D222B] rounded-full p-1">
        <button onClick={() => setView("customer")} className={`px-4 py-1.5 rounded-full text-sm transition ${view === "customer" ? "bg-[#C99A56] text-[#14181F] font-medium" : "text-[#9A9A8C] hover:text-[#E9E6DD]"}`}>Booking page</button>
        <button onClick={() => setView("admin")} className={`px-4 py-1.5 rounded-full text-sm transition ${view === "admin" ? "bg-[#C99A56] text-[#14181F] font-medium" : "text-[#9A9A8C] hover:text-[#E9E6DD]"}`}>Business dashboard</button>
      </div>
    </div>
  );
}

function AvailabilityThread({ slots, selected, onSelect }) {
  if (slots.length === 0) return <p className="text-sm text-[#7A7A6E] py-6">No slots to show for this day.</p>;
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {slots.map((slot) => (
        <button key={slot.time} disabled={slot.taken} onClick={() => onSelect(slot.time)}
          className={`relative px-3 py-2 rounded-md text-sm font-mono transition border
            ${slot.taken ? "border-[#262B34] text-[#4A4A42] cursor-not-allowed line-through" : ""}
            ${!slot.taken && selected === slot.time ? "bg-[#C99A56] border-[#C99A56] text-[#14181F] font-semibold" : ""}
            ${!slot.taken && selected !== slot.time ? "border-[#3A4150] text-[#D8D5C9] hover:border-[#C99A56]" : ""}
          `} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {formatTime12(slot.time)}
        </button>
      ))}
    </div>
  );
}

function computeSlots(dateObj, service, dayHours, takenTimes) {
  if (!dayHours || dayHours.is_closed || !service) return [];
  const now = new Date();
  const isToday = toDateKey(now) === toDateKey(dateObj);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const openMins = timeToMinutes(dayHours.open_time);
  const closeMins = timeToMinutes(dayHours.close_time);
  const duration = service.duration_minutes;
  const slots = [];
  for (let t = openMins; t + duration <= closeMins; t += duration) {
    if (isToday && t <= nowMins) continue;
    const time = minutesToTime(t);
    slots.push({ time, taken: takenTimes.has(time) });
  }
  return slots;
}

// ============ CUSTOMER VIEW ============
function CustomerView() {
  const [slugInput, setSlugInput] = useState("");
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const findBusiness = async () => {
    const slug = slugify(slugInput);
    if (!slug) return;
    setLoading(true); setError("");
    try {
      const biz = await sbRest(`businesses?slug=eq.${slug}&select=id,name,slug,brand_color`);
      if (!biz.length) { setError("No business found with that link. Check the slug and try again."); setLoading(false); return; }
      const b = biz[0];
      const [svc, hrs] = await Promise.all([
        sbRest(`services?business_id=eq.${b.id}&active=eq.true&select=*`),
        sbRest(`business_hours?business_id=eq.${b.id}&select=*`),
      ]);
      setBusiness(b);
      setServices(svc);
      const hoursMap = {};
      hrs.forEach((h) => { hoursMap[h.day_of_week] = h; });
      setHours(hoursMap);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  if (!business) {
    return (
      <div className="max-w-md mx-auto px-6 py-24">
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl mb-2">Find a business</h1>
        <p className="text-sm text-[#8C8C7E] mb-6">Enter the business link (slug) to book with them. If you just created a business in the dashboard, use that slug here.</p>
        <div className="flex gap-2">
          <input value={slugInput} onChange={(e) => setSlugInput(e.target.value)} placeholder="e.g. joes-barbershop"
            className="flex-1 bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
          <button onClick={findBusiness} disabled={loading} className="bg-[#C99A56] text-[#14181F] font-medium rounded-md px-4 text-sm disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null} Go
          </button>
        </div>
        {error && <p className="text-sm text-[#B5573C] mt-3">{error}</p>}
      </div>
    );
  }

  return <BookingFlow business={business} services={services} hours={hours} onSwitchBusiness={() => setBusiness(null)} />;
}

function BookingFlow({ business, services, hours, onSwitchBusiness }) {
  const [dateObj, setDateObj] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [serviceId, setServiceId] = useState(services[0]?.id);
  const [selectedTime, setSelectedTime] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("pick");
  const [submitting, setSubmitting] = useState(false);
  const [takenTimes, setTakenTimes] = useState(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (services.length && !serviceId) setServiceId(services[0].id); }, [services]);
  useEffect(() => { setSelectedTime(null); }, [dateObj, serviceId]);

  useEffect(() => {
    (async () => {
      setLoadingSlots(true);
      try {
        const dateKey = toDateKey(dateObj);
        const rows = await sbRest(`public_availability?business_id=eq.${business.id}&booking_date=eq.${dateKey}&select=booking_time`);
        setTakenTimes(new Set(rows.map((r) => r.booking_time.slice(0, 5))));
      } catch (e) {
        setError(e.message);
      }
      setLoadingSlots(false);
    })();
  }, [dateObj, business.id]);

  const service = services.find((s) => s.id === serviceId);
  const dayHours = hours[dateObj.getDay()];
  const slots = useMemo(() => computeSlots(dateObj, service, dayHours, takenTimes), [dateObj, service, dayHours, takenTimes]);

  const shiftDay = (delta) => {
    const d = new Date(dateObj); d.setDate(d.getDate() + delta); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d < today) return;
    setDateObj(d);
  };

  const confirmBooking = async () => {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true); setError("");
    try {
      await sbRest("bookings", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          business_id: business.id,
          service_id: serviceId,
          customer_name: name.trim(),
          customer_email: email.trim(),
          booking_date: toDateKey(dateObj),
          booking_time: selectedTime,
          status: "confirmed",
        },
      });
      setStep("confirmed");
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  };

  if (step === "confirmed") {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-[#4B7A6B] flex items-center justify-center mx-auto mb-6"><Check size={22} className="text-white" /></div>
        <h2 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl mb-2">You're booked.</h2>
        <p className="text-[#9A9A8C] mb-1">{service?.name} on {dateObj.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at {formatTime12(selectedTime)}.</p>
        <p className="text-sm text-[#7A7A6E] mb-8">This booking is saved for real — {business.name} will see it in their dashboard.</p>
        <button onClick={() => { setStep("pick"); setSelectedTime(null); setName(""); setEmail(""); }} className="text-sm text-[#C99A56] hover:underline">Book another appointment</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <button onClick={onSwitchBusiness} className="text-xs text-[#7A7A6E] hover:text-[#C99A56] mb-4">← switch business</button>
      <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl mb-1">Book with {business.name}</h1>
      <p className="text-[#8C8C7E] mb-8 text-sm">Pick a service, then a time that works.</p>

      {services.length === 0 ? (
        <p className="text-sm text-[#7A7A6E]">This business hasn't added any services yet.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-8 flex-wrap">
            {services.map((s) => (
              <button key={s.id} onClick={() => setServiceId(s.id)}
                className={`px-4 py-2.5 rounded-lg text-sm border transition text-left ${serviceId === s.id ? "border-[#C99A56] bg-[#C99A56]/10" : "border-[#262B34] hover:border-[#3A4150]"}`}>
                <div className="font-medium text-[#E9E6DD]">{s.name}</div>
                <div className="text-xs text-[#8C8C7E]">{s.duration_minutes} min{s.price_cents > 0 ? ` · $${(s.price_cents / 100).toFixed(2)}` : " · free"}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-1">
            <button onClick={() => shiftDay(-1)} className="p-1.5 rounded hover:bg-[#1D222B] text-[#8C8C7E]"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar size={15} className="text-[#C99A56]" />
              {dateObj.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <button onClick={() => shiftDay(1)} className="p-1.5 rounded hover:bg-[#1D222B] text-[#8C8C7E]"><ChevronRight size={18} /></button>
          </div>

          {loadingSlots ? (
            <div className="py-6 flex items-center gap-2 text-sm text-[#7A7A6E]"><Loader2 size={14} className="animate-spin" /> Checking availability…</div>
          ) : dayHours?.is_closed ? (
            <p className="text-sm text-[#7A7A6E] py-6 text-center">Closed this day. Try another.</p>
          ) : (
            <AvailabilityThread slots={slots} selected={selectedTime} onSelect={setSelectedTime} />
          )}

          {selectedTime && (
            <div className="mt-8 border-t border-[#262B34] pt-6 space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#7A7A6E] mb-1.5">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                  className="w-full bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm text-[#E9E6DD] outline-none focus:border-[#C99A56]" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[#7A7A6E] mb-1.5">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email"
                  className="w-full bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm text-[#E9E6DD] outline-none focus:border-[#C99A56]" />
              </div>
              {error && <p className="text-sm text-[#B5573C]">{error}</p>}
              <button onClick={confirmBooking} disabled={!name.trim() || !email.trim() || submitting}
                className="w-full bg-[#C99A56] text-[#14181F] font-medium rounded-md py-2.5 text-sm mt-2 disabled:opacity-40 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                Confirm {formatTime12(selectedTime)} on {dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ ADMIN VIEW ============
function AdminView() {
  const [session, setSession] = useState(null); // { token, userId, email }
  const [business, setBusiness] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkBusiness = useCallback(async (token, userId) => {
    setChecking(true);
    try {
      const memberships = await sbRest(`business_users?user_id=eq.${userId}&select=business_id`, { token });
      if (memberships.length) {
        const biz = await sbRest(`businesses?id=eq.${memberships[0].business_id}&select=*`, { token });
        setBusiness(biz[0] || null);
      } else {
        setBusiness(null);
      }
    } catch (e) {
      // swallow — will show create-business form
    }
    setChecking(false);
  }, []);

  if (!session) return <AuthForm onAuthed={(s) => { setSession(s); checkBusiness(s.token, s.userId); }} />;
  if (checking) return <div className="flex items-center justify-center py-32 text-[#8C8C7E]"><Loader2 className="animate-spin mr-2" size={18} /> Loading your business…</div>;
  if (!business) return <CreateBusinessForm token={session.token} userId={session.userId} onCreated={setBusiness} />;

  return <Dashboard session={session} business={business} onSignOut={() => { setSession(null); setBusiness(null); }} />;
}

function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        const data = await sbAuth("signup", { email: email.trim(), password });
        if (data.access_token) {
          onAuthed({ token: data.access_token, userId: data.user.id, email: data.user.email });
        } else {
          setMessage("Account created. Check your email to confirm, then switch to Log in.");
          setMode("login");
        }
      } else {
        const data = await sbAuth("token?grant_type=password", { email: email.trim(), password });
        onAuthed({ token: data.access_token, userId: data.user.id, email: data.user.email });
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-sm mx-auto px-6 py-24">
      <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl mb-1">{mode === "signup" ? "Create your business account" : "Log in"}</h1>
      <p className="text-sm text-[#8C8C7E] mb-6">{mode === "signup" ? "This is you, the business owner — not a customer." : "Welcome back."}</p>
      <div className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
          className="w-full bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 characters)" type="password"
          className="w-full bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
        {error && <p className="text-sm text-[#B5573C]">{error}</p>}
        {message && <p className="text-sm text-[#C99A56]">{message}</p>}
        <button onClick={submit} disabled={loading || !email.trim() || password.length < 6}
          className="w-full bg-[#C99A56] text-[#14181F] font-medium rounded-md py-2.5 text-sm disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : null} {mode === "signup" ? "Sign up" : "Log in"}
        </button>
        <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setMessage(""); }} className="w-full text-xs text-[#7A7A6E] hover:text-[#C99A56]">
          {mode === "signup" ? "Already have an account? Log in" : "New here? Sign up"}
        </button>
      </div>
    </div>
  );
}

function CreateBusinessForm({ token, userId, onCreated }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setLoading(true); setError("");
    try {
      const finalSlug = slugify(slug || name);
      const biz = await sbRest("businesses", { method: "POST", token, prefer: "return=representation", body: { name: name.trim(), slug: finalSlug } });
      const businessId = biz[0].id;
      await sbRest("business_users", { method: "POST", token, prefer: "return=minimal", body: { business_id: businessId, user_id: userId, role: "owner" } });
      await sbRest("business_hours", { method: "POST", token, prefer: "return=minimal", body: DEFAULT_HOURS_SEED.map((h) => ({ ...h, business_id: businessId })) });
      onCreated(biz[0]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-sm mx-auto px-6 py-24">
      <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl mb-1">Name your business</h1>
      <p className="text-sm text-[#8C8C7E] mb-6">This becomes your customer booking link.</p>
      <div className="space-y-3">
        <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Business name"
          className="w-full bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
        <div>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="booking-link-slug"
            className="w-full bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56] font-mono" />
          <p className="text-[10px] text-[#5C5C52] mt-1">Customers will use this slug on the booking page.</p>
        </div>
        {error && <p className="text-sm text-[#B5573C]">{error}</p>}
        <button onClick={create} disabled={loading || !name.trim()}
          className="w-full bg-[#C99A56] text-[#14181F] font-medium rounded-md py-2.5 text-sm disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : null} Create business
        </button>
      </div>
    </div>
  );
}

function Dashboard({ session, business, onSignOut }) {
  const [tab, setTab] = useState("bookings");
  const [services, setServices] = useState([]);
  const [hours, setHours] = useState({});
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [svc, hrs, bks] = await Promise.all([
      sbRest(`services?business_id=eq.${business.id}&select=*`, { token: session.token }),
      sbRest(`business_hours?business_id=eq.${business.id}&select=*`, { token: session.token }),
      sbRest(`bookings?business_id=eq.${business.id}&select=*&order=booking_date.asc,booking_time.asc`, { token: session.token }),
    ]);
    setServices(svc);
    const hoursMap = {}; hrs.forEach((h) => { hoursMap[h.day_of_week] = h; });
    setHours(hoursMap);
    setBookings(bks);
    setLoading(false);
  }, [business.id, session.token]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-1">
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl flex items-center gap-2">
          <Settings size={20} className="text-[#C99A56]" /> {business.name}
        </h1>
        <button onClick={onSignOut} className="text-xs text-[#7A7A6E] hover:text-[#B5573C] flex items-center gap-1"><LogOut size={13} /> Sign out</button>
      </div>
      <p className="text-xs text-[#5C5C52] font-mono mb-6" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        Booking link slug: {business.slug}
      </p>
      <div className="flex gap-6 border-b border-[#262B34] mb-6 text-sm">
        {[["bookings", "Upcoming bookings"], ["services", "Services"], ["hours", "Hours"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`pb-3 -mb-px border-b-2 ${tab === key ? "border-[#C99A56] text-[#E9E6DD]" : "border-transparent text-[#7A7A6E]"}`}>{label}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#7A7A6E] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <>
          {tab === "bookings" && <BookingsTab token={session.token} bookings={bookings} onChanged={reload} />}
          {tab === "services" && <ServicesTab token={session.token} businessId={business.id} services={services} onChanged={reload} />}
          {tab === "hours" && <HoursTab token={session.token} businessId={business.id} hours={hours} onChanged={reload} />}
        </>
      )}
    </div>
  );
}

function BookingsTab({ token, bookings, onChanged }) {
  const cancel = async (id) => {
    await sbRest(`bookings?id=eq.${id}`, { method: "PATCH", token, prefer: "return=minimal", body: { status: "cancelled" } });
    onChanged();
  };
  if (bookings.length === 0) return <p className="text-sm text-[#7A7A6E]">No bookings yet. Once a customer books through your link, it shows up here.</p>;
  return (
    <div className="space-y-2">
      {bookings.map((b) => (
        <div key={b.id} className={`flex items-center justify-between border border-[#262B34] rounded-lg px-4 py-3 ${b.status === "cancelled" ? "opacity-40" : ""}`}>
          <div>
            <div className="text-sm font-medium">{b.customer_name}</div>
            <div className="text-xs text-[#8C8C7E] font-mono" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {b.booking_date} · {formatTime12(b.booking_time.slice(0, 5))} · {b.customer_email}
            </div>
          </div>
          {b.status !== "cancelled" && (
            <button onClick={() => cancel(b.id)} className="text-xs text-[#B5573C] hover:underline flex items-center gap-1"><X size={13} /> Cancel</button>
          )}
        </div>
      ))}
    </div>
  );
}

function ServicesTab({ token, businessId, services, onChanged }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await sbRest("services", {
      method: "POST", token, prefer: "return=minimal",
      body: { business_id: businessId, name: name.trim(), duration_minutes: Number(duration), price_cents: Math.round(Number(price) * 100), active: true },
    });
    setName(""); setDuration(30); setPrice(0);
    setSaving(false);
    onChanged();
  };
  const remove = async (id) => {
    await sbRest(`services?id=eq.${id}`, { method: "DELETE", token, prefer: "return=minimal" });
    onChanged();
  };

  return (
    <div>
      <div className="space-y-2 mb-6">
        {services.map((s) => (
          <div key={s.id} className="flex items-center justify-between border border-[#262B34] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm"><Scissors size={14} className="text-[#C99A56]" /> {s.name} <span className="text-[#7A7A6E]">· {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}</span></div>
            <button onClick={() => remove(s.id)} className="text-[#7A7A6E] hover:text-[#B5573C]"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="border border-dashed border-[#3A4150] rounded-lg p-4 grid grid-cols-3 gap-3">
        <input placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3 bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
        <input type="number" placeholder="Minutes" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
        <input type="number" placeholder="Price $" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-[#1D222B] border border-[#262B34] rounded-md px-3 py-2 text-sm outline-none focus:border-[#C99A56]" />
        <button onClick={add} disabled={saving} className="bg-[#C99A56] text-[#14181F] rounded-md text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </button>
      </div>
    </div>
  );
}

function HoursTab({ token, businessId, hours, onChanged }) {
  const [local, setLocal] = useState(hours);
  const [savingDay, setSavingDay] = useState(null);
  useEffect(() => { setLocal(hours); }, [hours]);

  const update = (dayIdx, field, value) => {
    setLocal({ ...local, [dayIdx]: { ...local[dayIdx], [field]: value } });
  };
  const save = async (dayIdx) => {
    setSavingDay(dayIdx);
    const d = local[dayIdx];
    await sbRest(`business_hours?business_id=eq.${businessId}&day_of_week=eq.${dayIdx}`, {
      method: "PATCH", token, prefer: "return=minimal",
      body: { is_closed: d.is_closed, open_time: d.open_time, close_time: d.close_time },
    });
    setSavingDay(null);
    onChanged();
  };

  return (
    <div className="space-y-2">
      {DAY_LABELS.map((label, idx) => {
        const d = local[idx] || { is_closed: true, open_time: "09:00", close_time: "17:00" };
        return (
          <div key={idx} className="flex items-center gap-3 border border-[#262B34] rounded-lg px-4 py-2.5">
            <span className="w-24 text-sm">{label}</span>
            <label className="flex items-center gap-1.5 text-xs text-[#8C8C7E]">
              <input type="checkbox" checked={!d.is_closed} onChange={(e) => update(idx, "is_closed", !e.target.checked)} /> Open
            </label>
            {!d.is_closed && (
              <>
                <input type="time" value={d.open_time} onChange={(e) => update(idx, "open_time", e.target.value)} className="bg-[#1D222B] border border-[#262B34] rounded-md px-2 py-1 text-sm" />
                <ChevronRight size={13} className="text-[#4A4A42]" />
                <input type="time" value={d.close_time} onChange={(e) => update(idx, "close_time", e.target.value)} className="bg-[#1D222B] border border-[#262B34] rounded-md px-2 py-1 text-sm" />
              </>
            )}
            <button onClick={() => save(idx)} disabled={savingDay === idx} className="ml-auto text-xs text-[#C99A56] hover:underline disabled:opacity-40">
              {savingDay === idx ? "Saving…" : "Save"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
