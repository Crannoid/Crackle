// ranker.js — Word Ranking Algorithm for Wordle Solver
// Scores remaining valid words to suggest the best next guess.

/**
 * Builds a letter frequency map from a list of words.
 * Counts how many words contain each letter (not raw occurrences).
 * This avoids over-rewarding words with repeated common letters.
 *
 * @param {Array} words - list of candidate words
 * @returns {Object} e.g. { 'e': 1204, 'a': 975, ... }
 */
function buildFrequencyMap(words) {
    const freq = {};

    for (const word of words) {
        // Use a Set so duplicate letters in one word only count once
        const uniqueLetters = new Set(word.split(''));
        for (const letter of uniqueLetters) {
            freq[letter] = (freq[letter] || 0) + 1;
        }
    }

    return freq;
}

/**
 * Builds a positional frequency map.
 * Counts how often each letter appears at each specific position.
 *
 * @param {Array} words
 * @returns {Array} array of 5 objects, one per position
 *                  e.g. [ { 's': 365, 'c': 198 }, ... ]
 */
function buildPositionalFrequencyMap(words) {
    const positional = [{}, {}, {}, {}, {}];

    for (const word of words) {
        for (let i = 0; i < 5; i++) {
            const letter = word[i];
            positional[i][letter] = (positional[i][letter] || 0) + 1;
        }
    }

    return positional;
}

/**
 * Scores a single word using overall letter frequency.
 * Higher score = more informative guess.
 *
 * @param {string} word
 * @param {Object} freqMap
 * @returns {number}
 */
function scoreWordOverall(word, freqMap) {
    const uniqueLetters = new Set(word.split(''));
    let score = 0;
    for (const letter of uniqueLetters) {
        score += freqMap[letter] || 0;
    }
    return score;
}

/**
 * Scores a single word using positional letter frequency.
 * Rewards words where each letter is common at that specific position.
 *
 * @param {string} word
 * @param {Array}  positionalMap
 * @returns {number}
 */
function scoreWordPositional(word, positionalMap) {
    let score = 0;
    for (let i = 0; i < 5; i++) {
        score += positionalMap[i][word[i]] || 0;
    }
    return score;
}

/**
 * Main ranking function.
 * Ranks remaining valid words by how useful they are as a next guess.
 *
 * Automatically switches strategy based on how many words remain:
 * - Many words remaining (>50): use overall frequency (explore broadly)
 * - Few words remaining (≤50): use positional frequency (narrow precisely)
 *
 * @param {Array} validWords - output from filterWords()
 * @returns {Array} same words, sorted best guess first, with scores attached
 */
function rankWords(validWords) {
    if (validWords.length === 0) return [];

    // Choose strategy based on how many candidates remain
    const usePositional = validWords.length <= 50;

    let scoredWords;

    if (usePositional) {
        const positionalMap = buildPositionalFrequencyMap(validWords);
        scoredWords = validWords.map(word => ({
            word,
            score: scoreWordPositional(word, positionalMap),
            strategy: 'positional'
        }));
    } else {
        const freqMap = buildFrequencyMap(validWords);
        scoredWords = validWords.map(word => ({
            word,
            score: scoreWordOverall(word, freqMap),
            strategy: 'overall'
        }));
    }

    // Sort highest score first
    return scoredWords.sort((a, b) => b.score - a.score);
}

/**
 * Returns just the top N suggestions (default 10).
 *
 * @param {Array}  validWords - output from filterWords()
 * @param {number} n          - how many suggestions to return
 * @returns {Array} top N ranked words
 */
function getTopSuggestions(validWords, n = 10) {
    return rankWords(validWords).slice(0, n);
}

export { rankWords, getTopSuggestions };