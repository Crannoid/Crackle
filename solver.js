// solver.js — Wordle solver logic, shared by the app (index.html) and the tests.
// Pure functions only: no DOM, no fetch, no globals. Pass the word list in.

/**
 * Folds a list of guesses into constraints, including exact letter counts.
 *
 * Each guess is { word, states[5] } with states 'absent' | 'present' | 'correct'.
 * Wordle colours duplicate letters one copy at a time, so for each letter in a
 * guess: the green + yellow copies are how many the answer has AT LEAST, and
 * if any copy of that letter is grey in the same guess, the answer has EXACTLY
 * that many (zero if none were green/yellow). A grey copy also rules out its
 * own position.
 *
 * @returns {{greens, yellows, greys, counts, notAt}}
 *          counts is { letter: { min, max } } (max is Infinity when unbounded)
 *          notAt  is { letter: [positions the letter cannot be] }
 */
function buildConstraints(guesses) {
    const greens  = [null, null, null, null, null];
    const yellows = {};
    const greys   = [];
    const counts  = {};
    const notAt   = {};   // positions where a letter is known NOT to be (from grey copies)

    for (const g of guesses) {
        const found = {};      // green + yellow copies of each letter in this guess
        const hasGrey = {};    // letters with at least one grey copy in this guess
        const greyPos = [];    // [letter, index] for each grey tile

        for (let i = 0; i < 5; i++) {
            const letter = g.word[i];
            const state  = g.states[i];
            if (state === 'correct') {
                greens[i] = letter;
                found[letter] = (found[letter] || 0) + 1;
            } else if (state === 'present') {
                if (!yellows[letter]) yellows[letter] = [];
                if (!yellows[letter].includes(i)) yellows[letter].push(i);
                found[letter] = (found[letter] || 0) + 1;
            } else {
                if (!greys.includes(letter)) greys.push(letter);
                hasGrey[letter] = true;
                greyPos.push([letter, i]);
            }
        }

        // A grey copy of a letter also rules out that exact position
        for (const [letter, i] of greyPos) {
            if (!notAt[letter]) notAt[letter] = [];
            if (!notAt[letter].includes(i)) notAt[letter].push(i);
        }

        for (const letter of new Set([...Object.keys(found), ...Object.keys(hasGrey)])) {
            const c = counts[letter] || (counts[letter] = { min: 0, max: Infinity });
            const n = found[letter] || 0;
            c.min = Math.max(c.min, n);
            if (hasGrey[letter]) c.max = Math.min(c.max, n);
        }
    }

    return { greens, yellows, greys, counts, notAt };
}

/**
 * Returns the words that satisfy every constraint.
 *
 * @param {Object} constraints
 * @param {Array}  constraints.greens  - 5 items, letter confirmed at that position or null
 * @param {Object} constraints.yellows - { 'r': [0, 2] }: 'r' is in the word, but not at 0 or 2
 * @param {Array}  constraints.greys   - letters marked absent
 * @param {Object} [constraints.counts] - { 'l': { min, max } } exact letter counts. When given
 *                                       it replaces the simple grey rule.
 * @param {Object} [constraints.notAt]  - { 'e': [3] } positions a letter cannot be
 * @param {Array}  words - the list to filter
 */
function filterWords(constraints, words) {
    const { greens = [null,null,null,null,null], yellows = {}, greys = [], counts, notAt = {} } = constraints;

    return words.filter(word => {
        // Greens: right letter in the right place
        for (let i = 0; i < 5; i++) {
            if (greens[i] && word[i] !== greens[i]) return false;
        }

        // Yellows: letter is in the word, but not at its excluded positions
        for (const [letter, excludedPositions] of Object.entries(yellows)) {
            if (!word.includes(letter)) return false;
            for (const pos of excludedPositions) {
                if (word[pos] === letter) return false;
            }
        }

        // Greys: letter must not appear, unless it is also green or yellow
        // (only used when no exact counts were supplied)
        for (const letter of counts ? [] : greys) {
            if (!greens.includes(letter) && !(letter in yellows) && word.includes(letter)) return false;
        }

        // A grey copy of a letter rules out its own position
        for (const [letter, positions] of Object.entries(notAt)) {
            for (const pos of positions) {
                if (word[pos] === letter) return false;
            }
        }

        // Exact letter counts: min <= occurrences <= max
        if (counts) {
            for (const [letter, { min, max }] of Object.entries(counts)) {
                let n = 0;
                for (const ch of word) if (ch === letter) n++;
                if (n < min || n > max) return false;
            }
        }

        return true;
    });
}

/**
 * Works out which words are still possible.
 *
 * Normally that is the known Wordle answers that fit the constraints. But the
 * NYT's answers are not all in our list, so when no known answer fits, fall
 * back to every valid word that does.
 *
 * @param {Object} constraints - from buildConstraints()
 * @param {Array}  answers     - known Wordle answers
 * @param {Array}  validWords  - every word Wordle accepts (should include the answers)
 * @returns {{ candidates: Array, source: 'answers'|'valid', others: number, otherWords: Array }}
 *          source 'valid' means no known answer fits and candidates are plain valid words.
 *          otherWords are the extra valid (non-answer) words that also fit when source is 'answers'
 *          (others is how many); they are shown, not ranked.
 */
