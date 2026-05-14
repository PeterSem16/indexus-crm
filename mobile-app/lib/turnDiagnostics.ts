import { api } from './api';

export type DiagStatus = 'pending' | 'running' | 'ok' | 'warn' | 'fail';

export interface DiagTest {
  id: string;
  name: string;
  detail: string;
  status: DiagStatus;
  ms?: number;
}

async function testFetch(url: string, timeoutMs = 6000): Promise<{ ok: boolean; ms: number; error: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: true, ms: Date.now() - t0, error: '' };
  } catch (e: any) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const blocked = e?.name === 'AbortError' || ms >= timeoutMs - 200;
    return { ok: !blocked, ms, error: e?.message || String(e) };
  }
}

async function testIceServer(
  urls: string | string[],
  username?: string,
  credential?: string,
  timeoutMs = 8000
): Promise<{ types: string[]; ms: number; error: string }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const types: string[] = [];
    let settled = false;

    const done = (err = '') => {
      if (settled) return;
      settled = true;
      try { (pc as any)?.close(); } catch {}
      resolve({ types, ms: Date.now() - t0, error: err });
    };

    let RTCPeerConnection: any;
    try {
      RTCPeerConnection = require('react-native-webrtc').RTCPeerConnection;
    } catch (e: any) {
      resolve({ types: [], ms: 0, error: 'WebRTC not available: ' + e?.message });
      return;
    }

    let pc: any;
    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls, username, credential }],
        iceCandidatePoolSize: 2,
      });
    } catch (e: any) {
      resolve({ types: [], ms: 0, error: 'RTCPeerConnection create failed: ' + e?.message });
      return;
    }

    const timer = setTimeout(() => done('timeout'), timeoutMs);

    pc.onicecandidate = (e: any) => {
      if (e?.candidate) {
        if (!types.includes(e.candidate.type)) {
          types.push(e.candidate.type);
        }
      } else {
        clearTimeout(timer);
        done();
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        done();
      }
    };

    pc.onicecandidateerror = (e: any) => {
      if (e?.errorCode >= 700) {
        // TURN auth or unreachable — note it but don't abort, wait for timeout
      }
    };

    try {
      pc.createDataChannel('diag');
      pc.createOffer()
        .then((offer: any) => pc.setLocalDescription(offer))
        .catch((e: any) => { clearTimeout(timer); done(e?.message); });
    } catch (e: any) {
      clearTimeout(timer);
      done(e?.message);
    }
  });
}

