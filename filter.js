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
 *
 * @returns {Array} filtered list of valid words
 */
function filterWords(constraints) {
    const { greens = [null,null,null,null,null], yellows = {}, greys = [] } = constraints;

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
        for (const letter of greys) {
            const isGreen  = greens.includes(letter);
            const isYellow = letter in yellows;

            if (!isGreen && !isYellow && word.includes(letter)) {
                return false;
            }
        }

        return true;
    });
}

export { filterWords };