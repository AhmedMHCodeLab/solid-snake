// Every technical term the interface cannot avoid, with a plain name and one sentence. A case carries only the terms
// that still appear somewhere in it (technical detail, field names, provenance notes).
export interface GlossaryEntry {
  term: string;
  plain: string;
  explain: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'S-CSCF', plain: 'Call-handling server', explain: 'The operator\'s server that sets up each voice call and writes the call record.' },
  { term: 'IBCF', plain: 'Network border gateway', explain: 'The operator\'s server where calls cross to or from another network; it writes the international gateway records.' },
  { term: 'CDR', plain: 'Charging record', explain: 'The record an operator keeps of one call for billing: who, when and for how long.' },
  { term: 'ECGI', plain: 'Cell identity', explain: 'The code that names one radio cell: the network code plus a cell number.' },
  { term: 'TAI', plain: 'Cell group code', explain: 'The code of the group of cells that share one paging area.' },
  { term: 'IMSI', plain: 'SIM identity', explain: 'The number stored on a SIM that identifies it to the network, 15 digits long.' },
  { term: 'IMEI', plain: 'Device identity', explain: 'The 15-digit number that identifies a phone or other device, and which the device itself reports.' },
  { term: 'TAC', plain: 'Device model code', explain: 'The first 8 digits of a device identity, which say which make and model it is.' },
  { term: 'IMPU', plain: 'Public identity', explain: 'The public number or address under which a customer is reached.' },
  { term: 'MSISDN', plain: 'Phone number', explain: 'The number people dial to reach a SIM.' },
  { term: 'E.164', plain: 'International number format', explain: 'The worldwide format for phone numbers: a plus sign, a country code and the national number.' },
  { term: 'NNI', plain: 'Link between networks', explain: 'The connection where two operators\' networks meet and exchange calls.' },
  { term: 'IOI', plain: 'Operator name in the call', explain: 'The name of an operator network carried in the call so each side knows where it came from.' },
  { term: 'ICID', plain: 'Call charging identifier', explain: 'An identifier shared by every record of one call, so billing can join them.' },
  { term: 'IMS', plain: 'Operator voice core', explain: 'The part of an operator\'s network that handles voice calls over data connections.' },
  { term: 'VoLTE', plain: 'Voice over 4G', explain: 'Voice calls carried over the operator\'s 4G data network.' },
  { term: 'M2M', plain: 'Connected devices', explain: 'Machines such as meters or trackers that use SIMs to talk to each other.' },
  { term: 'IoT', plain: 'Connected devices', explain: 'Everyday equipment fitted with a SIM so that it can send data on its own.' },
  { term: 'MNO', plain: 'Mobile operator', explain: 'A company that runs a mobile network.' },
  { term: 'MCC', plain: 'Country code of the network', explain: 'The 3-digit code that names the country of a mobile network; 999 belongs to no country.' },
  { term: 'MNC', plain: 'Network code', explain: 'The 2 or 3 digit code that names one operator inside a country.' },
  { term: 'IPX', plain: 'International carrier', explain: 'A company that carries calls between operators in different countries.' },
  { term: 'EC', plain: 'Business customer', explain: 'A company that buys phone lines from the operator.' },
  { term: 'UE', plain: 'Phone or device', explain: 'The phone or other device that connects to the mobile network.' },
  { term: 'SIP', plain: 'Call address format', explain: 'The format in which an operator writes the address of the caller and the called party.' },
  { term: 'PBX', plain: 'Office phone system', explain: 'The phone exchange a business runs on its own premises.' },
  { term: 'SIM box', plain: 'SIM box', explain: 'A device that holds many SIMs and hands calls from abroad to the local network, so they look like local calls.' },
  { term: 'timing advance', plain: 'Radio distance measurement', explain: 'The delay a phone must apply so that its signal reaches the antenna in step; one step is about 78 metres of distance.' },
  { term: 'LTE', plain: '4G radio network', explain: 'The fourth-generation mobile radio technology.' },
  { term: 'FQDN', plain: 'Server name', explain: 'The full internet name of a server.' },
  { term: 'Diameter', plain: 'Network control protocol', explain: 'The protocol the operator\'s servers use to account for each call.' },
  { term: 'TS 32.260', plain: 'Charging record standard', explain: 'The 3GPP specification that defines the fields of the operator\'s charging records.' },
];

const matches = (text: string, term: string): boolean => new RegExp(`(?<![A-Za-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`).test(text);

export function glossaryFor(text: string): GlossaryEntry[] {
  return GLOSSARY.filter((g) => matches(text, g.term));
}
export { matches as termAppears };
