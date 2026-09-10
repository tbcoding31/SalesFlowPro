import React from 'react';
import { renderToString } from 'react-dom/server';
import { MasterDataIndicator, isColorValue, isValidIconName } from './MasterDataIndicator';

function assert(condition: boolean, testId: string, desc: string) {
  if (!condition) {
    console.error(`  [FAIL] ${testId} — ${desc}`);
    throw new Error(`Test assertion failed: ${testId} (${desc})`);
  }
  console.log(`  [PASS] ${testId} — ${desc}`);
}

console.log('====================================================');
console.log('UNIT TEST: MasterDataIndicator Component & Renderers');
console.log('====================================================\n');

// 1. Test #EF4444 rendered as color swatch (not Material Symbol text)
console.log('--- TEST 1: Color Swatch Rendering ---');
assert(isColorValue('#EF4444') === true, 'COLOR-01', '#EF4444 is identified as a valid color');
assert(isColorValue('#10B981') === true, 'COLOR-02', '#10B981 is identified as a valid color');
assert(isColorValue('rgb(239, 68, 68)') === true, 'COLOR-03', 'rgb(...) is identified as a valid color');

const htmlColor = renderToString(React.createElement(MasterDataIndicator, {
  item: { indicator: '#EF4444', label: 'High Priority' }
}));

assert(htmlColor.includes('data-testid="color-swatch"'), 'SWATCH-01', 'HTML contains data-testid="color-swatch"');
assert(htmlColor.includes('background-color:#EF4444') || htmlColor.includes('background-color: #EF4444'), 'SWATCH-02', 'Swatch has style background-color:#EF4444');
assert(!htmlColor.includes('material-symbols-outlined'), 'SWATCH-03', 'Raw color #EF4444 NEVER renders inside material-symbols-outlined');
assert(htmlColor.includes('#EF4444'), 'SWATCH-04', 'Color text is visible as mono label, not icon text');

// 2. Test flag rendered as Material Symbol
console.log('\n--- TEST 2: Material Symbol Rendering ---');
assert(isValidIconName('flag') === true, 'ICON-01', 'flag is identified as a valid icon name');
assert(isValidIconName('task') === true, 'ICON-02', 'task is identified as a valid icon name');
assert(isValidIconName('note') === true, 'ICON-03', 'note is identified as a valid icon name');
assert(isValidIconName('#EF4444') === false, 'ICON-04', '#EF4444 is strictly NOT identified as an icon name');

const htmlIcon = renderToString(React.createElement(MasterDataIndicator, {
  item: { indicator: 'flag', label: 'Flagged' }
}));

assert(htmlIcon.includes('material-symbols-outlined'), 'SYMBOL-01', 'HTML contains class material-symbols-outlined');
assert(htmlIcon.includes('flag'), 'SYMBOL-02', 'Material symbol text is "flag"');
assert(!htmlIcon.includes('data-testid="color-swatch"'), 'SYMBOL-03', 'Icon-only indicator has no color swatch');

// 3. Test Empty/Null/Invalid rendered as neutral placeholder
console.log('\n--- TEST 3: Neutral Placeholder Rendering ---');
assert(isColorValue('') === false, 'EMPTY-01', 'empty string is not color');
assert(isValidIconName('') === false, 'EMPTY-02', 'empty string is not icon');

const htmlEmpty = renderToString(React.createElement(MasterDataIndicator, {
  item: { indicator: '', label: 'General' }
}));
assert(htmlEmpty.includes('data-testid="indicator-placeholder"'), 'PLACEHOLDER-01', 'Empty indicator renders data-testid="indicator-placeholder"');
assert(htmlEmpty.includes('>-<'), 'PLACEHOLDER-02', 'Placeholder contains neutral dash "-"');
assert(!htmlEmpty.includes('material-symbols-outlined'), 'PLACEHOLDER-03', 'Placeholder does not invoke material-symbols-outlined');

const htmlNull = renderToString(React.createElement(MasterDataIndicator, {
  item: null
}));
assert(htmlNull.includes('data-testid="indicator-placeholder"'), 'PLACEHOLDER-04', 'Null item renders placeholder');

// 4. Test Dual Icon + Color (e.g. activity_types)
console.log('\n--- TEST 4: Dual Icon + Color Rendering ---');
const htmlDual = renderToString(React.createElement(MasterDataIndicator, {
  item: { icon: 'task', color: '#6366F1', label: 'General Task' }
}));
assert(htmlDual.includes('data-testid="indicator-icon-and-color"'), 'DUAL-01', 'Dual item renders indicator-icon-and-color container');
assert(htmlDual.includes('material-symbols-outlined'), 'DUAL-02', 'Dual item renders material symbol');
assert(htmlDual.includes('task'), 'DUAL-03', 'Dual item renders icon name "task"');
assert(htmlDual.includes('data-testid="color-swatch-dot"'), 'DUAL-04', 'Dual item renders color swatch dot');
assert(htmlDual.includes('color:#6366F1') || htmlDual.includes('color: #6366F1'), 'DUAL-05', 'Icon is styled with color #6366F1');
assert(!htmlDual.includes('>#6366F1<'), 'DUAL-06', 'Hex code #6366F1 is never displayed as text inside icon');

console.log('\n====================================================');
console.log('ALL 17 UNIT ASSERTIONS PASSED SUCCESSFULLY');
console.log('====================================================');
