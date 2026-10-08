// test.js — Manual Test Suite for Wordle Solver Logic
// Run with: npm test
// Tests solver.js (the same module the app loads) without needing a browser or UI.

import { loadWordList, getWordList, loadValidWords, getValidWords } from './words.js';
import { filterWords as filterIn, buildConstraints, findCandidates, patternCode, scoreGuess, rankGuesses, bestOpener } from './solver.js';

// Tests filter the loaded word list, so bind it once
const filterWords = constraints => filterIn(constraints, getWordList());

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
    await loadValidWords();
    const words = getWordList();
    const validWords = getValidWords();

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

    const startingConstraints = { greens: [null, null, null, null, null], yellows: {}, greys: [] };
    // Reference Wordle scoring, written independently of solver.js
    const referenceScore = (guess, ans) => {
        const s = Array(5).fill('absent'), left = {};
        for (let i = 0; i < 5; i++) {
            if (guess[i] === ans[i]) s[i] = 'correct'; else left[ans[i]] = (left[ans[i]] || 0) + 1;
        }
        for (let i = 0; i < 5; i++) {
            if (s[i] !== 'absent') continue;
            if (left[guess[i]] > 0) { s[i] = 'present'; left[guess[i]]--; }
        }
        return s;
    };

    test('scoreGuess matches reference Wordle scoring (2,000 random pairs, many with repeated letters)', () => {
        let seed = 5;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const pick = () => words[Math.floor(rnd() * words.length)];
        for (let t = 0; t < 2000; t++) {
            const g = pick(), a = pick();
            if (scoreGuess(g, a).join() !== referenceScore(g, a).join()) {
                throw new Error(`${g} vs ${a}: got ${scoreGuess(g, a)}, expected ${referenceScore(g, a)}`);
            }
        }
        expect(patternCode('crane', 'crane')).toBe(242);
    });

    test('Ranker returns results best first (lowest expected words left)', () => {
        const suggestions = rankGuesses(filterWords(startingConstraints), words, 10);
        for (let i = 0; i < suggestions.length - 1; i++) {
            if (suggestions[i].score > suggestions[i + 1].score) {
                throw new Error(`Score out of order at position ${i}`);
            }
        }
        expect(suggestions.length).toBe(10);
    });

    test('Ranker returns no more than requested number of results', () => {
        const suggestions = rankGuesses(filterWords(startingConstraints), words, 5);
        expect(suggestions.length).toBeLessThan(6);
    });

    test('Ranker returns word, score and isCandidate for each suggestion', () => {
        const suggestions = rankGuesses(filterWords(startingConstraints), words, 3);
        const ok = suggestions.every(s =>
            typeof s.word === 'string' && typeof s.score === 'number' && typeof s.isCandidate === 'boolean'
        );
        expect(ok).toBeTrue();
    });

    test('Ranker handles empty and single-word candidate lists', () => {
        expect(rankGuesses([], words, 10).length).toBe(0);
        const one = rankGuesses(['crane'], words, 10);
        expect(one.length).toBe(1);
        expect(one[0].word).toBe('crane');
    });

    test('With two words left only those words are suggested', () => {
        const suggestions = rankGuesses(['batch', 'catch'], words, 10);
        expect(suggestions.length).toBe(2);
        expect(suggestions.every(s => s.isCandidate)).toBeTrue();
    });

    test('A probe word beats every real answer for the _ATCH family', () => {
        const candidates = ['batch', 'catch', 'hatch', 'latch', 'match', 'patch', 'watch'];
        const ranked = rankGuesses(candidates, words, words.length);
        expect(ranked[0].isCandidate).toBe(false);
        const bestCandidate = ranked.find(s => s.isCandidate);
        expect(ranked[0].score).toBeLessThan(bestCandidate.score);
    });

    test('Opener is a known word and the top-ranked guess for a fresh game', () => {
        const opener = bestOpener(words);
        expect(words).toContain(opener);
        expect(rankGuesses(words, words, 1)[0].word).toBe(opener);
    });

    test('Simulation: following the top suggestion solves 60 random games within 6 guesses', () => {
        let seed = 21;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const opener = bestOpener(words);
        let total = 0;
        for (let t = 0; t < 60; t++) {
            const ans = words[Math.floor(rnd() * words.length)];
            const guesses = [];
            let solved = false;
            while (guesses.length < 6) {
                const guess = guesses.length === 0
                    ? opener
                    : rankGuesses(filterIn(buildConstraints(guesses), words), words, 1)[0].word;
                guesses.push({ word: guess, states: referenceScore(guess, ans) });
                if (guess === ans) { solved = true; break; }
            }
            if (!solved) throw new Error(`Failed to solve ${ans}: ${guesses.map(g => g.word)}`);
            total += guesses.length;
        }
        expect(total / 60).toBeLessThan(4);
    });

    // ── Real World Test ──────────────────
console.log('\n🌍 Real World Test — CHU__');

