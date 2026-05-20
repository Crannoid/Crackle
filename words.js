// words.js — Word List Loader for Wordle Solver

// We load the word list from a public source at runtime.
// Source: Standard Wordle answers list (~2,315 common 5-letter words)
// This avoids bundling a large word list into your codebase.

const WORD_LIST_URL = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words';

let wordList = [];

async function loadWordList() {
    try {
        const response = await fetch(WORD_LIST_URL);
        if (!response.ok) throw new Error(`Failed to load word list: ${response.status}`);
        const text = await response.text();

        // Parse: one word per line, lowercase, exactly 5 letters
        wordList = text
            .split('\n')
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length === 5 && /^[a-z]+$/.test(w));

        console.log(`Word list loaded: ${wordList.length} words`);
        return wordList;

    } catch (error) {
        console.error('Error loading word list:', error);
        throw error;
    }
}

function getWordList() {
    if (wordList.length === 0) {
        throw new Error('Word list not loaded yet. Call loadWordList() first.');
    }
    return wordList;
}

export { loadWordList, getWordList };