// Static tables: evidence sources, independence statements, recipients, field specifications.
import type { ConnectorInfo, FieldSpec, Independence, RecipientRole, Source, SourceCode } from '../../shared/types';

export const SOURCES: Record<SourceCode, Source> = {
  E1: {
    code: 'E1',
    name: 'Serving-node charging records (S-CSCF CDR)',
    plainName: 'Call records',
    explain: 'The operator\'s record of each answered call: who called, who was called, when it started and ended, and the cell area. Held by the operator\'s billing and mediation team.',
    system: 'S-CSCF charging data records, originating and terminating',
    method: 'Charging data record, answered sessions only',
    collectionPoint: 'Operator call-handling servers, one cell area and its neighbours',
    basis: 'FICTION',
    basisNote: 'The field model follows ETSI TS 132 260 Table 6.1.3.3.1 (FACT). Every value is FICTION. The digit layout of the cell value inside Access Network Information is realistic in shape and was not verified against ETSI TS 124 229 clause 7.2A.4 this session (ASSUMPTION).',
  },
  E2: {
    code: 'E2',
    name: 'Border-node charging records (IBCF CDR)',
    plainName: 'International gateway records',
    explain: 'The operator\'s record of calls crossing the border to other networks, per route. Held by the operator\'s interconnect team.',
    system: 'IBCF charging data records, international sessions per route',
    method: 'Charging data record, answered sessions only',
    collectionPoint: 'Operator network border, three international routes',
    basis: 'ASSUMPTION',
    basisNote: 'The IBCF record model is ETSI TS 132 260 Table 6.1.3.10.1 (FACT). That the operator\'s traffic arrives and is recorded this way is ASSUMPTION.',
  },
  E3: {
    code: 'E3',
    name: 'Device model fingerprinting from signalling',
    plainName: 'Device information',
    explain: 'What the network can tell about the phones or devices that use a SIM, taken from the messages devices send when they connect. Held by the operator\'s radio and core network team.',
    system: 'Signalling capture (attach and capability messages), never call records',
    method: 'Device-model fingerprinting from signalling',
    collectionPoint: 'Radio access and core network signalling',
    basis: 'ASSUMPTION',
    basisNote: 'The method is RESEARCH (Oh et al., NDSS 2023, lab LTE testbed). That the operator collects it is ASSUMPTION.',
  },
  E4: {
    code: 'E4',
    name: 'Subscriber administration records',
    plainName: 'SIM registration records',
    explain: 'Who registered each SIM and under which contract. Held by the operator\'s customer administration team, apart from the call records.',
    system: 'Subscriber administration',
    method: 'Administrative record',
    collectionPoint: 'Operator customer administration',
    basis: 'ASSUMPTION',
    basisNote: 'ASSUMPTION: registration data is held by a different team and can be requested (PRODUCT.md Part 3).',
  },
  E5: {
    code: 'E5',
    name: 'LTE timing advance',
    plainName: 'Radio distance measurement',
    explain: 'How far from the antenna a phone was when it used the network, measured by the radio network in steps of about 78 metres. Held by the operator\'s radio network team.',
    system: 'LTE timing advance measurement',
    method: 'Radio measurement',
    collectionPoint: 'Operator radio access network',
    basis: 'ASSUMPTION',
    basisNote: 'ASSUMPTION: whether timing advance is recorded is a choice of this platform (PRODUCT.md U12). Timing advance appears in no charging record (DECISIONS.md section 8).',
  },
  E6: {
    code: 'E6',
    name: 'Field survey and controlled test call',
    plainName: 'Field survey and test call',
    explain: 'A check made outside the unit\'s own analysis: a survey of the area, a test call or a customer\'s own logs. Arranged by the unit with the operator or the customer.',
    system: 'Outside the analysis chain',
    method: 'Field survey and controlled test call (demo connector)',
    collectionPoint: 'Surveyed area or customer premises',
    basis: 'FICTION',
    basisNote: 'FICTION: prepared ground truth served by a demo connector, labelled simulated (PRODUCT.md 2.4, level 5).',
  },
  E7: {
    code: 'E7',
    name: 'Number-range and tariff reference data',
    plainName: 'Number range reference',
    explain: 'A table that says which number blocks are premium-rate and what they cost. Held by the operator\'s tariff administration team.',
    system: 'Reference data',
    method: 'Reference table lookup',
    collectionPoint: 'Operator tariff administration',
    basis: 'FICTION',
    basisNote: 'FICTION. That such reference data is needed is PRACTICE (BICS Telco Fraud Whitepaper, via PRODUCT.md 2.2).',
  },
};

