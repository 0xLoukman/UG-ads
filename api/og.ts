import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title') || 'Special Offer';
    const subtitle = searchParams.get('subtitle') || 'Save on your next stay when you book direct.';
    const cta = searchParams.get('cta') || 'Book Now';
    const image = searchParams.get('image') || '';
    const logo = searchParams.get('logo') || '';
    const accent = searchParams.get('accent') || '#2563eb';
    const font = searchParams.get('font') || 'Inter';
    const hc = searchParams.get('hc') || '#ffffff';
    const bc = searchParams.get('bc') || '#ffffff';
    const cc = searchParams.get('cc') || '#ffffff';
    const template = searchParams.get('template') || 'overlay';
    const w = Math.max(100, Math.min(2000, parseInt(searchParams.get('w') || '1200', 10)));
    const h = Math.max(100, Math.min(2000, parseInt(searchParams.get('h') || '630', 10)));

    const fontFamily = font;

    const base = (
      <div
        style={{
          width: w,
          height: h,
          fontFamily: `${fontFamily}, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
          position: 'relative',
          display: 'flex',
        }}
      >
        {image ? (
          <img src={image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        {template === 'overlay' || template === 'center-hero' ? (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.4), rgba(0,0,0,.35))' }} />
        ) : null}

        {template === 'text-panel' ? (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,.95)', borderTop: '1px solid #e5e7eb', padding: 24, color: '#111' }}>
            <div style={{ fontWeight: 800, lineHeight: 1.1, color: hc, fontSize: Math.max(16, Math.round(h*0.12)) }}>{title}</div>
            <div style={{ opacity: .85, color: bc, fontSize: Math.max(12, Math.round(h*0.08)), marginTop: 4 }}>{subtitle}</div>
            <div style={{ marginTop: 8, display: 'flex' }}>
              <div style={{ display: 'inline-flex', background: accent, color: cc, padding: '10px 16px', borderRadius: 999, fontWeight: 700, fontSize: Math.max(12, Math.round(h*0.07)) }}>{cta}</div>
            </div>
            {logo ? <img src={logo} style={{ position: 'absolute', top: 12, right: 12, height: Math.max(18, Math.round(h*0.1)) }} /> : null}
          </div>
        ) : template === 'split' ? (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.round(w*0.42), background: 'rgba(255,255,255,.95)', borderRight: '1px solid #e5e7eb', padding: 24, color: '#111' }}>
            <div style={{ fontWeight: 800, lineHeight: 1.1, color: hc, fontSize: Math.max(16, Math.round(h*0.12)) }}>{title}</div>
            <div style={{ opacity: .85, color: bc, fontSize: Math.max(12, Math.round(h*0.08)), marginTop: 4 }}>{subtitle}</div>
            <div style={{ marginTop: 8, display: 'flex' }}>
              <div style={{ display: 'inline-flex', background: accent, color: '#fff', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: Math.max(12, Math.round(h*0.07)) }}>{cta}</div>
            </div>
            {logo ? <img src={logo} style={{ position: 'absolute', bottom: 12, left: 12, height: Math.max(18, Math.round(h*0.1)) }} /> : null}
          </div>
        ) : template === 'center-hero' ? (
          <>
            {logo ? <img src={logo} style={{ position: 'absolute', top: 12, right: 12, height: Math.max(18, Math.round(h*0.1)) }} /> : null}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', textAlign: 'center' }}>
              <div style={{ letterSpacing: '.02em', color: hc, fontWeight: 800, fontSize: Math.max(20, Math.round(h*0.14)) }}>{title}</div>
              <div style={{ opacity: .95, color: bc, marginTop: 6, fontSize: Math.max(12, Math.round(h*0.08)) }}>{subtitle}</div>
              <div style={{ marginTop: 10, display: 'inline-flex', border: `2px solid ${accent}`, color: cc, padding: '8px 14px', borderRadius: 8, fontWeight: 700, background: 'transparent', fontSize: Math.max(12, Math.round(h*0.07)) }}>{cta}</div>
            </div>
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 24 }}>
            <div style={{ fontWeight: 800, lineHeight: 1.1, color: hc, fontSize: Math.max(16, Math.round(h*0.12)) }}>{title}</div>
            <div style={{ opacity: .95, color: bc, fontSize: Math.max(12, Math.round(h*0.08)), marginTop: 6 }}>{subtitle}</div>
            <div style={{ marginTop: 10, display: 'inline-flex', background: accent, color: '#fff', padding: '10px 16px', borderRadius: 999, fontWeight: 700, fontSize: Math.max(12, Math.round(h*0.07)) }}>{cta}</div>
          </div>
        )}
      </div>
    );

    return new ImageResponse(base, { width: w, height: h });
  } catch (e: any) {
    return new Response('Failed to generate image', { status: 500 });
  }
}