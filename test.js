// test.js — Manual Test Suite for Wordle Solver Logic
// Run with: npm test
// Tests the filter and ranker without needing a browser or UI.

import { loadWordList, getWordList } from './words.js';
import { filterWords } from './filter.js';
import { getTopSuggestions } from './ranker.js';

// ─────────────────────────────────────────
// Simple test helper — no framework needed
// ─────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`  ✅ ${description}`);
        passed++;
    } catch (error) {
        console.log(`  ❌ ${description}`);
        console.log(`     → ${error.message}`);
        failed++;
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toBeGreaterThan(n) {
            if (actual <= n) {
                throw new Error(`Expected ${actual} to be greater than ${n}`);
            }
        },
        toBeLessThan(n) {
            if (actual >= n) {
                throw new Error(`Expected ${actual} to be less than ${n}`);
            }
        },
        toContain(item) {
            if (!actual.includes(item)) {
                throw new Error(`Expected list to contain "${item}" but it didn't`);
            }
        },
        toNotContain(item) {
            if (actual.includes(item)) {
                throw new Error(`Expected list NOT to contain "${item}" but it did`);
            }
        },
        toBeTrue() {
            if (actual !== true) {
                throw new Error(`Expected true, got ${actual}`);
            }
        }
    };
}

// ─────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────