export async function runDiagnostics(
  onProgress: (tests: DiagTest[]) => void
): Promise<DiagTest[]> {
  const tests: DiagTest[] = [
    { id: 'internet', name: 'Internet (google.com)', detail: 'Čakám...', status: 'pending' },
    { id: 'turn_https', name: 'TCP :443 → TURN server', detail: 'Čakám...', status: 'pending' },
    { id: 'stun_google', name: 'STUN Google :19302/UDP', detail: 'Čakám...', status: 'pending' },
    { id: 'turn_443', name: 'TURN :443/TLS relay', detail: 'Čakám...', status: 'pending' },
    { id: 'turn_5350', name: 'TURN :5350/TLS relay', detail: 'Čakám...', status: 'pending' },
    { id: 'turn_3478_tcp', name: 'TURN :3478/TCP relay', detail: 'Čakám...', status: 'pending' },
    { id: 'turn_3478_udp', name: 'TURN :3478/UDP relay', detail: 'Čakám...', status: 'pending' },
  ];

  const emit = () => onProgress([...tests]);
  const set = (id: string, p: Partial<DiagTest>) => {
    const i = tests.findIndex(t => t.id === id);
    if (i >= 0) { tests[i] = { ...tests[i], ...p }; emit(); }
  };

  emit();

  // Fetch TURN credentials
  let turnHost = 'turn.cordbloodcenter.com';
  let turnUser: string | undefined;
  let turnPass: string | undefined;
  let turnServers: { urls: string; username?: string; credential?: string }[] = [];

  try {
    const creds = await api.get<any>('/api/mobile/sip/credentials');
    if (Array.isArray(creds?.turnServers) && creds.turnServers.length > 0) {
      turnServers = creds.turnServers;
      turnUser = creds.turnServers[0]?.username;
      turnPass = creds.turnServers[0]?.credential;
      try {
        const firstUrl = creds.turnServers[0]?.urls || '';
        const m = firstUrl.match(/(?:turns?:\/?\/?)?([^:/?]+)/);
        if (m?.[1]) turnHost = m[1];
      } catch {}
    }
  } catch (e: any) {
    set('internet', { status: 'warn', detail: `Nepodarilo sa načítať TURN konfigu: ${e?.message || '?'}` });
  }

  // 1. Internet
  set('internet', { status: 'running', detail: 'Testujem HTTPS dosah...' });
  const r1 = await testFetch('https://www.google.com', 6000);
  set('internet', {
    status: r1.ok ? 'ok' : 'fail', ms: r1.ms,
    detail: r1.ok
      ? `Dosažiteľný (${r1.ms}ms)`
      : `NEDOSAŽITEĽNÝ — ${r1.error || 'timeout'}`
  });

  // 2. TCP port 443 na TURN serveri
  set('turn_https', { status: 'running', detail: `Testujem TCP:443 na ${turnHost}...` });
  const r2 = await testFetch(`https://${turnHost}:443`, 7000);
  set('turn_https', {
    status: r2.ok ? 'ok' : 'fail', ms: r2.ms,
    detail: r2.ok
      ? `TCP port 443 otvorený (${r2.ms}ms)`
      : `Port 443 BLOKOVANÝ alebo DNS zlyhalo (${r2.ms}ms)`
  });

  // 3. STUN Google UDP
  set('stun_google', { status: 'running', detail: 'Testujem UDP STUN...' });
  const r3 = await testIceServer('stun:stun.l.google.com:19302', undefined, undefined, 7000);
  const hasSrflx = r3.types.includes('srflx');
  set('stun_google', {
    status: hasSrflx ? 'ok' : 'warn', ms: r3.ms,
    detail: hasSrflx
      ? `UDP dosažiteľný, srflx candidate (${r3.ms}ms)`
      : `Žiadny srflx — UDP :19302 blokovaný (${r3.ms}ms)${r3.error ? ' ' + r3.error : ''}`
  });

  // 4. TURN :443/TLS (cez nginx SNI)
  set('turn_443', { status: 'running', detail: `Testujem TURN relay na ${turnHost}:443/TLS...` });
  const r4 = await testIceServer(`turns:${turnHost}:443?transport=tcp`, turnUser, turnPass, 9000);
  const relay4 = r4.types.includes('relay');
  set('turn_443', {
    status: relay4 ? 'ok' : 'fail', ms: r4.ms,
    detail: relay4
      ? `✓ RELAY candidate! TURN :443/TLS funguje (${r4.ms}ms)`
      : `Žiadny relay — :443/TLS NEFUNGUJE (${r4.ms}ms)${r4.error ? ' | ' + r4.error : ''}`
  });

  // 5. TURN :5350/TLS (priamy coturn)
  set('turn_5350', { status: 'running', detail: `Testujem TURN relay na ${turnHost}:5350/TLS...` });
  const r5 = await testIceServer(`turns:${turnHost}:5350?transport=tcp`, turnUser, turnPass, 9000);
  const relay5 = r5.types.includes('relay');
  set('turn_5350', {
    status: relay5 ? 'ok' : 'fail', ms: r5.ms,
    detail: relay5
      ? `✓ RELAY candidate! TURN :5350/TLS funguje (${r5.ms}ms)`
      : `Žiadny relay — :5350/TLS NEFUNGUJE (${r5.ms}ms)${r5.error ? ' | ' + r5.error : ''}`
  });

  // 6. TURN :3478/TCP
  set('turn_3478_tcp', { status: 'running', detail: `Testujem TURN relay na ${turnHost}:3478/TCP...` });
  const r6 = await testIceServer(`turn:${turnHost}:3478?transport=tcp`, turnUser, turnPass, 9000);
  const relay6 = r6.types.includes('relay');
  set('turn_3478_tcp', {
    status: relay6 ? 'ok' : 'fail', ms: r6.ms,
    detail: relay6
      ? `✓ RELAY candidate! TURN :3478/TCP funguje (${r6.ms}ms)`
      : `Žiadny relay — :3478/TCP NEFUNGUJE (${r6.ms}ms)${r6.error ? ' | ' + r6.error : ''}`
  });

  // 7. TURN :3478/UDP
  set('turn_3478_udp', { status: 'running', detail: `Testujem TURN relay na ${turnHost}:3478/UDP...` });
  const r7 = await testIceServer(`turn:${turnHost}:3478`, turnUser, turnPass, 9000);
  const relay7 = r7.types.includes('relay');
  set('turn_3478_udp', {
    status: relay7 ? 'ok' : 'warn', ms: r7.ms,
    detail: relay7
      ? `✓ RELAY candidate! TURN :3478/UDP funguje (${r7.ms}ms)`
      : `Žiadny relay — :3478/UDP blokovaný operátorom (${r7.ms}ms)${r7.error ? ' | ' + r7.error : ''}`
  });

  return tests;
}

export function formatDiagReport(tests: DiagTest[], extraInfo: string): string {
  const now = new Date().toLocaleString();
  const lines: string[] = [
    '=== INDEXUS Connect — TURN/ICE Diagnostika ===',
    `Dátum: ${now}`,
    extraInfo,
    '',
    '--- Výsledky testov ---',
  ];
  for (const t of tests) {
    const icon = t.status === 'ok' ? '✓' : t.status === 'fail' ? '✗' : t.status === 'warn' ? '⚠' : '?';
    lines.push(`[${icon}] ${t.name}: ${t.detail}${t.ms != null ? ` [${t.ms}ms]` : ''}`);
  }
  return lines.join('\n');
}