/** Demo connectors: what the platform asks of each source. Turnarounds are feed minutes. */
export const CONNECTORS: ConnectorInfo[] = (Object.values(SOURCES) as Source[]).map((x) => ({
  source: x.code,
  plainName: x.plainName as string,
  mode: 'demo-synthetic' as const,
  turnaroundMinutes: { E1: 5, E2: 20, E3: 45, E4: 240, E5: 60, E6: 1440, E7: 15 }[x.code],
}));

export function independence(id: string, a: SourceCode, b: SourceCode): Independence {
  const key = [a, b].join('+');
  const base = { id, pair: [a, b] as [SourceCode, SourceCode] };
  switch (key) {
    case 'E1+E2':
      return {
        ...base,
        differentSystem: false,
        differentMethod: false,
        differentCollectionPoint: true,
        sharedFailureModes: 'Mediation outage and clock skew can affect both. This pair qualifies on collection point only, the weakest of the three forms PRODUCT.md 2.4 accepts.',
        statement:
          'Call records (E1) and international gateway records (E2) are both charging records. They differ in where they are collected (call-handling servers and the network border) and in nothing else, so this is the weakest form of independence: an outage in the record pipeline or a clock error could affect both.',
      };
    case 'E1+E3':
      return {
        ...base,
        differentSystem: true,
        differentMethod: true,
        differentCollectionPoint: true,
        sharedFailureModes: 'Subscriber identity mapping.',
        statement:
          'Call records (E1) and device information (E3) come from different systems, by different methods, at different collection points. A shared failure remains possible in the link between a device and a SIM.',
      };
    case 'E1+E5':
      return {
        ...base,
        differentSystem: true,
        differentMethod: true,
        differentCollectionPoint: true,
        sharedFailureModes: 'Cell configuration data.',
        statement:
          'Call records (E1) and the radio distance measurement (E5) come from different systems, by different methods, at different collection points. A shared failure remains possible in the cell configuration data both rely on.',
      };
    case 'E1+E7':
      return {
        ...base,
        differentSystem: true,
        differentMethod: true,
        differentCollectionPoint: true,
        sharedFailureModes: 'None in traffic.',
        statement:
          'Call records (E1) and the number range reference (E7) come from different systems, by different methods, at different collection points. Reference data can be out of date, but it shares no failure mode with the traffic records.',
      };
    default:
      throw new Error(`No independence statement for ${key}`);
  }
}

export const RECIPIENTS: RecipientRole[] = [
  { id: 'unit-lead', title: 'Unit lead', basis: 'FICTION', label: '(simulated role)', order: 1 },
  { id: 'agency-head', title: 'Agency head', basis: 'FICTION', label: '(simulated role)', order: 2 },
  { id: 'regulator-desk', title: 'Regulator desk', basis: 'FICTION', label: '(simulated role)', order: 3 },
  { id: 'law-enforcement-desk', title: 'Law-enforcement desk', basis: 'FICTION', label: '(simulated role)', order: 4 },
];

const T = 'TS 32.260 Table 6.1.3.3.1' as const;
const I = 'TS 32.260 Table 6.1.3.10.1' as const;

type Cat = FieldSpec['category'];
const f = (key: string, specName: string, category: Cat, spec: FieldSpec['spec'], plainName: string, explain: string): FieldSpec => ({ key, specName, plainName, explain, category, spec });