async function runTests() {

    console.log('\n🔤 Loading word list...\n');
    await loadWordList();
    const words = getWordList();

    // ── Word List Tests ──────────────────
    console.log('📋 Word List Tests');

    test('Word list is not empty', () => {
        expect(words.length).toBeGreaterThan(0);
    });

    test('Word list contains more than 1000 words', () => {
        expect(words.length).toBeGreaterThan(1000);
    });

    test('All words are exactly 5 letters', () => {
        const nonFive = words.filter(w => w.length !== 5);
        expect(nonFive.length).toBe(0);
    });

    test('All words are lowercase', () => {
        const nonLower = words.filter(w => w !== w.toLowerCase());
        expect(nonLower.length).toBe(0);
    });

    test('Word list contains common words like "crane"', () => {
        expect(words).toContain('crane');
    });

    test('Word list contains common words like "stare"', () => {
        expect(words).toContain('stare');
    });

    // ── Filter Tests — Green Letters ─────
    console.log('\n🟩 Filter Tests — Green Letters');

    test('Green A at position 0 returns only words starting with A', () => {
        const results = filterWords({
            greens: ['a', null, null, null, null],
            yellows: {},
            greys: []
        });
        const allStartWithA = results.every(w => w[0] === 'a');
        expect(allStartWithA).toBeTrue();
    });

    test('Green E at position 4 returns only words ending with E', () => {
        const results = filterWords({
            greens: [null, null, null, null, 'e'],
            yellows: {},
            greys: []
        });
        const allEndWithE = results.every(w => w[4] === 'e');
        expect(allEndWithE).toBeTrue();
    });

    test('Multiple greens narrow results correctly', () => {
        // _R_N_ — R at pos 1, N at pos 3
        const results = filterWords({
            greens: [null, 'r', null, 'n', null],
            yellows: {},
            greys: []
        });
        const allMatch = results.every(w => w[1] === 'r' && w[3] === 'n');
        expect(allMatch).toBeTrue();
    });

    // ── Filter Tests — Grey Letters ──────
    console.log('\n⬜ Filter Tests — Grey Letters');

    test('Grey letters are excluded from results', () => {
        const results = filterWords({
            greens: [null, null, null, null, null],
            yellows: {},
            greys: ['x', 'z', 'q']
        });
        const containsExcluded = results.some(w =>
            w.includes('x') || w.includes('z') || w.includes('q')
        );
        expect(containsExcluded).toBe(false);
    });

    test('Grey letters reduce the word count', () => {
        const allResults = filterWords({
            greens: [null, null, null, null, null],
            yellows: {},
            greys: []
        });
        const filteredResults = filterWords({
            greens: [null, null, null, null, null],
            yellows: {},
            greys: ['e', 'a', 'r', 's', 't']
        });
        expect(filteredResults.length).toBeLessThan(allResults.length);
    });

    // ── Filter Tests — Yellow Letters ────
    console.log('\n🟨 Filter Tests — Yellow Letters');

    test('Yellow letter must appear in the word', () => {
        const results = filterWords({
            greens: [null, null, null, null, null],
            yellows: { 'a': [0] },
            greys: []
        });
        const allContainA = results.every(w => w.includes('a'));
        expect(allContainA).toBeTrue();
    });

    test('Yellow letter must not appear at its excluded position', () => {
        const results = filterWords({
            greens: [null, null, null, null, null],
            yellows: { 'a': [2] },
            greys: []
        });
        const noneHaveAAtPos2 = results.every(w => w[2] !== 'a');
        expect(noneHaveAAtPos2).toBeTrue();
    });

    test('Yellow letter excluded from multiple positions', () => {
        const results = filterWords({
            greens: [null, null, null, null, null],
            yellows: { 'e': [0, 1, 2] },
            greys: []
        });
        const valid = results.every(w =>
            w.includes('e') &&
            w[0] !== 'e' &&
            w[1] !== 'e' &&
            w[2] !== 'e'
        );
        expect(valid).toBeTrue();
    });

    // ── Filter Tests — Edge Cases ────────
    console.log('\n⚠️  Filter Tests — Edge Cases');

    test('Known Wordle scenario: CRANE with C🟩 R⬜ A🟨 N⬜ E⬜ reduces list', () => {
        // C is green at 0, A is yellow not at pos 2, R/N/E are grey
        const results = filterWords({
            greens: ['c', null, null, null, null],
            yellows: { 'a': [2] },
            greys: ['r', 'n', 'e']
        });
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThan(200);
    });

    test('Results from CRANE scenario all start with C', () => {
        const results = filterWords({
            greens: ['c', null, null, null, null],
            yellows: { 'a': [2] },
            greys: ['r', 'n', 'e']
        });
        const allStartWithC = results.every(w => w[0] === 'c');
        expect(allStartWithC).toBeTrue();
    });

    test('No results when constraints are impossible', () => {
        // A is both green at pos 0 AND grey — impossible
        const results = filterWords({
            greens: ['a', null, null, null, null],
            yellows: {},
            greys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i',
                    'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r',
                    's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
        });
        expect(results.length).toBe(0);
    });

    // ── Ranker Tests ─────────────────────
    console.log('\n🏆 Ranker Tests');

    test('Ranker returns results in descending score order', () => {
        const validWords = filterWords({
            greens: [null, null, null, null, null],
            yellows: {},
            greys: []
        });
        const suggestions = getTopSuggestions(validWords, 10);
        for (let i = 0; i < suggestions.length - 1; i++) {
            if (suggestions[i].score < suggestions[i + 1].score) {
                throw new Error(`Score out of order at position ${i}`);
            }
        }
        expect(true).toBeTrue();
    });

    test('Ranker returns no more than requested number of results', () => {
        const validWords = filterWords({
            greens: [null, null, null, null, null],
            yellows: {},
            greys: []
        });
        const suggestions = getTopSuggestions(validWords, 5);
        expect(suggestions.length).toBeLessThan(6);
    });

    test('Ranker returns word and score for each suggestion', () => {
        const validWords = filterWords({
            greens: [null, null, null, null, null],
            yellows: {},
            greys: []
        });
        const suggestions = getTopSuggestions(validWords, 3);
        const allHaveWordAndScore = suggestions.every(s =>
            typeof s.word === 'string' && typeof s.score === 'number'
        );
        expect(allHaveWordAndScore).toBeTrue();
    });

    test('Ranker handles empty word list gracefully', () => {
        const suggestions = getTopSuggestions([], 10);
        expect(suggestions.length).toBe(0);
    });

    // ── Summary ──────────────────────────
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All tests passed — logic is solid!\n');
    } else {
        console.log('⚠️  Some tests failed — check the errors above.\n');
        process.exit(1);
    }
}

runTests();