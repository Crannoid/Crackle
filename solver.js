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
 * Ranks remaining words by letter frequency.
 * More than 50 words left: overall frequency (explore). 50 or fewer: positional (narrow).
 *
 * @returns {Array} [{ word, score }] best first, at most n long
 */
function rankWords(validWords, n = validWords.length) {
    if (validWords.length === 0) return [];
    let scored;
    if (validWords.length <= 50) {
        const pos = [{},{},{},{},{}];
        for (const w of validWords) {
            for (let i = 0; i < 5; i++) pos[i][w[i]] = (pos[i][w[i]] || 0) + 1;
        }
        scored = validWords.map(w => ({
            word: w, score: w.split('').reduce((s, l, i) => s + (pos[i][l] || 0), 0)
        }));
    } else {
        const freq = {};
        for (const w of validWords) {
            for (const l of new Set(w)) freq[l] = (freq[l] || 0) + 1;
        }
        scored = validWords.map(w => ({
            word: w, score: [...new Set(w)].reduce((s, l) => s + (freq[l] || 0), 0)
        }));
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, n);
}

export { buildConstraints, filterWords, rankWords };
