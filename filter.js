// filter.js — Constraint Filter Engine for Wordle Solver
// Filters a word list based on green, yellow, and grey letter constraints.

import { getWordList } from './words.js';

/**
 * Main filter function.
 *
 * @param {Object} constraints
 * @param {Array}  constraints.greens  - Array of 5 items, e.g. [null, 'a', null, null, 'e']
 *                                       null means unknown, a letter means confirmed at that position
 * @param {Object} constraints.yellows - e.g. { 'r': [0, 2] } means 'r' is in the word
 *                                       but NOT at positions 0 or 2
 * @param {Array}  constraints.greys   - e.g. ['t', 'n', 's'] letters confirmed not in word
 * @param {Object} [constraints.counts] - e.g. { 'l': { min: 1, max: 1 } } exact letter counts.
 *                                       When given, it replaces the simple grey rule (Rule 3).
 *
 * @returns {Array} filtered list of valid words
 */
function filterWords(constraints) {
    const { greens = [null,null,null,null,null], yellows = {}, greys = [], counts, notAt = {} } = constraints;

    const words = getWordList();

    return words.filter(word => {

        // ✅ Rule 1: Green letters must be in the correct position
        for (let i = 0; i < 5; i++) {
            if (greens[i] && word[i] !== greens[i]) {
                return false;
            }
        }

        // ✅ Rule 2: Yellow letters must appear in the word,
        //           but NOT at the positions where they were yellow
        for (const [letter, excludedPositions] of Object.entries(yellows)) {
            // Word must contain this letter
            if (!word.includes(letter)) return false;

            // Letter must not appear at any of its excluded positions
            for (const pos of excludedPositions) {
                if (word[pos] === letter) return false;
            }
        }

        // ✅ Rule 3: Grey letters must not appear in the word
        //           UNLESS they also appear as green or yellow
        //           (handles duplicate letter edge case)
        for (const letter of counts ? [] : greys) {
            const isGreen  = greens.includes(letter);
            const isYellow = letter in yellows;

            if (!isGreen && !isYellow && word.includes(letter)) {
                return false;
            }
        }


        // Rule 5: a grey copy of a letter rules out its own position
        for (const [letter, positions] of Object.entries(notAt)) {
            for (const pos of positions) {
                if (word[pos] === letter) return false;
            }
        }

        // Rule 4: exact letter counts (handles duplicate letters, e.g. one L
        //         confirmed and a second L greyed means exactly one L)
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
 * Folds a list of guesses into constraints, including exact letter counts.
 *
 * Each guess is { word, states[5] } with states 'absent' | 'present' | 'correct'.
 * Wordle colours duplicate letters one copy at a time, so for each letter in a
 * guess: the green + yellow copies are how many the answer has AT LEAST, and
 * if any copy of that letter is grey in the same guess, the answer has EXACTLY
 * that many (zero if none were green/yellow).
 *
 * @returns {{greens, yellows, greys, counts}} counts is { letter: { min, max } }
 *          where max is Infinity when no upper bound is known.
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

export { filterWords, buildConstraints };