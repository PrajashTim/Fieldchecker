/**
 * Exact-subfield alias table. A directory name proves a field exists;
 * it is never occupancy evidence. Park-level labels stay unresolved.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fieldsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fieldsConfig.json'), 'utf8')
);

const EXACT_ALIASES = {
  'poplar tree park 2': 'poplar-tree-2',
  'poplar tree park field 2': 'poplar-tree-2',
  'poplar tree park turf field 2': 'poplar-tree-2',
  'poplar tree 2': 'poplar-tree-2',
  'poplar tree park 3': 'poplar-tree-3',
  'poplar tree park field 3': 'poplar-tree-3',
  'poplar tree park turf field 3': 'poplar-tree-3',
  'poplar tree 3': 'poplar-tree-3',
  'arrowhead 1': 'arrowhead-1',
  'arrowhead park 1': 'arrowhead-1',
  'arrowhead park turf field 1': 'arrowhead-1',
  'arrowhead park turf 1': 'arrowhead-1',
  'arrowhead 1a': 'arrowhead-1a',
  'arrowhead park turf field 1a': 'arrowhead-1a',
  'arrowhead 1b': 'arrowhead-1b',
  'arrowhead park turf field 1b': 'arrowhead-1b',
  'arrowhead 3': 'arrowhead-3',
  'arrowhead park turf field 3': 'arrowhead-3',
  'arrowhead 3a': 'arrowhead-3a',
  'arrowhead 3b': 'arrowhead-3b',
  'arrowhead 3c': 'arrowhead-3c',
  'greenbriar park 5': 'greenbriar-5',
  'greenbriar park field 5': 'greenbriar-5',
  'greenbriar 5': 'greenbriar-5',
  'greenbriar park 5a': 'greenbriar-5a',
  'greenbriar park 5b': 'greenbriar-5b',
  'sully highlands park 1': 'sully-highlands-1',
  'sully highlands park field 1': 'sully-highlands-1',
  'sully highlands 1': 'sully-highlands-1',
  'sully highlands park 1a': 'sully-highlands-1',
  'sully highlands 1a': 'sully-highlands-1',
  'sully highlands park 1b': 'sully-highlands-1',
  'sully highlands 1b': 'sully-highlands-1',
  'sully highlands park 2': 'sully-highlands-2',
  'sully highlands park field 2': 'sully-highlands-2',
  'sully highlands 2': 'sully-highlands-2',
  'sully highlands park 2a': 'sully-highlands-2',
  'sully highlands 2a': 'sully-highlands-2',
  'sully highlands park 2b': 'sully-highlands-2',
  'sully highlands 2b': 'sully-highlands-2',
  'ec lawrence park 2': 'eclawrence-2',
  'ec lawrence park field 2': 'eclawrence-2',
  'e c lawrence park 2': 'eclawrence-2',
  'ec lawrence park 3a': 'eclawrence-3a',
  'ec lawrence park 3b': 'eclawrence-3b',
  'lake fairfax park 1': 'lake-fairfax-1',
  'lake fairfax park field 1': 'lake-fairfax-1',
  'lake fairfax 1': 'lake-fairfax-1',
  'lake fairfax park 3': 'lake-fairfax-3',
  'lake fairfax park 4': 'lake-fairfax-4',
  'lake fairfax 4': 'lake-fairfax-4',
  'lake fairfax park 5': 'lake-fairfax-5',
  'chantilly high school stadium': 'chantilly-hs-turf',
  'chantilly high school stadium field': 'chantilly-hs-turf',
  'chantilly high school stadium turf': 'chantilly-hs-turf',
  'westfield hs aux turf': 'westfield-hs-turf',
  'westfield high school aux turf': 'westfield-hs-turf',
  'westfield high school aux field 1': 'westfield-hs-turf',
  'bready park 1a': 'bready-1a',
  'bready park field 1a': 'bready-1a',
  'bready park 1b': 'bready-1b',
  'arrowbrook soccer field': 'arrowbrook-1',
  'arrowbrook park turf': 'arrowbrook-1',
  'cunningham park field 1': 'cunningham-1',
  'cunningham park 1': 'cunningham-1',
  'oakmont park oak marr field 1': 'oakmont-1',
  'oakmont center field 1': 'oakmont-1',
  'braddock park turf field 7': 'braddock-7',
  'braddock park field 7': 'braddock-7',
  'braddock park 7': 'braddock-7',
  'braddock park turf field 7a': 'braddock-7a',
  'braddock park turf field 7b': 'braddock-7b',
  'braddock park field 7b': 'braddock-7b',
  'freedom high school': 'freedom-hs-turf',
  'freedom hs': 'freedom-hs-turf',
  'freedom high school stadium': 'freedom-hs-turf',
  'freedom high school stadium turf': 'freedom-hs-turf',
  'freedom high school aux': 'freedom-hs-aux',
  'freedom high school aux turf': 'freedom-hs-aux',
  'lunsford middle school': 'lunsford-ms-turf',
  'j michael lunsford middle school': 'lunsford-ms-turf',
  'lunsford ms': 'lunsford-ms-turf',
  'byrnes ridge park': 'byrnes-ridge-1',
  'byrne s ridge park': 'byrnes-ridge-1',
  'byrnes ridge park 1': 'byrnes-ridge-1',
  'hanson park 1': 'hanson-1',
  'hanson regional park 1': 'hanson-1',
  'hal and berni hanson regional park 1': 'hanson-1',
  'hanson park turf 1': 'hanson-1',
  'hanson park 2': 'hanson-2',
  'hanson regional park 2': 'hanson-2',
  'hanson park turf 2': 'hanson-2',
  'hanson park 3': 'hanson-3',
  'hanson regional park 3': 'hanson-3',
  'hanson park turf 3': 'hanson-3',
  'john champe high school': 'champe-hs-turf',
  'champe high school': 'champe-hs-turf',
  'john champe hs stadium': 'champe-hs-turf',
};

const PARK_ONLY = new Set([
  'lake fairfax',
  'lake fairfax park',
  'braddock park',
  'braddock',
  'arrowhead',
  'arrowhead park',
  'sully highlands',
  'sully highlands park',
  'sully highlands park main field',
  'sully highlands main field',
  'greenbriar park',
  'poplar tree park',
  'stringfellow park',
  'stringfellow park field 2',
  'stringfellow field 2',
  'westfield hs stadium turf',
  'westfield high school stadium turf',
  'westfield high school stadium',
  'centreville high school',
  'centreville high school 1 stadium',
  'centreville high school 2 practice',
  'centreville high school 1',
  'centreville high school 2',
  'hanson park',
  'hanson regional park',
  'hal and berni hanson regional park',
  'freedom high school south riding',
]);

export function normalizeVenue(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, ' and ')
    .replace(/e\.?\s*c\.?\s*lawrence/g, 'ec lawrence')
    .replace(/oakmont center(?:\s*\(previously oak marr\))?/g, 'oakmont park oak marr')
    .replace(/#/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fxaAliases() {
  const aliases = {};
  for (const field of fieldsConfig) {
    if (field.fxaLocation) aliases[normalizeVenue(field.fxaLocation)] = field.id;
    aliases[normalizeVenue(`${field.name} ${field.subfield}`)] = field.id;
  }
  return aliases;
}

const FIELD_IDS = new Set(fieldsConfig.map(field => field.id));
const COMBINED_ALIASES = { ...fxaAliases(), ...EXACT_ALIASES };

export function resolveExactField(rawName) {
  const key = normalizeVenue(rawName);
  if (!key) return { fieldId: null, precision: 'unresolved', reason: 'empty' };
  if (PARK_ONLY.has(key)) {
    return { fieldId: null, precision: 'park', reason: 'park-level label is not an exact subfield' };
  }
  const fieldId = COMBINED_ALIASES[key];
  if (fieldId && FIELD_IDS.has(fieldId)) {
    return { fieldId, precision: 'exact_subfield', reason: null };
  }
  return { fieldId: null, precision: 'unresolved', reason: 'no exact configured subfield match' };
}

export function combineComplexAndField(complexName, fieldLabel) {
  const field = (fieldLabel || '').trim();
  const complex = (complexName || '').trim();
  if (!field) return complex;
  if (!complex) return field;
  if (normalizeVenue(field).includes(normalizeVenue(complex))) return field;
  return `${complex} ${field}`;
}
