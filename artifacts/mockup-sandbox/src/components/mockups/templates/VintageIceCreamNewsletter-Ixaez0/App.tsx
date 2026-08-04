import { useState } from 'react';
import { Monitor, Smartphone, MapPin, Instagram, Facebook, Twitter, ArrowRight, Star, Snowflake } from 'lucide-react';

const FLAVORS = [
  {
    name: 'Roasted Pistachio & Sea Salt',
    desc: 'Sicilian pistachios roasted in-house, folded into a salted sweet cream base.',
    price: '$14',
    img: 'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=600&h=600&fit=crop',
  },
  {
    name: 'Brown Butter Fig Leaf',
    desc: 'Fig leaves steeped overnight, finished with brown butter shortbread.',
    price: '$15',
    img: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=600&h=600&fit=crop',
  },
  {
    name: 'Bittersweet Cocoa Sorbetto',
    desc: '72% Ecuadorian cacao, water, sugar. Nothing else. Dairy-free, no apologies.',
    price: '$13',
    img: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=600&fit=crop',
  },
];

export default function App() {
  const [device, setDevice] = useState('desktop');
  const isMobile = device === 'mobile';
  const emailWidth = isMobile ? 380 : 640;

  return (
    <div className="min-h-screen bg-[#EFE6D4] py-10 px-4" style={{ fontFamily: "'Karla', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,100&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        .cg-email { transition: max-width 0.45s cubic-bezier(.4,0,.2,1); }
        .cg-cta { transition: background 0.2s ease, transform 0.2s ease; }
        .cg-cta:hover { background: #1d1208 !important; transform: translateY(-1px); }
        .cg-gold-cta:hover { background: #b07a14 !important; }
        .cg-flavor-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .cg-flavor-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px -12px rgba(43,26,18,0.35); }
        .cg-link:hover { color: #C8861B; }
        .ticker { animation: tick 22s linear infinite; }
        @keyframes tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}} />

      {/* Preview chrome */}
      <div className="max-w-[640px] mx-auto mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#2B1A12] flex items-center justify-center">
            <Snowflake size={14} className="text-[#E9B949]" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a7458] font-bold">Email Preview</p>
            <p className="text-[13px] text-[#2B1A12] font-semibold -mt-0.5">The Churn Report — October Drop</p>
          </div>
        </div>
        <div className="flex bg-[#E2D6BE] rounded-full p-1 gap-1">
          <button onClick={() => setDevice('desktop')} className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[12px] font-bold transition-colors ${!isMobile ? 'bg-[#2B1A12] text-[#F6EDDC]' : 'text-[#8a7458] hover:text-[#2B1A12]'}`}>
            <Monitor size={13} /> Desktop
          </button>
          <button onClick={() => setDevice('mobile')} className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[12px] font-bold transition-colors ${isMobile ? 'bg-[#2B1A12] text-[#F6EDDC]' : 'text-[#8a7458] hover:text-[#2B1A12]'}`}>
            <Smartphone size={13} /> Mobile
          </button>
        </div>
      </div>

      {/* The email */}
      <div className="cg-email mx-auto shadow-[0_30px_80px_-30px_rgba(43,26,18,0.45)]" style={{ maxWidth: emailWidth }}>

        {/* Preheader */}
        <div className="bg-[#2B1A12] text-[#C9B698] text-[11px] tracking-wide px-6 py-2.5 flex justify-between">
          <span>Burnt Honey & Black Sesame is back. Briefly.</span>
          {!isMobile && <span className="underline cursor-pointer hover:text-[#E9B949]">View in browser</span>}
        </div>

        {/* Header */}
        <div className="bg-[#FBF4E3] px-8 pt-9 pb-7 text-center border-b border-[#E6D9BF]">
          <p className="text-[10px] tracking-[0.45em] uppercase text-[#C8861B] font-bold mb-3">Small Batch · Brooklyn, NY</p>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }} className="text-[#2B1A12] text-[44px] leading-none tracking-tight">
            COLD GOLD
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="h-px w-10 bg-[#C8861B]" />
            <p className="text-[11px] tracking-[0.3em] uppercase text-[#7a6347]">The Churn Report · No. 47</p>
            <span className="h-px w-10 bg-[#C8861B]" />
          </div>
        </div>

        {/* Hero */}
        <div className="bg-[#FBF4E3]">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=1200&h=800&fit=crop"
              alt="Burnt Honey & Black Sesame scoops"
              className="w-full object-cover"
              style={{ height: isMobile ? 260 : 360 }}
            />
            <div className="absolute top-4 left-4 bg-[#E9B949] text-[#2B1A12] text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-2 rotate-[-2deg] shadow-md">
              October Drop
            </div>
          </div>
          <div className={`px-8 ${isMobile ? 'py-8' : 'py-10'} text-center`}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-[#C8861B] font-bold mb-3">Flavor of the Month</p>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: 'italic' }} className={`text-[#2B1A12] ${isMobile ? 'text-[30px]' : 'text-[38px]'} leading-[1.1] mb-4`}>
              Burnt Honey &<br />Black Sesame
            </h2>
            <p className="text-[#5d4a35] text-[15px] leading-relaxed max-w-[440px] mx-auto mb-6">
              We torch wildflower honey until it's two seconds from ruined, then swirl it through a base laced
              with stone-ground black sesame from Wadaman in Osaka. Smoky, nutty, almost savory — and gone by
              Halloween. We made 312 pints. That's it.
            </p>
            <div className="flex items-center justify-center gap-6 mb-7 text-[12px] text-[#7a6347]">
              <span className="flex items-center gap-1"><Star size={13} className="text-[#C8861B] fill-[#C8861B]" /> 4.9 from the pint club</span>
              <span>·</span>
              <span>312 pints churned</span>
            </div>
            <a href="#" className="cg-cta inline-block bg-[#2B1A12] text-[#F6EDDC] text-[13px] font-bold tracking-[0.15em] uppercase px-9 py-4">
              Reserve Your Pint — $16
            </a>
            <p className="text-[11px] text-[#a08a6a] mt-3">Free pickup at the Greenpoint scoop shop · Ships nationwide on dry ice</p>
          </div>
        </div>

        {/* Ticker divider */}
        <div className="bg-[#C8861B] overflow-hidden py-2.5">
          <div className="ticker whitespace-nowrap text-[#2B1A12] text-[11px] font-bold tracking-[0.25em] uppercase">
            {Array(2).fill('Churned in 9-quart batches ✦ No stabilizers ✦ Grass-fed Hudson Valley dairy ✦ ').map((t, i) => <span key={i}>{t.repeat(3)}</span>)}
          </div>
        </div>

        {/* New flavors */}
        <div className={`bg-[#F4EAD5] px-8 ${isMobile ? 'py-9' : 'py-12'}`}>
          <div className="text-center mb-8">
            <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 800 }} className="text-[#2B1A12] text-[26px] mb-2">Also in the case this month</h3>
            <p className="text-[13px] text-[#7a6347]">Three new pints joining the lineup, while supplies last.</p>
          </div>
          <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {FLAVORS.map((f) => (
              <div key={f.name} className="cg-flavor-card bg-[#FBF4E3] border border-[#E0D2B4]">
                <img src={f.img} alt={f.name} className="w-full h-[150px] object-cover" />
                <div className="p-5">
                  <h4 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }} className="text-[#2B1A12] text-[16px] leading-snug mb-2">{f.name}</h4>
                  <p className="text-[12.5px] text-[#6b5740] leading-relaxed mb-4">{f.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[#C8861B] font-bold text-[14px]">{f.price} / pint</span>
                    <a href="#" className="cg-link text-[11px] font-bold uppercase tracking-[0.15em] text-[#2B1A12] flex items-center gap-1">
                      Add <ArrowRight size={12} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pint club */}
        <div className={`bg-[#2B1A12] px-8 ${isMobile ? 'py-10' : 'py-12'} text-center relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#E9B949 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          <div className="relative">
            <p className="text-[10px] tracking-[0.4em] uppercase text-[#E9B949] font-bold mb-3">The Pint Club</p>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: 'italic' }} className={`text-[#F6EDDC] ${isMobile ? 'text-[26px]' : 'text-[32px]'} leading-tight mb-4`}>
              Four pints. Every month.<br />Before anyone else.
            </h3>
            <p className="text-[#C9B698] text-[14px] leading-relaxed max-w-[400px] mx-auto mb-7">
              Members get first dibs on every drop, two club-exclusive flavors a year, and a standing 10% at the
              scoop shop. Refer a friend in October and you'll both get a pint of the Burnt Honey on us.
            </p>
            <a href="#" className="cg-cta cg-gold-cta inline-block bg-[#C8861B] text-[#2B1A12] text-[13px] font-bold tracking-[0.15em] uppercase px-9 py-4">
              Join for $54 / month
            </a>
          </div>
        </div>

        {/* Scoop shop note */}
        <div className={`bg-[#FBF4E3] px-8 ${isMobile ? 'py-9' : 'py-10'}`}>
          <div className={`flex ${isMobile ? 'flex-col gap-5' : 'items-center gap-7'}`}>
            <img
              src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=600&fit=crop"
              alt="Greenpoint scoop shop"
              className={`object-cover ${isMobile ? 'w-full h-[180px]' : 'w-[200px] h-[200px]'}`}
            />
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#C8861B] font-bold mb-2 flex items-center gap-1.5">
                <MapPin size={12} /> Greenpoint Scoop Shop
              </p>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }} className="text-[#2B1A12] text-[22px] mb-2">Sundae Hours, Saturday Oct 19</h3>
              <p className="text-[13.5px] text-[#6b5740] leading-relaxed mb-3">
                Affogato bar with Sey Coffee, hot honey drizzle station, and the last public tasting of the
                Black Sesame before it retires. 12–4pm at 117 Franklin St. No tickets — just show up cold.
              </p>
              <a href="#" className="cg-link text-[12px] font-bold uppercase tracking-[0.15em] text-[#2B1A12] flex items-center gap-1">
                Get directions <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#231409] px-8 py-9 text-center">
          <h4 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }} className="text-[#E9B949] text-[20px] tracking-tight mb-4">COLD GOLD</h4>
          <div className="flex justify-center gap-4 mb-5">
            {[Instagram, Facebook, Twitter].map((Icon, i) => (
              <a key={i} href="#" className="w-9 h-9 rounded-full border border-[#4a3826] flex items-center justify-center text-[#C9B698] hover:text-[#E9B949] hover:border-[#E9B949] transition-colors">
                <Icon size={15} />
              </a>
            ))}
          </div>
          <p className="text-[11px] text-[#8a7458] leading-relaxed mb-4">
            Cold Gold Creamery · 117 Franklin St, Brooklyn NY 11222<br />
            You're receiving this because you signed up at the shop or online — good call.
          </p>
          <div className="text-[11px] text-[#8a7458] flex justify-center gap-4">
            <a href="#" className="underline hover:text-[#E9B949]">Manage preferences</a>
            <a href="#" className="underline hover:text-[#E9B949]">Unsubscribe</a>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#a08a6a] mt-6 tracking-wide">600px-safe layout · table-friendly structure · tested in dark mode clients</p>
    </div>
  );
}