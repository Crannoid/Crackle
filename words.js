// words.js — Word List Loader for Wordle Solver

// Loads the Wordle answer list from data/answers.txt (the original 2,315 answers).
// Uses fs under Node (tests); the browser app has its own loader in index.html.

const WORD_LIST_URL = new URL('./data/answers.txt', import.meta.url);

let wordList = [];

async function loadWordList() {
    try {
        const { readFile } = await import('node:fs/promises');
        const text = await readFile(WORD_LIST_URL, 'utf8');

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