// src/lib/db/index.ts: the ONLY module F (src/server/**) imports for
// knowledge of the database shape — table/RPC names, row types, mappers.

export { TABLES, RPC, isoToEpochMs, epochMsToIso } from './columns.ts';
export type {
  TableName, RpcName,
  ProfileRow, PrivacyConsentRow, SessionRow, VocabularyRow, WeakPhonemeRow,
  SrsCardRow, DrillAttemptRow, ProcessedEventRow,
} from './columns.ts';

export {
  DEFAULT_PROFILE_SETTINGS,
  fromProfileRow, toSessionRow, fromSessionRow, fromSrsRow, fromVocabRow,
  fromWeakPhonemeRow, fromDrillAttemptRow,
} from './mappers.ts';