function findCandidates(constraints, answers, validWords = []) {
    const known = filterWords(constraints, answers);
    const fromValid = validWords.length ? filterWords(constraints, validWords) : [];
    if (known.length === 0 && fromValid.length > 0) {
        return { candidates: fromValid, source: 'valid', others: 0, otherWords: [] };
    }
    const knownSet = new Set(known);
    const otherWords = fromValid.filter(w => !knownSet.has(w));
    return { candidates: known, source: 'answers', others: otherWords.length, otherWords };
}

const POW3 = [1, 3, 9, 27, 81];
const ALL_GREEN = 242;            // pattern code for 5 x correct
const left = new Int8Array(26);   // scratch buffer: unmatched answer letters

/**
 * Wordle feedback for a guess against an answer, packed into one number
 * (base 3, position i has weight 3^i: 0 absent, 1 present, 2 correct).
 * Follows the official duplicate-letter rules. Allocation-free because the
 * ranker calls it millions of times.
 */
function patternCode(guess, answer) {
    left.fill(0);
    let code = 0, green = 0;
    for (let i = 0; i < 5; i++) {
        const g = guess.charCodeAt(i), a = answer.charCodeAt(i);
        if (g === a) { code += 2 * POW3[i]; green |= 1 << i; }
        else left[a - 97]++;
    }
    for (let i = 0; i < 5; i++) {
        if (green & (1 << i)) continue;
        const c = guess.charCodeAt(i) - 97;
        if (left[c] > 0) { left[c]--; code += POW3[i]; }
    }
    return code;
}

/** Feedback as ['absent' | 'present' | 'correct' x5], the same shape the app stores. */
function scoreGuess(guess, answer) {
    const names = ['absent', 'present', 'correct'];
    let code = patternCode(guess, answer);
    const states = [];
    for (let i = 0; i < 5; i++) { states.push(names[code % 3]); code = Math.floor(code / 3); }
    return states;
}

// Average extra guesses still needed once the candidates are down to a group of
// c words, measured by simulating thousands of games with this solver
// (2026-10-09): 1 word -> 1, 2 -> 1.5, 3 -> 1.8, ... then growing with log2(c).
const EXTRA_GUESSES_SMALL = [0, 1, 1.5, 1.8, 1.9, 1.95, 2.0, 2.1, 2.1];
function extraGuesses(c) {
    return c < EXTRA_GUESSES_SMALL.length ? EXTRA_GUESSES_SMALL[c] : 2.1 + 0.2 * Math.log2(c / 8);
}

// Estimates are noisy, so a guess that could itself be the answer is preferred unless
// a probe is clearly better (it can also finish the game early).
const CANDIDATE_BONUS = 0.1;

/**
 * Ranks guesses by estimated total guesses to finish (lower is better).
 *
 * For each possible guess, play it against every remaining candidate and group
 * the candidates by the feedback they would produce. With the answer equally
 * likely to be any candidate, the estimate is 1 (this guess) plus, for each
 * group that is not the all-green win, its share of the candidates times the
 * extra guesses a group of that size still needs.
 *
 * Guesses may come from `pool` (any known Wordle word), not only the candidates,
 * so a "probe" word that is not a possible answer can win when it splits the
 * candidates well enough to beat guessing a real answer. With 2 or fewer
 * candidates a probe cannot help, so only candidates are considered.
 *
 * @param {Array}  candidates - words still possible
 * @param {Array}  pool       - words allowed as guesses
 * @param {number} n          - how many to return
 * @returns {Array} [{ word, score, isCandidate }] best first; score = estimated guesses to finish
 *          (candidates get CANDIDATE_BONUS knocked off)
 */
function rankGuesses(candidates, pool, n = 20) {
    const N = candidates.length;
    if (N === 0) return [];
    if (N === 1) return [{ word: candidates[0], score: 1, isCandidate: true }];

    const candidateSet = new Set(candidates);
    let guesses = candidates;
    if (N > 2) {
        const poolSet = new Set(pool);
        guesses = pool.concat(candidates.filter(w => !poolSet.has(w)));
    }

    const buckets = new Int32Array(ALL_GREEN + 1);
    const results = [];
    for (const guess of guesses) {
        buckets.fill(0);
        for (let j = 0; j < N; j++) buckets[patternCode(guess, candidates[j])]++;
        let expected = 1;
        for (let k = 0; k < ALL_GREEN; k++) {
            const size = buckets[k];
            if (size > 0) expected += (size / N) * extraGuesses(size);
        }
        const isCandidate = candidateSet.has(guess);
        results.push({ word: guess, score: isCandidate ? expected - CANDIDATE_BONUS : expected, isCandidate });
    }

    results.sort((x, y) =>
        x.score - y.score ||
        (y.isCandidate - x.isCandidate) ||
        (x.word < y.word ? -1 : 1));
    return results.slice(0, n);
}

/** Best first guess for a fresh game: the top-ranked word with every word still possible. */
function bestOpener(words) {
    return rankGuesses(words, words, 1)[0].word;
}

export { buildConstraints, filterWords, findCandidates, patternCode, scoreGuess, rankGuesses, bestOpener };
