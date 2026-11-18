// Identifier schemes. Every identifier has the structure a real unit would see, built on code spaces that belong to no
// public network, subscriber or device (PRODUCT.md 2.5, as amended by DIRECTION-CHANGE-001, enterprise presentation).
//
//   Network:   MCC 999. 3GPP TS 23.501 clause 5.30.2.1 NOTE 1 names "mobile country code (MCC) 999 as assigned by ITU"
//              for non-public networks; ITU-T E.212 Amendment 1 (2018) Appendix III describes shared MCC 999 for internal
//              use within a private network. MNCs under 999 are not routable between networks.
//   Domain:    ims.mnc0NN.mcc999.3gppnetwork.org (TS 23.003 clause 13, 2-digit MNC padded to 3 digits).
//   IMSI:      15 digits, 999 + 2-digit MNC + 10-digit MSIN.
//   Numbers:   E.164 shaped, country code +999. The ITU list "Assigned country codes" (Operational Bulletin 1114, position
//              15 December 2016) lists 999 as "Reserved for future global service": no country owns it.
//   Devices:   IMEI 15 digits (TAC 8, serial 6, Luhn check digit). TAC starts 00 (GSMA TS.06 v27.0 section 9, Annex A:
//              reporting body 00 is Test ME). The only Annex B allocators of test TACs begin 001, 0044 and 0086, so TACs
//              beginning 0099 are never issued to anyone.
//   Cells:     ECGI = PLMN (999 + MNC) + 28-bit E-UTRAN cell identity (7 hex digits), TAI = PLMN + 16-bit tracking area code.
import { pad } from './prng';

export const MCC = '999';
export const COUNTRY_CODE = '999';
export const TEST_TAC_PREFIX = '0099';
export const CASE_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, N: 4, M: 5 };

export interface Net {
  id: string;
  plain: string;
  mnc: string;
  domain: string;
}
const net = (id: string, plain: string, mnc: string): Net => ({ id, plain, mnc, domain: `ims.mnc0${mnc}.mcc${MCC}.3gppnetwork.org` });
export const NETS: Record<string, Net> = {
  'MNO-1': net('MNO-1', 'Operator 1', '70'),
  'MNO-2': net('MNO-2', 'Operator 2', '71'),
  'MNO-3': net('MNO-3', 'Operator 3', '72'),
  'IPX-3': net('IPX-3', 'International carrier 3', '80'),
  'IPX-4': net('IPX-4', 'International carrier 4', '81'),
  'IPX-5': net('IPX-5', 'International carrier 5', '82'),
};
export const HOME_NET: Record<string, string> = { A: 'MNO-1', B: 'MNO-2', C: 'MNO-1', D: 'MNO-2', N: 'MNO-1', M: 'MNO-2' };
export const homeOf = (L: string): Net => NETS[HOME_NET[L] as string] as Net;

// ---- Subscriptions and numbers ---------------------------------------------------------------------

export function imsi(L: string, n: number): string {
  const msin = 1_000_000_000 + ((n * 2654435761 + (CASE_INDEX[L] as number) * 7_000_003) % 8_999_999_999);
  return `${MCC}${homeOf(L).mnc}${msin}`;
}
const digits7 = (n: number, off: number): string => String(1_000_000 + ((n * 7919 + off) % 9_000_000));
export const msisdn = (L: string, n: number): string => `+${COUNTRY_CODE}${homeOf(L).mnc}${digits7(n, (CASE_INDEX[L] as number) * 104729)}`;
export const subUri = (L: string, n: number): string => `sip:${msisdn(L, n)}@${homeOf(L).domain};user=phone`;
export const subId = imsi;

/** Domestic numbers on other operators: block +99972. */
export function peerUri(kind: string, L: string, n: number): string {
  const d = String(1_000_000 + ((n * 6007 + (kind === 'ext' ? 3_000_011 : 0) + (CASE_INDEX[L] as number) * 5003) % 9_000_000));
  return `sip:+${COUNTRY_CODE}72${d}@${(NETS['MNO-3'] as Net).domain};user=phone`;
}

// ---- Enterprise trunks (case D) --------------------------------------------------------------------