test('CHU start, excluding A,I,R,O,M,P,E,S,T,L returns valid words', () => {
    const results = filterWords({
        greens:  ['c', 'h', 'u', null, null],
        yellows: {},
        greys:   ['a', 'i', 'r', 'o', 'm', 'p', 'e', 's', 't', 'l']
    });

    console.log(`     Found ${results.length} words:`);
    results.forEach(w => console.log(`     → ${w.toUpperCase()}`));

    expect(results.length).toBeGreaterThan(0);
});

    // ── Duplicate Letter Tests ───────────
    console.log('\n🔁 Duplicate Letter Tests');

    const guess = (word, states) => ({ word, states });

    test('Second L grey after first L green means exactly one L', () => {
        // SKILL-style: L green at pos 3, second L at pos 4 grey
        const c = buildConstraints([guess('skill', ['absent','absent','absent','correct','absent'])]);
        expect(c.counts.l.min).toBe(1);
        expect(c.counts.l.max).toBe(1);
        const results = filterWords(c);
        const doubleL = results.filter(w => w.split('').filter(ch => ch === 'l').length > 1);
        expect(doubleL.length).toBe(0);
        expect(results.every(w => w[3] === 'l')).toBeTrue();
    });

    test('Second L grey after first L yellow means exactly one L, not in that spot', () => {
        const c = buildConstraints([guess('hello', ['absent','absent','present','absent','absent'])]);
        const results = filterWords(c);
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(w => w.split('').filter(ch => ch === 'l').length === 1 && w[2] !== 'l')).toBeTrue();
    });

    test('Two yellow copies of a letter require at least two', () => {
        const c = buildConstraints([guess('eerie', ['present','present','absent','absent','absent'])]);
        expect(c.counts.e.min).toBe(2);
        const results = filterWords(c);
        expect(results.every(w => w.split('').filter(ch => ch === 'e').length >= 2)).toBeTrue();
    });

    test('Plain grey letter is still fully excluded', () => {
        const c = buildConstraints([guess('crane', ['absent','absent','absent','absent','absent'])]);
        const results = filterWords(c);
        expect(results.every(w => !/[crane]/.test(w))).toBeTrue();
    });

    test('Simulation: filter exactly matches real Wordle feedback (300 random games, 3 guesses each)', () => {
        const score = (guess, ans) => {
            const s = Array(5).fill('absent'), left = {};
            for (let i = 0; i < 5; i++) {
                if (guess[i] === ans[i]) s[i] = 'correct'; else left[ans[i]] = (left[ans[i]] || 0) + 1;
            }
            for (let i = 0; i < 5; i++) {
                if (s[i] !== 'absent') continue;
                if (left[guess[i]] > 0) { s[i] = 'present'; left[guess[i]]--; }
            }
            return s.join();
        };
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const pick = () => words[Math.floor(rnd() * words.length)];
        for (let t = 0; t < 300; t++) {
            const ans = pick();
            const guesses = [pick(), pick(), pick()].map(g => ({ word: g, states: score(g, ans).split(',') }));
            const got = filterWords(buildConstraints(guesses)).sort().join();
            const truth = words.filter(w => guesses.every(g => score(g.word, w) === g.states.join())).sort().join();
            if (got !== truth) throw new Error(`answer ${ans}, guesses ${guesses.map(g => g.word)}: filter and real Wordle feedback disagree`);
        }
    });

    // ── Fallback To All Valid Words ──────
    console.log('\n🔎 Fallback Tests');

    test('Valid-word list contains every known answer', () => {
        const valid = new Set(validWords);
        const missing = words.filter(w => !valid.has(w));
        expect(missing.length).toBe(0);
        expect(validWords.length).toBeGreaterThan(words.length);
    });

    test('When no known answer fits, falls back to valid words (STARE / STEER case)', () => {
        const guesses = [
            { word: 'stare', states: ['correct','correct','absent','present','present'] },
            { word: 'steer', states: ['correct','correct','absent','correct','present'] }
        ];
        const found = findCandidates(buildConstraints(guesses), words, validWords);
        expect(filterIn(buildConstraints(guesses), words).length).toBe(0);
        expect(found.source).toBe('valid');
        expect(found.candidates).toContain('strew');
        expect(found.candidates).toContain('strep');
        expect(found.candidates.length).toBe(2);
    });

    test('Known answers are used when some fit, and extra valid words are only counted', () => {
        const guesses = [{ word: 'crane', states: ['correct','absent','absent','absent','absent'] }];
        const found = findCandidates(buildConstraints(guesses), words, validWords);
        expect(found.source).toBe('answers');
        expect(found.candidates.every(w => words.includes(w))).toBeTrue();
        expect(found.others).toBeGreaterThan(0);
    });

    test('Fallback is off when no valid-word list is given', () => {
        const guesses = [
            { word: 'stare', states: ['correct','correct','absent','present','present'] },
            { word: 'steer', states: ['correct','correct','absent','correct','present'] }
        ];
        const found = findCandidates(buildConstraints(guesses), words);
        expect(found.candidates.length).toBe(0);
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