export const FIELD_SPECS: FieldSpec[] = [
  f('recordType', 'Record Type', 'M', T, 'Kind of record', 'Says which kind of record this is: a call-handling server record.'),
  f('roleOfNode', 'Role of Node', 'OM', T, 'Which end of the call', 'Says whether the record describes the calling side (outgoing) or the called side (incoming).'),
  f('nodeAddress', 'Node Address', 'OM', T, 'Server that wrote the record', 'The name of the operator server that handled the call and wrote this record.'),
  f('sessionId', 'Session ID', 'OM', T, 'Call session identifier', 'An identifier the server gave to this call session, made of the server name, a time value and a counter.'),
  f('imsChargingIdentifier', 'IMS Charging Identifier', 'OM', T, 'Call charging identifier', 'An identifier shared by every record of the same call, so billing can join them.'),
  f('localRecordSequenceNumber', 'Local Record Sequence Number', 'OM', T, 'Record counter on the server', 'A running number on the server, used to spot missing or duplicated records.'),
  f('listOfCallingPartyAddress', 'List Of Calling Party Address', 'OM', T, 'Number that placed the call', 'The public number or address of the caller.'),
  f('listOfSubscriptionId', 'List of Subscription Id', 'OM', T, 'SIM identity', 'The identity of the SIM (or business line) the call was charged to.'),
  f('requestedPartyAddress', 'Requested Party Address', 'OC', T, 'Number the caller dialled', 'The number as the caller dialled it, when it differs from the number reached. Optional.'),
  f('calledPartyAddress', 'Called Party Address', 'OM', T, 'Number that was called', 'The public number or address that was called.'),
  f('serviceRequestTimeStamp', 'Service Request Time Stamp', 'OM', T, 'Time the call was requested', 'When the caller started dialling.'),
  f('serviceDeliveryStartTimeStamp', 'Service Delivery Start Time Stamp', 'OM', T, 'Time the call was answered', 'When the call was answered and the call started to be charged.'),
  f('serviceDeliveryEndTimeStamp', 'Service Delivery End Time Stamp', 'OC', T, 'Time the call ended', 'When the call ended. Optional, so a missing value is a normal state.'),
  f('causeForRecordClosing', 'Cause For Record Closing', 'OM', T, 'Why the record was closed', 'The reason the server closed the record, for example the call ended normally.'),
  f('serviceReasonReturnCode', 'Service Reason Return Code', 'OM', T, 'Result code of the call', 'A numeric result. 2001 means the call was handled successfully.'),
  f('userLocationInfo', 'User Location Info', 'OC', T, 'Cell area from the network', 'The cell area that served the phone when the call was answered, as reported by the network. Optional. It names a cell, not a position.'),
  f('accessNetworkInformation', 'Access Network Information', 'OC', T, 'Cell area as reported by the device', 'The cell area at answer, either from the network or as reported by the phone. Optional. It names a cell, not a position.'),
  f('subscriberEquipmentNumber', 'Subscriber Equipment Number', 'OC', T, 'Device identity', 'The identity of the phone or device that used the SIM, as the device states it. Optional and easy to change on some equipment.'),
  f('instanceId', 'Instance Id', 'OC', T, 'Device identity in address form', 'The same device identity written as an address. Optional.'),
  f('originatingIoi', 'Originating IOI', 'OC', T, 'Operator on the calling side', 'The name of the operator network the call came from. Optional.'),
  f('terminatingIoi', 'Terminating IOI', 'OC', T, 'Operator on the called side', 'The name of the operator network the call went to. Optional.'),
  // IBCF record. DECISIONS.md section 8 names NNI Information and Session Direction but gives no category, so the
  // category is OM here. routeRef has no TS 32.260 counterpart in the subset read; its name says so.
  f('recordType', 'Record Type', 'M', I, 'Kind of record', 'Says which kind of record this is: a border gateway record.'),
  f('roleOfNode', 'Role of Node', 'OM', I, 'Direction of the call at the border', 'Says whether the call entered the operator network (terminating) or left it (originating).'),
  f('nodeAddress', 'Node Address', 'OM', I, 'Gateway that wrote the record', 'The name of the border gateway that handled the call.'),
  f('sessionId', 'Session ID', 'OM', I, 'Call session identifier', 'An identifier the gateway gave to this call session.'),
  f('imsChargingIdentifier', 'IMS Charging Identifier', 'OM', I, 'Call charging identifier', 'An identifier shared by every record of the same call, so billing can join them.'),
  f('listOfCallingPartyAddress', 'List Of Calling Party Address', 'OM', I, 'Number that placed the call', 'The public number or address of the caller.'),
  f('calledPartyAddress', 'Called Party Address', 'OM', I, 'Number that was called', 'The public number or address that was called.'),
  f('serviceRequestTimeStamp', 'Service Request Time Stamp', 'OM', I, 'Time the call was requested', 'When the call reached the border.'),
  f('serviceDeliveryStartTimeStamp', 'Service Delivery Start Time Stamp', 'OM', I, 'Time the call was answered', 'When the call was answered.'),
  f('serviceDeliveryEndTimeStamp', 'Service Delivery End Time Stamp', 'OC', I, 'Time the call ended', 'When the call ended. Optional.'),
  f('nniInformation', 'NNI Information', 'OM', I, 'Link to the other network', 'Describes the link between the two networks: direction, whether it is a roaming link, how far the other network is trusted, and the neighbouring gateway.'),
  f('originatingIoi', 'Originating IOI', 'OC', I, 'Operator on the calling side', 'The name of the operator network the call came from. Optional.'),
  f('routeRef', 'Route Reference (platform field, not a TS 32.260 field)', 'OM', I, 'Route and trunk group', 'The international route and the trunk group of the carrier that delivered the call. Added by the platform from the operator\'s routing table.'),
];