export const TRUNK_CUSTOMER = ['0092', '0208', '0147', '0263', '0311', '0378'];
export const TARGET_CUSTOMER = 'EC-0147';
export const trunkUri = (n: number): string => `sip:+${COUNTRY_CODE}71${digits7(n * 131, 17)}@${homeOf('D').domain};user=phone`;
export const trunkSubId = (n: number): string => `trunk${pad(n, 2)}.ec${TRUNK_CUSTOMER[n - 1]}@${homeOf('D').domain}`;

// ---- Number blocks ---------------------------------------------------------------------------------

export const STD_BLOCK_PREFIXES = ['+99991', '+99992', '+99993', '+99994', '+99995'];
export const PREMIUM_BLOCK = '+99997';
export const PREMIUM_BLOCK_PLAIN = 'the premium-rate number block +99997';
export function destUri(prefix: string, n: number): string {
  return `sip:${prefix}${digits7(n, 31)}@${(NETS['IPX-3'] as Net).domain};user=phone`;
}

// ---- Devices ---------------------------------------------------------------------------------------

export function luhnDigit(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    let d = Number(payload[payload.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}
export const MODEL_CODE: Record<string, (rnd: number) => string> = {
  F1: (rnd) => String(1000 + (rnd % 4)),
  F2: () => '2100',
  F3: () => '3100',
  F4: () => '4100',
};
export function imei(family: string, rnd: number): string {
  const body = `${TEST_TAC_PREFIX}${(MODEL_CODE[family] as (r: number) => string)(rnd)}${pad(rnd, 6)}`;
  return body + luhnDigit(body);
}
export const imeiUrn = (e: string): string => `urn:gsma:imei:${e.slice(0, 8)}-${e.slice(8, 14)}-0`;
export const tacOf = (e: string): string => e.slice(0, 8);

// ---- Cells -----------------------------------------------------------------------------------------

export interface CellIds {
  cellRef: string;
  ecgi: string;
  tai: string;
  site: string;
  sector: number;
}
export function cellIds(L: string, site: number, sector: number): CellIds {
  const ci = CASE_INDEX[L] as number;
  const enb = (((ci + 1) * 0x2d1a7 + site * 0xb5c3 + 0x10000) & 0xfffff).toString(16).toUpperCase().padStart(5, '0');
  const mnc = homeOf(L).mnc;
  const tac = (0x1000 + ci * 0x111 + site * 0x21).toString(16).toUpperCase().padStart(4, '0');
  return { cellRef: `${enb}_${sector}`, ecgi: `${MCC}-${mnc}-${enb}0${sector}`, tai: `${MCC}-${mnc}-${tac}`, site: enb, sector };
}
export const cellName = (cellRef: string): string => `site ${cellRef.split('_')[0]}, sector ${cellRef.split('_')[1]}`;
export const accessCellId = (ecgi: string, tai: string): string => {
  const [mcc, mnc, eci] = ecgi.split('-') as [string, string, string];
  return `${mcc}${mnc}${(tai.split('-')[2] as string)}${eci}`;
};

// ---- Interconnect routes ---------------------------------------------------------------------------

export interface RouteDef {
  ref: string;
  carrier: string;
  plain: string;
  short: string;
}
export const IN_ROUTES: RouteDef[] = [
  { ref: 'TG-IPX3-IN-01', carrier: 'IPX-3', plain: 'International carrier 3, route 1', short: 'Carrier 3, route 1' },
  { ref: 'TG-IPX4-IN-02', carrier: 'IPX-4', plain: 'International carrier 4, route 2', short: 'Carrier 4, route 2' },
  { ref: 'TG-IPX5-IN-03', carrier: 'IPX-5', plain: 'International carrier 5, route 3', short: 'Carrier 5, route 3' },
];
export const OUT_ROUTE: RouteDef = { ref: 'TG-IPX3-OUT-02', carrier: 'IPX-3', plain: 'International carrier 3, outbound route 2', short: 'Carrier 3, outbound route 2' };
export const routeDef = (ref: string): RouteDef => [...IN_ROUTES, OUT_ROUTE].find((r) => r.ref === ref) as RouteDef;
/** Inbound international caller number: block +99980, on the carrier's own domain. */
export const intlCallerUri = (route: string, n: number): string => `sip:+${COUNTRY_CODE}80${digits7(n, 977)}@${(NETS[routeDef(route).carrier] as Net).domain};user=phone`;
export const sbcHost = (route: string): string => `sbc01.${(NETS[routeDef(route).carrier] as Net).domain}`;
