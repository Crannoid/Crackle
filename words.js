// words.js — Word List Loader for Wordle Solver

// Loads the Wordle word lists from data/ (answers.txt, valid-words.txt).
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

let validList = [];

// Every word Wordle accepts as a guess (used only as a fallback when no known answer fits)
async function loadValidWords() {
    const { readFile } = await import('node:fs/promises');
    const text = await readFile(new URL('./data/valid-words.txt', import.meta.url), 'utf8');
    validList = text.split(/\r?\n/).map(x => x.trim().toLowerCase()).filter(x => /^[a-z]{5}$/.test(x));
    return validList;
}

function getValidWords() {
    if (validList.length === 0) throw new Error('Valid words not loaded yet. Call loadValidWords() first.');
    return validList;
}

export { loadWordList, getWordList, loadValidWords, getValidWords };