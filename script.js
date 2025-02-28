// Show a progressive loader animation
function showProgressiveLoader() {
    // Make sure the status message is visible
    statusMessage.style.display = 'block';
    
    // Reset progress bar
    const progressBar = document.getElementById('indexing-progress');
    progressBar.style.width = '0%';
    
    // If animation is already running, don't start another one
    if (state.loaderAnimationRunning) return;
    
    state.loaderAnimationRunning = true;
    
    // Use a more subtle loading animation in the status message
    let dots = 0;
    state.loaderInterval = setInterval(() => {
        if (!state.loading) {
            clearInterval(state.loaderInterval);
            state.loaderAnimationRunning = false;
            return;
        }
        
        dots = (dots + 1) % 4;
        const dotStr = '.'.repeat(dots);
        
        // Only update the loading message if it's still showing
        if (statusMessage.textContent.includes('Loading') || 
            statusMessage.textContent.includes('Initializing')) {
            statusMessage.textContent = statusMessage.textContent.replace(/\.{0,3}$/, dotStr);
        }
    }, 500);
}    // Initialize the application
async function init() {
    showLoader(true);
    statusMessage.style.display = 'block';
    statusMessage.textContent = 'Initializing search engine...';
    
    // Record start time for performance tracking
    state.startTime = Date.now();
    
    try {
        // Show loader animation during initial state setup
        showProgressiveLoader();
        
        // Get documents data
        cachedDocuments = await documentsDataPromise;
        
        // Process documents and extract terms
        processDocuments(cachedDocuments);
        
        // Initialize date pickers after documents are loaded
        initializeDatePickers();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        statusMessage.textContent = 'Error loading corpus data. Please refresh the page.';
        showLoader(false);
    }
}    // Update chart options for responsiveness
function updateChartResponsiveness() {
    // Get window width
    const windowWidth = window.innerWidth;
    
    // Term frequency chart responsiveness
    if (state.visualizations.termFrequencyChart) {
        // For smaller screens, adjust label rotation and padding
        if (windowWidth < 768) {
            state.visualizations.termFrequencyChart.options.scales.x.ticks.maxRotation = 90;
            state.visualizations.termFrequencyChart.options.scales.x.ticks.minRotation = 90;
            
            // Show fewer labels on small screens
            state.visualizations.termFrequencyChart.options.scales.x.ticks.callback = function(value, index, values) {
                // Show only every other label on small screens
                if (values.length > 5 && index % 2 !== 0) {
                    return '';
                }
                return this.getLabelForValue(value);
            };
        } else {
            state.visualizations.termFrequencyChart.options.scales.x.ticks.maxRotation = 45;
            state.visualizations.termFrequencyChart.options.scales.x.ticks.minRotation = 45;
            state.visualizations.termFrequencyChart.options.scales.x.ticks.callback = null;
        }
        
        state.visualizations.termFrequencyChart.update();
    }
    
    // Document relevance chart responsiveness
    if (state.visualizations.documentRelevanceChart) {
        if (windowWidth < 768) {
            // On small screens, show even shorter labels
            state.visualizations.documentRelevanceChart.options.scales.y.ticks.callback = function(value, index, values) {
                const label = this.getLabelForValue(value);
                if (label && label.length > 10) {
                    return label.substr(0, 10) + '...';
                }
                return label;
            };
        } else {
            state.visualizations.documentRelevanceChart.options.scales.y.ticks.callback = function(value, index, values) {
                const label = this.getLabelForValue(value);
                if (label && label.length > 20) {
                    return label.substr(0, 20) + '...';
                }
                return label;
            };
        }
        
        state.visualizations.documentRelevanceChart.update();
    }
}document.addEventListener('DOMContentLoaded', function() {
// Initialize state
const state = {
    currentQuery: '',
    currentPage: 1,
    resultsPerPage: 20,
    totalResults: 0,
    results: [],
    documents: {},
    terms: {},
    sortOrder: 'relevance',
    matchType: 'all',
    minScore: 0,
    dateRangeMin: '',
    dateRangeMax: '',
    loading: false,
    darkMode: localStorage.getItem('darkMode') === 'true',
    activeTags: new Set(),
    currentDocumentId: null,
    startTime: Date.now(),
    loaderAnimationRunning: false,
    loaderInterval: null,
    statistics: {
        totalDocuments: 0,
        uniqueTerms: 0,
        indexedFiles: 0,
        lastIndexed: null
    },
    visualizations: {
        termFrequencyChart: null,
        documentRelevanceChart: null
    }
};

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchLoader = document.getElementById('search-loader');
const statusMessage = document.getElementById('status-message');
const resultsGrid = document.getElementById('results-grid');
const resultsCount = document.getElementById('results-count');
const pagination = document.getElementById('pagination');
const advancedSearchToggle = document.getElementById('advanced-search-toggle');
const advancedSearch = document.getElementById('advanced-search');
const toggleIcon = document.getElementById('toggle-icon');
const resultLimit = document.getElementById('result-limit');
const matchType = document.getElementById('match-type');
const sortBy = document.getElementById('sort-by');
const resultsSort = document.getElementById('results-sort');
const minScore = document.getElementById('min-score');
const minScoreValue = document.getElementById('min-score-value');
const dateRangeMin = document.getElementById('date-range-min');
const dateRangeMax = document.getElementById('date-range-max');
const popularTerms = document.getElementById('popular-terms');
const totalDocumentsEl = document.getElementById('total-documents');
const uniqueTermsEl = document.getElementById('unique-terms');
const indexedFilesEl = document.getElementById('indexed-files');
const lastIndexedEl = document.getElementById('last-indexed');
const documentModal = document.getElementById('document-modal');
const modalTitle = document.getElementById('modal-title');
const documentMeta = document.getElementById('document-meta');
const documentContent = document.getElementById('document-content');
const similarDocumentsList = document.getElementById('similar-documents-list');
const closeModal = document.getElementById('close-modal');
const prevDoc = document.getElementById('prev-doc');
const nextDoc = document.getElementById('next-doc');
const vizTabs = document.querySelectorAll('.viz-tab');
const vizContents = document.querySelectorAll('.viz-content');
const termFrequencyChartEl = document.getElementById('term-frequency-chart');
const documentRelevanceChartEl = document.getElementById('document-relevance-chart');
const themeToggleIcon = document.getElementById('theme-toggle-icon');

// Fetch documents from our local files
const documentsDataPromise = fetchDocumentsFromFiles();
let cachedDocuments = [];

// Apply dark mode if it was previously enabled
if (state.darkMode) {
    document.body.classList.add('dark-mode');
    themeToggleIcon.classList.replace('fa-moon', 'fa-sun');
}

// Initialize the application
async function init() {
    showLoader(true);
    statusMessage.style.display = 'block';
    statusMessage.textContent = 'Loading corpus data...';

    try {
        // Get documents data
        cachedDocuments = await documentsDataPromise;
        
        // Process documents and extract terms
        processDocuments(cachedDocuments);
        
        // Update statistics
        updateStatistics();
        
        // Render popular terms
        renderPopularTerms();
        
        // Initialize visualizations
        initializeVisualizations();

        // Set default state for the UI
        minScoreValue.textContent = minScore.value + '%';
        
        // Show ready message
        statusMessage.textContent = 'Ready. Enter a search query to begin.';
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        statusMessage.textContent = 'Error loading corpus data. Please refresh the page.';
    } finally {
        showLoader(false);
    }
}

// Process documents and extract terms
function processDocuments(documents) {
    const allTerms = {};
    const processedDocs = {};
    
    // Process documents in chunks to avoid UI freezing
    const chunkSize = 10;
    let processedCount = 0;
    const totalDocs = documents.length;
    const startTime = Date.now();
    
    function processChunk(startIndex) {
        const endIndex = Math.min(startIndex + chunkSize, documents.length);
        let newTermsInChunk = 0;
        
        for (let i = startIndex; i < endIndex; i++) {
            const doc = documents[i];
            if (!doc) continue;
            
            // Extract terms from content (or use pre-extracted terms if available)
            const terms = doc.quickTerms || extractTerms(doc.content);
            
            // Store processed document
            processedDocs[doc.id] = {
                ...doc,
                terms: terms
            };
            
            // Count term frequencies (limit to most common terms)
            const termCounts = {};
            terms.forEach(term => {
                if (!termCounts[term]) {
                    termCounts[term] = 0;
                }
                termCounts[term]++;
            });
            
            // Only store the top 100 terms per document in the global counts
            // to avoid memory issues with very common terms
            Object.entries(termCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 100)
                .forEach(([term, count]) => {
                    if (!allTerms[term]) {
                        allTerms[term] = 0;
                        newTermsInChunk++;
                    }
                    allTerms[term] += count;
                });
            
            processedCount++;
            
            // Update progress in real-time
            if (processedCount % 5 === 0 || processedCount === totalDocs) {
                updateProcessingProgress(processedCount, totalDocs, Object.keys(allTerms).length, newTermsInChunk);
            }
        }
        
        // Update status message
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        const percent = Math.round((processedCount / totalDocs) * 100);
        statusMessage.textContent = `Processing documents: ${processedCount}/${totalDocs} (${percent}%)`;
        statusMessage.textContent += `\nElapsed time: ${formatTime(elapsedSeconds)} - Terms: ${Object.keys(allTerms).length.toLocaleString()}`;
        
        // Visual progress bar
        const progressBar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
        statusMessage.textContent += `\n${progressBar}`;
        
        // If there are more documents to process, schedule the next chunk
        if (endIndex < documents.length) {
            // Use requestAnimationFrame to avoid blocking the UI
            requestAnimationFrame(() => processChunk(endIndex));
        } else {
            // All documents processed, update state and UI
            finishProcessing();
            
            // Calculate total processing time
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            console.log(`Processing completed in ${formatTime(totalTime)}`);
            statusMessage.textContent = `Processing completed! Ready for searching.`;
        }
    }
    
    function updateProcessingProgress(processed, total, termCount, newTerms) {
        // Update statistics display in real-time
        totalDocumentsEl.textContent = total;
        uniqueTermsEl.textContent = termCount.toLocaleString();
        indexedFilesEl.textContent = processed;
        lastIndexedEl.textContent = new Date().toLocaleString();
        
        // Update state
        state.statistics.totalDocuments = total;
        state.statistics.uniqueTerms = termCount;
        state.statistics.indexedFiles = processed;
        
        // Periodically update the term cloud during processing
        if (processed % 20 === 0 || processed === total) {
            updateTermCloud(allTerms);
        }
    }
    
    function updateTermCloud(terms) {
        // Update the popular terms tag cloud
        popularTerms.innerHTML = '';
        
        // Sort terms by frequency and take top 15
        const sortedTerms = Object.entries(terms)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);
        
        // Create tag elements
        sortedTerms.forEach(([term, count]) => {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.textContent = `${term} (${count})`;
            tag.dataset.term = term;
            
            tag.addEventListener('click', () => {
                toggleTagSelection(tag, term);
                
                if (tag.classList.contains('active')) {
                    const currentTerms = searchInput.value.split(' ').filter(t => t.trim());
                    if (!currentTerms.includes(term)) {
                        searchInput.value = currentTerms.length > 0 ? searchInput.value + ' ' + term : term;
                    }
                } else {
                    const currentTerms = searchInput.value.split(' ').filter(t => t.trim() && t !== term);
                    searchInput.value = currentTerms.join(' ');
                }
            });
            
            popularTerms.appendChild(tag);
        });
    }
    
    function finishProcessing() {
        // Update state
        state.documents = processedDocs;
        state.terms = allTerms;
        state.statistics.lastIndexed = new Date().toLocaleString();
        
        // Update UI
        updateStatistics();
        renderPopularTerms();
        
        // Show ready message
        statusMessage.textContent = 'Ready. Enter a search query to begin.';
        showLoader(false);
    }
    
    // Format seconds into mm:ss
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Start processing chunks
    showLoader(true);
    statusMessage.textContent = 'Processing documents...';
    requestAnimationFrame(() => processChunk(0));
}

// Extract terms from document content
function extractTerms(content) {
    if (!content) return [];
    
    // Convert to lowercase and get text content only (remove HTML tags)
    let text = content.toLowerCase();
    
    // If it contains HTML, extract just the text content
    if (text.includes('<html>') || text.includes('<pre>')) {
        try {
            // Create a DOM parser to extract text from HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            text = doc.body.textContent || '';
        } catch (e) {
            // Fallback to a simple regex approach if parsing fails
            text = text.replace(/<[^>]*>/g, ' ');
        }
    }
    
    // Clean up text: remove special characters and normalize whitespace
    text = text.replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Split into words and filter out stop words, numbers, and short terms
    // Limit the number of terms per document to avoid memory issues (max 5000 terms)
    return text.split(' ')
        .filter(term => {
            return term.length > 2 && !isStopWord(term) && isNaN(parseInt(term));
        })
        .slice(0, 5000);
}

// Check if a word is a stop word
function isStopWord(word) {
    const stopWords = ['the', 'and', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those', 'it', 'its'];
    return stopWords.includes(word);
}

// Fetch documents from GitHub
async function fetchDocumentsFromFiles() {
    showLoader(true);
    statusMessage.textContent = 'Loading corpus from GitHub...';
    
    const documents = [];
    const baseUrl = 'https://raw.githubusercontent.com/ianmaloba/CS-3308-Information-Retrieval/main/CACM_Corpus/cacm/';
    const maxDocs = 570; // Load all 570 documents
    
    try {
        // Initialize progressive statistics
        updateProgressiveStats(0, maxDocs, 0, 0);
        
        // Fetch documents in parallel in batches of 10 to avoid overwhelming the browser
        const batchSize = 10;
        let processedTerms = 0;
        let uniqueTermsCount = 0;
        const uniqueTermsSet = new Set();
        
        for (let startIdx = 1; startIdx <= maxDocs; startIdx += batchSize) {
            const endIdx = Math.min(startIdx + batchSize - 1, maxDocs);
            const batchPromises = [];
            
            for (let i = startIdx; i <= endIdx; i++) {
                const paddedNum = i.toString().padStart(4, '0');
                const docUrl = `${baseUrl}CACM-${paddedNum}.html`;
                
                batchPromises.push(
                    fetch(docUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to fetch document CACM-${paddedNum}.html`);
                            }
                            return response.text();
                        })
                        .then(content => {
                            // Extract metadata from HTML document
                            let title = '';
                            let authors = '';
                            let date = '';
                            
                            if (content.includes('<pre>')) {
                                const lines = content.split('\n');
                                
                                // Find title (first non-empty line after <pre> that's not CACM)
                                for (let j = 0; j < lines.length; j++) {
                                    const line = lines[j].trim();
                                    if (line === '<pre>') {
                                        // Start looking for title
                                        for (let k = j + 1; k < lines.length; k++) {
                                            const nextLine = lines[k].trim();
                                            if (nextLine && !nextLine.includes('CACM')) {
                                                title = nextLine;
                                                break;
                                            }
                                        }
                                        break;
                                    }
                                }
                                
                                // Find date
                                const cacmLine = lines.find(line => line.includes('CACM'))?.trim() || '';
                                date = cacmLine.replace('CACM', '').trim();
                                
                                // Find authors
                                const authorLine = lines.find(line => 
                                    !line.includes('CACM') && 
                                    line.trim() && 
                                    /[A-Z][a-z]+,\s[A-Z]\./.test(line)
                                )?.trim() || '';
                                authors = authorLine;
                            }
                            
                            // Quick term extraction for progressive stats
                            const quickTerms = extractTerms(content);
                            processedTerms += quickTerms.length;
                            
                            // Add unique terms to set
                            quickTerms.forEach(term => uniqueTermsSet.add(term));
                            uniqueTermsCount = uniqueTermsSet.size;
                            
                            return {
                                id: i,
                                title: title || `Document ${i}`,
                                filename: `CACM-${paddedNum}.html`,
                                authors: authors,
                                date: date,
                                content: content,
                                quickTerms: quickTerms,
                                score: 0
                            };
                        })
                        .catch(error => {
                            console.error(`Error fetching document ${i}:`, error);
                            // Return null for failed documents
                            return null;
                        })
                );
            }
            
            // Wait for all documents in this batch to be fetched
            const batchResults = await Promise.all(batchPromises);
            
            // Add successful fetches to documents array
            batchResults.forEach(doc => {
                if (doc) {
                    documents.push(doc);
                }
            });
            
            // Update status message with progress and statistics
            updateProgressiveStats(
                documents.length, 
                maxDocs, 
                processedTerms,
                uniqueTermsCount
            );
            
            // Update popular terms in real time (every few batches)
            if (documents.length % 30 === 0 || documents.length === maxDocs) {
                updateProgressiveTermCloud(documents);
            }
        }
        
        console.log(`Successfully loaded ${documents.length} documents.`);
        return documents;
    } catch (error) {
        console.error('Error fetching documents:', error);
        statusMessage.textContent = 'Error loading documents. Please try refreshing the page.';
        throw error;
    }
}

// Update statistics in real-time during document loading
function updateProgressiveStats(loadedDocs, totalDocs, processedTerms, uniqueTerms) {
    // Update statistics elements
    totalDocumentsEl.textContent = `${loadedDocs} / ${totalDocs}`;
    uniqueTermsEl.textContent = uniqueTerms.toLocaleString();
    indexedFilesEl.textContent = loadedDocs;
    lastIndexedEl.textContent = new Date().toLocaleString();
    
    // Update progress bar
    const progressBar = document.getElementById('indexing-progress');
    const percentComplete = Math.round((loadedDocs / totalDocs) * 100);
    progressBar.style.width = `${percentComplete}%`;
    
    // Update status message
    statusMessage.style.display = 'block';
    statusMessage.textContent = `Loading documents: ${loadedDocs}/${totalDocs} (${percentComplete}%)`;
    
    // Create a simple loading bar in the status message
    const progressText = '█'.repeat(Math.floor(percentComplete / 5)) + '░'.repeat(20 - Math.floor(percentComplete / 5));
    statusMessage.textContent += `\n${progressText}`;
    
    // Ensure we have a valid start time
    if (!state.fetchStartTime) {
        state.fetchStartTime = Date.now();
    }
    
    // Show processing rate if applicable
    if (loadedDocs > 10) {
        const elapsedSeconds = (Date.now() - state.fetchStartTime) / 1000;
        const docsPerSecond = (loadedDocs / elapsedSeconds).toFixed(1);
        
        // Only calculate estimated time if we have a valid docs/sec rate
        if (docsPerSecond > 0) {
            const estimatedTimeRemaining = Math.round((totalDocs - loadedDocs) / docsPerSecond);
            statusMessage.textContent += `\nProcessing: ${docsPerSecond} docs/sec - Est. time: ${formatTime(estimatedTimeRemaining)}`;
        }
    }
    
    // Set document state partially for later completion
    state.statistics.totalDocuments = loadedDocs;
    state.statistics.uniqueTerms = uniqueTerms;
    state.statistics.indexedFiles = loadedDocs;
}

// Format seconds into mm:ss
function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update popular terms cloud in real-time during document loading
function updateProgressiveTermCloud(documents) {
    // Extract and count terms across all documents so far
    const termCounts = {};
    
    documents.forEach(doc => {
        if (doc.quickTerms) {
            doc.quickTerms.forEach(term => {
                if (!termCounts[term]) {
                    termCounts[term] = 0;
                }
                termCounts[term]++;
            });
        }
    });
    
    // Sort and get top terms
    const sortedTerms = Object.entries(termCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    // Update tag cloud
    popularTerms.innerHTML = '';
    sortedTerms.forEach(([term, count]) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = `${term} (${count})`;
        tag.dataset.term = term;
        
        tag.addEventListener('click', () => {
            toggleTagSelection(tag, term);
            
            if (tag.classList.contains('active')) {
                const currentTerms = searchInput.value.split(' ').filter(t => t.trim());
                if (!currentTerms.includes(term)) {
                    searchInput.value = currentTerms.length > 0 ? searchInput.value + ' ' + term : term;
                }
            } else {
                const currentTerms = searchInput.value.split(' ').filter(t => t.trim() && t !== term);
                searchInput.value = currentTerms.join(' ');
            }
        });
        
        popularTerms.appendChild(tag);
    });
}

// Update statistics display
function updateStatistics() {
    totalDocumentsEl.textContent = state.statistics.totalDocuments;
    uniqueTermsEl.textContent = state.statistics.uniqueTerms;
    indexedFilesEl.textContent = state.statistics.indexedFiles;
    lastIndexedEl.textContent = state.statistics.lastIndexed || '-';
}

// Render popular terms in the tag cloud
function renderPopularTerms() {
    popularTerms.innerHTML = '';
    
    // Sort terms by frequency
    const sortedTerms = Object.entries(state.terms)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    // Create tag elements
    sortedTerms.forEach(([term, count]) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = `${term} (${count})`;
        tag.dataset.term = term;
        
        tag.addEventListener('click', () => {
            toggleTagSelection(tag, term);
            
            // If tag was selected, add term to search
            if (tag.classList.contains('active')) {
                const currentTerms = searchInput.value.split(' ').filter(t => t.trim());
                if (!currentTerms.includes(term)) {
                    if (currentTerms.length > 0) {
                        searchInput.value += ' ' + term;
                    } else {
                        searchInput.value = term;
                    }
                }
            } else {
                // If tag was deselected, remove term from search
                const currentTerms = searchInput.value.split(' ').filter(t => t.trim());
                const updatedTerms = currentTerms.filter(t => t !== term);
                searchInput.value = updatedTerms.join(' ');
            }
        });
        
        popularTerms.appendChild(tag);
    });
}

// Toggle tag selection
function toggleTagSelection(tagElement, term) {
    tagElement.classList.toggle('active');
    
    if (tagElement.classList.contains('active')) {
        state.activeTags.add(term);
    } else {
        state.activeTags.delete(term);
    }
}

// Initialize chart visualizations
function initializeVisualizations() {
    // Term frequency chart
    const termFrequencyCtx = termFrequencyChartEl.getContext('2d');
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.font.size = window.innerWidth < 768 ? 10 : 12;
    
    state.visualizations.termFrequencyChart = new Chart(termFrequencyCtx, {
        type: 'bar',
        data: {
            labels: ['No search performed'],
            datasets: [{
                label: 'Term Frequency',
                data: [0],
                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 Term Frequencies'
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Occurrences: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frequency'
                    },
                    ticks: {
                        callback: function(value) {
                            // Simplify large numbers
                            if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Terms'
                    },
                    ticks: {
                        maxRotation: window.innerWidth < 768 ? 90 : 45,
                        minRotation: window.innerWidth < 768 ? 90 : 45
                    }
                }
            }
        }
    });

    // Document relevance chart
    const documentRelevanceCtx = documentRelevanceChartEl.getContext('2d');
    state.visualizations.documentRelevanceChart = new Chart(documentRelevanceCtx, {
        type: 'bar', // Changed to bar for better clarity
        data: {
            labels: ['No search performed'],
            datasets: [{
                label: 'Relevance Score (%)',
                data: [0],
                backgroundColor: 'rgba(46, 204, 113, 0.6)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar chart for better label visibility
            layout: {
                padding: {
                    right: 10
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top Document Relevance Scores'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Score: ${context.raw}%`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Relevance Score (%)'
                    },
                    max: 100, // Set max to 100% for consistency
                    grid: {
                        display: true,
                        drawBorder: true,
                        drawOnChartArea: true
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Documents'
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        // Ensure labels don't overflow
                        callback: function(value, index, values) {
                            const label = this.getLabelForValue(value);
                            if (label && label.length > (window.innerWidth < 768 ? 10 : 20)) {
                                return label.substr(0, (window.innerWidth < 768 ? 10 : 20)) + '...';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Update visualizations with search results
function updateVisualizations(queryTerms, results) {
    // Get chart containers for potential resizing
    const termFrequencyContainer = termFrequencyChartEl.parentElement;
    const documentRelevanceContainer = documentRelevanceChartEl.parentElement;
    
    // Update term frequency chart
    const termFrequencies = {};
    
    // Limit to first 50 results to avoid performance issues
    const limitedResults = results.slice(0, 50);
    
    // Count query terms in results
    limitedResults.forEach(result => {
        const doc = state.documents[result.id];
        if (doc && doc.terms) {
            queryTerms.forEach(term => {
                if (!termFrequencies[term]) {
                    termFrequencies[term] = 0;
                }
                
                // Count occurrences of the term in this document
                let termCount = 0;
                doc.terms.forEach(docTerm => {
                    if (docTerm === term) {
                        termCount++;
                    }
                });
                
                // Add to total frequency (cap at 200 per term per document to avoid skewing)
                termFrequencies[term] += Math.min(termCount, 200);
            });
        }
    });
    
    // Sort terms by frequency and limit to top 10 for better visualization
    const sortedTerms = Object.entries(termFrequencies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    // If we have too few terms, destroy and recreate chart to ensure proper sizing
    if (sortedTerms.length <= 3 && state.visualizations.termFrequencyChart) {
        state.visualizations.termFrequencyChart.destroy();
        
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'term-frequency-chart';
        newCanvas.className = 'term-frequency-chart';
        termFrequencyContainer.innerHTML = '';
        termFrequencyContainer.appendChild(newCanvas);
        
        const termFrequencyCtx = newCanvas.getContext('2d');
        state.visualizations.termFrequencyChart = new Chart(termFrequencyCtx, {
            type: 'bar',
            data: {
                labels: sortedTerms.map(item => item[0]),
                datasets: [{
                    label: 'Term Frequency',
                    data: sortedTerms.map(item => item[1]),
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 10 Term Frequencies'
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Occurrences: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        },
                        ticks: {
                            callback: function(value) {
                                // Simplify large numbers
                                if (value >= 1000) {
                                    return (value / 1000).toFixed(1) + 'k';
                                }
                                return value;
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Terms'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    } else if (state.visualizations.termFrequencyChart) {
        // Update existing chart
        state.visualizations.termFrequencyChart.data.labels = sortedTerms.map(item => item[0]);
        state.visualizations.termFrequencyChart.data.datasets[0].data = sortedTerms.map(item => item[1]);
        state.visualizations.termFrequencyChart.update();
    }
    
    // Update document relevance chart - only show top 8 documents for clarity
    const topDocs = results.slice(0, 8);
    const relevanceScores = topDocs.map(result => parseFloat((result.score * 100).toFixed(2)));
    const documentLabels = topDocs.map((result, index) => {
        const doc = state.documents[result.id];
        // Create shorter labels to avoid overflow
        if (doc && doc.title) {
            // Use first few words of title or filename for better display
            const title = doc.title.split(' ').slice(0, 3).join(' ');
            return `${title}... (${doc.id})`;
        }
        return `Doc ${result.id}`;
    });
    
    // If we have too few documents, destroy and recreate chart to ensure proper sizing
    if (topDocs.length <= 3 && state.visualizations.documentRelevanceChart) {
        state.visualizations.documentRelevanceChart.destroy();
        
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'document-relevance-chart';
        newCanvas.className = 'document-relevance-chart';
        documentRelevanceContainer.innerHTML = '';
        documentRelevanceContainer.appendChild(newCanvas);
        
        const documentRelevanceCtx = newCanvas.getContext('2d');
        state.visualizations.documentRelevanceChart = new Chart(documentRelevanceCtx, {
            type: 'bar',
            data: {
                labels: documentLabels,
                datasets: [{
                    label: 'Relevance Score (%)',
                    data: relevanceScores,
                    backgroundColor: 'rgba(46, 204, 113, 0.6)',
                    borderColor: 'rgba(46, 204, 113, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                layout: {
                    padding: {
                        right: 10
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Document Relevance Scores'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.raw}%`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Relevance Score (%)'
                        },
                        max: 100,
                        grid: {
                            display: true,
                            drawBorder: true,
                            drawOnChartArea: true
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Documents'
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            callback: function(value, index, values) {
                                const label = this.getLabelForValue(value);
                                if (label && label.length > 20) {
                                    return label.substr(0, 20) + '...';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } else if (state.visualizations.documentRelevanceChart) {
        // Update existing chart
        state.visualizations.documentRelevanceChart.data.labels = documentLabels;
        state.visualizations.documentRelevanceChart.data.datasets[0].data = relevanceScores;
        state.visualizations.documentRelevanceChart.update();
    }
}

// Search functionality
function performSearch(query) {
    if (!query.trim()) {
        statusMessage.style.display = 'block';
        statusMessage.textContent = 'Please enter a search query';
        return;
    }
    
    // Show loading indicator
    showLoader(true);
    statusMessage.style.display = 'none';
    resultsGrid.innerHTML = '';
    
    // Parse query
    const queryTerms = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(term => term.length > 2 && !isStopWord(term));
    
    if (queryTerms.length === 0) {
        statusMessage.style.display = 'block';
        statusMessage.textContent = 'Please enter a valid search query with meaningful terms';
        showLoader(false);
        return;
    }
    
    // Update state
    state.currentQuery = query;
    
    // Search in documents
    const results = searchInDocuments(queryTerms);
    
    // Update state with results
    state.results = results;
    state.totalResults = results.length;
    
    // Update UI with results
    updateSearchResults();
    
    // Update visualizations
    updateVisualizations(queryTerms, results);
}

// Search for terms in documents
function searchInDocuments(queryTerms) {
    const results = [];
    const minScoreValue = state.minScore / 100; // Convert from percentage
    
    // Get match type
    const matchType = state.matchType;
    
    // Score each document
    Object.values(state.documents).forEach(doc => {
        let score = 0;
        let matches = 0;
        
        // Calculate score based on term matches
        queryTerms.forEach(term => {
            const termCount = doc.terms.filter(t => t === term).length;
            if (termCount > 0) {
                matches++;
                // Term frequency in this document
                const tf = termCount / doc.terms.length;
                
                // Inverse document frequency
                const docCountWithTerm = Object.values(state.documents)
                    .filter(d => d.terms.some(t => t === term)).length;
                const idf = Math.log(state.statistics.totalDocuments / (docCountWithTerm || 1));
                
                // TF-IDF score
                const tfidf = tf * idf;
                score += tfidf;
            }
        });
        
        // Normalize score to 0-1 range
        score = score / (queryTerms.length || 1);
        
        // Apply match type filter
        let includeResult = false;
        if (matchType === 'all') {
            includeResult = matches === queryTerms.length;
        } else if (matchType === 'any') {
            includeResult = matches > 0;
        } else if (matchType === 'exact') {
            // For exact phrase matching, we'd need to check the original content
            // This is a simplified version
            includeResult = doc.content.toLowerCase().includes(queryTerms.join(' '));
        }
        
        // Apply minimum score filter
        if (includeResult && score >= minScoreValue) {
            results.push({
                id: doc.id,
                score: score,
                matches: matches
            });
        }
    });
    
    // Sort results by score
    return results.sort((a, b) => b.score - a.score);
}

// Update the UI with search results
function updateSearchResults() {
    const startIndex = (state.currentPage - 1) * state.resultsPerPage;
    const endIndex = startIndex + state.resultsPerPage;
    const pageResults = state.results.slice(startIndex, endIndex);
    
    // Update results count
    if (state.totalResults === 0) {
        resultsCount.textContent = 'No results found';
        statusMessage.style.display = 'block';
        statusMessage.textContent = 'No documents match your search criteria';
    } else {
        resultsCount.textContent = `Found ${state.totalResults} results`;
        statusMessage.style.display = 'none';
    }
    
    // Clear previous results
    resultsGrid.innerHTML = '';
    
    // Add result cards
    pageResults.forEach(result => {
        const doc = state.documents[result.id];
        if (!doc) return;
        
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        resultCard.addEventListener('click', () => openDocumentModal(doc.id));
        
        const scorePercent = Math.round(result.score * 100);
        
        resultCard.innerHTML = `
            <h3 class="result-title">${doc.title}</h3>
            <div class="result-meta">
                ${doc.date ? `<span><i class="fas fa-calendar"></i> ${doc.date}</span>` : ''}
                ${doc.authors ? `<span><i class="fas fa-user"></i> ${doc.authors}</span>` : ''}
                <span><i class="fas fa-file"></i> ${doc.filename}</span>
            </div>
            <div class="result-preview">${getDocumentPreview(doc, state.currentQuery)}</div>
            <div class="relevance-score">${scorePercent}%</div>
        `;
        
        resultsGrid.appendChild(resultCard);
    });
    
    // Update pagination
    updatePagination();
    
    // Hide loader
    showLoader(false);
}

// Get a preview of the document content with highlighted search terms
function getDocumentPreview(doc, query) {
    if (!doc.content) return '';
    
    const queryTerms = query.toLowerCase().split(' ').filter(t => t.trim());
    let content = doc.content;
    
    // Find the first occurrence of any query term
    let previewStart = 0;
    let found = false;
    
    for (const term of queryTerms) {
        const index = content.toLowerCase().indexOf(term);
        if (index !== -1) {
            // Start the preview a bit before the match
            previewStart = Math.max(0, index - 50);
            found = true;
            break;
        }
    }
    
    // If no term found, just use the beginning
    if (!found) {
        previewStart = 0;
    }
    
    // Extract preview
    let preview = content.substring(previewStart, previewStart + 200);
    
    // Add ellipsis if needed
    if (previewStart > 0) {
        preview = '...' + preview;
    }
    if (previewStart + 200 < content.length) {
        preview += '...';
    }
    
    // Highlight query terms
    queryTerms.forEach(term => {
        if (term.length < 3) return;
        const regex = new RegExp(term, 'gi');
        preview = preview.replace(regex, match => `<span class="highlight">${match}</span>`);
    });
    
    return preview;
}

// Update pagination controls
function updatePagination() {
    pagination.innerHTML = '';
    
    if (state.totalResults === 0) {
        return;
    }
    
    const totalPages = Math.ceil(state.totalResults / state.resultsPerPage);
    
    // Add first page button
    addPaginationButton('«', 1, state.currentPage === 1);
    
    // Add previous page button
    addPaginationButton('‹', state.currentPage - 1, state.currentPage === 1);
    
    // Add page number buttons
    const startPage = Math.max(1, state.currentPage - 2);
    const endPage = Math.min(totalPages, state.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        addPaginationButton(i.toString(), i, false, i === state.currentPage);
    }
    
    // Add next page button
    addPaginationButton('›', state.currentPage + 1, state.currentPage === totalPages);
    
    // Add last page button
    addPaginationButton('»', totalPages, state.currentPage === totalPages);
}

// Add a pagination button
function addPaginationButton(text, page, disabled, active = false) {
    const button = document.createElement('button');
    button.textContent = text;
    if (active) button.classList.add('active');
    button.disabled = disabled;
    
    button.addEventListener('click', () => {
        if (page !== state.currentPage) {
            state.currentPage = page;
            updateSearchResults();
            // Scroll back to top of results
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    pagination.appendChild(button);
}

// Open document modal
function openDocumentModal(docId) {
    const doc = state.documents[docId];
    if (!doc) return;
    
    // Update current document ID
    state.currentDocumentId = docId;
    
    // Update modal content
    modalTitle.textContent = doc.title;
    
    // Update metadata
    documentMeta.innerHTML = `
        ${doc.date ? `<div class="document-meta-item"><strong>Date:</strong> ${doc.date}</div>` : ''}
        ${doc.authors ? `<div class="document-meta-item"><strong>Authors:</strong> ${doc.authors}</div>` : ''}
        <div class="document-meta-item"><strong>Filename:</strong> ${doc.filename}</div>
    `;
    
    // Update content
    documentContent.textContent = doc.content;
    
    // Highlight search terms if there's a current query
    if (state.currentQuery) {
        const queryTerms = state.currentQuery.toLowerCase().split(' ').filter(t => t.trim());
        highlightTermsInModal(queryTerms);
    }
    
    // Update navigation buttons
    updateModalNavigation();
    
    // Show similar documents
    showSimilarDocuments(docId);
    
    // Show modal
    documentModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
}

// Highlight terms in the modal content
function highlightTermsInModal(terms) {
    if (!terms || terms.length === 0) return;
    
    const contentHtml = documentContent.innerHTML;
    let highlightedContent = contentHtml;
    
    terms.forEach(term => {
        if (term.length < 3) return;
        const regex = new RegExp(`(${term})`, 'gi');
        highlightedContent = highlightedContent.replace(regex, '<span class="highlight">$1</span>');
    });
    
    documentContent.innerHTML = highlightedContent;
}

// Update modal navigation buttons
function updateModalNavigation() {
    // Find current document index in results
    const currentIndex = state.results.findIndex(result => result.id === state.currentDocumentId);
    
    // Update previous button
    prevDoc.disabled = currentIndex <= 0;
    prevDoc.onclick = () => {
        if (currentIndex > 0) {
            openDocumentModal(state.results[currentIndex - 1].id);
        }
    };
    
    // Update next button
    nextDoc.disabled = currentIndex >= state.results.length - 1 || currentIndex === -1;
    nextDoc.onclick = () => {
        if (currentIndex < state.results.length - 1) {
            openDocumentModal(state.results[currentIndex + 1].id);
        }
    };
}

// Show similar documents in modal
function showSimilarDocuments(docId) {
    similarDocumentsList.innerHTML = '';
    
    const currentDoc = state.documents[docId];
    if (!currentDoc || !currentDoc.terms) return;
    
    // Find similar documents based on common terms
    const similarities = [];
    
    Object.entries(state.documents).forEach(([id, doc]) => {
        if (id === docId.toString()) return;
        
        // Calculate Jaccard similarity
        const intersection = currentDoc.terms.filter(term => doc.terms.includes(term)).length;
        const union = new Set([...currentDoc.terms, ...doc.terms]).size;
        const similarity = intersection / union;
        
        if (similarity > 0.1) {
            similarities.push({ id: parseInt(id), similarity, title: doc.title });
        }
    });
    
    // Sort by similarity and take top 5
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilar = similarities.slice(0, 5);
    
    // Display similar documents
    if (topSimilar.length === 0) {
        similarDocumentsList.innerHTML = '<div>No similar documents found</div>';
        return;
    }
    
    topSimilar.forEach(item => {
        const similarItem = document.createElement('div');
        similarItem.className = 'similar-item';
        similarItem.textContent = item.title;
        similarItem.addEventListener('click', () => openDocumentModal(item.id));
        similarDocumentsList.appendChild(similarItem);
    });
}

// Close document modal
function closeDocumentModal() {
    documentModal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
}

// Show or hide loader
function showLoader(show) {
    searchLoader.style.display = show ? 'block' : 'none';
    state.loading = show;
    
    // Also update progress bar visibility
    const progressBar = document.getElementById('indexing-progress');
    if (progressBar) {
        if (!show) {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.transition = 'width 0.5s ease';
                progressBar.style.width = '0%';
            }, 1000);
        } else {
            progressBar.style.transition = 'width 0.3s ease';
        }
    }
}

// Event handlers
function handleSearch(e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
        state.currentPage = 1;
        performSearch(query);
    }
}

function toggleAdvancedSearch() {
    advancedSearch.classList.toggle('active');
    toggleIcon.classList.toggle('fa-chevron-down');
    toggleIcon.classList.toggle('fa-chevron-up');
}

function updateResultsPerPage() {
    state.resultsPerPage = parseInt(resultLimit.value);
    if (state.results.length > 0) {
        state.currentPage = 1;
        updateSearchResults();
    }
}

function updateMatchType() {
    state.matchType = matchType.value;
    if (state.currentQuery) {
        state.currentPage = 1;
        performSearch(state.currentQuery);
    }
}

function updateSortOrder() {
    const newSortOrder = this.id === 'sort-by' ? sortBy.value : resultsSort.value;
    
    if (newSortOrder !== state.sortOrder) {
        state.sortOrder = newSortOrder;
        
        // Sync the two sort dropdowns
        if (this.id === 'sort-by') {
            resultsSort.value = newSortOrder;
        } else {
            sortBy.value = newSortOrder;
        }
        
        // Re-sort results if we have any
        if (state.results.length > 0) {
            sortResults();
            updateSearchResults();
        }
    }
}

// Sort results based on current sort order
function sortResults() {
    switch (state.sortOrder) {
        case 'relevance':
            state.results.sort((a, b) => b.score - a.score);
            break;
        case 'date-asc':
            state.results.sort((a, b) => {
                const dateA = state.documents[a.id]?.date || '';
                const dateB = state.documents[b.id]?.date || '';
                return dateA.localeCompare(dateB);
            });
            break;
        case 'date-desc':
            state.results.sort((a, b) => {
                const dateA = state.documents[a.id]?.date || '';
                const dateB = state.documents[b.id]?.date || '';
                return dateB.localeCompare(dateA);
            });
            break;
        case 'title':
            state.results.sort((a, b) => {
                const titleA = state.documents[a.id]?.title || '';
                const titleB = state.documents[b.id]?.title || '';
                return titleA.localeCompare(titleB);
            });
            break;
    }
}

// Toggle dark mode
function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    document.body.classList.toggle('dark-mode', state.darkMode);
    
    // Update icon
    if (state.darkMode) {
        themeToggleIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        themeToggleIcon.classList.replace('fa-sun', 'fa-moon');
    }
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', state.darkMode);
    
    // Update chart colors if needed
    updateChartColors();
}

// Update chart colors for dark mode
function updateChartColors() {
    if (!state.visualizations.termFrequencyChart || !state.visualizations.documentRelevanceChart) {
        return;
    }
    
    const textColor = state.darkMode ? '#e0e0e0' : '#2c3e50';
    const gridColor = state.darkMode ? '#333' : '#ddd';
    
    // Update term frequency chart
    state.visualizations.termFrequencyChart.options.scales.x.ticks.color = textColor;
    state.visualizations.termFrequencyChart.options.scales.y.ticks.color = textColor;
    state.visualizations.termFrequencyChart.options.scales.x.grid.color = gridColor;
    state.visualizations.termFrequencyChart.options.scales.y.grid.color = gridColor;
    state.visualizations.termFrequencyChart.options.plugins.title.color = textColor;
    state.visualizations.termFrequencyChart.update();
    
    // Update document relevance chart
    state.visualizations.documentRelevanceChart.options.scales.x.ticks.color = textColor;
    state.visualizations.documentRelevanceChart.options.scales.y.ticks.color = textColor;
    state.visualizations.documentRelevanceChart.options.scales.x.grid.color = gridColor;
    state.visualizations.documentRelevanceChart.options.scales.y.grid.color = gridColor;
    state.visualizations.documentRelevanceChart.options.plugins.title.color = textColor;
    state.visualizations.documentRelevanceChart.update();
}

// Tab switching for visualizations
function handleTabClick() {
    const tabName = this.dataset.tab;
    
    // Remove active class from all tabs and contents
    vizTabs.forEach(tab => tab.classList.remove('active'));
    vizContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked tab and its content
    this.classList.add('active');
    document.querySelector(`.viz-content[data-content="${tabName}"]`).classList.add('active');
}

// Handle minimum score slider changes
function handleMinScoreChange() {
    state.minScore = parseInt(minScore.value);
    minScoreValue.textContent = `${state.minScore}%`;
    
    // Re-search with new minimum score if we have a query
    if (state.currentQuery) {
        state.currentPage = 1;
        performSearch(state.currentQuery);
    }
}

// Handle date range filter changes
function handleDateRangeChange() {
    const fromDate = dateRangeMin.value;
    const toDate = dateRangeMax.value;
    
    console.log(`Date range filter: ${fromDate} to ${toDate}`);
    
    // Parse dates or set to empty if not valid
    state.dateRangeMin = fromDate ? new Date(fromDate) : '';
    state.dateRangeMax = toDate ? new Date(toDate) : '';
    
    // Re-search with new date range if we have a query
    if (state.currentQuery) {
        state.currentPage = 1;
        performSearch(state.currentQuery);
    }
}

// Initialize date pickers with default range
function initializeDatePickers() {
    // Set min/max date range based on corpus
    // Most CACM papers are from the 50s-60s
    const minDate = '1950-01-01';
    const maxDate = '1970-12-31';
    
    // Set attributes
    dateRangeMin.min = minDate;
    dateRangeMin.max = maxDate;
    
    dateRangeMax.min = minDate;
    dateRangeMax.max = maxDate;
    
    // Set default values if needed
    // dateRangeMin.value = '1958-01-01';
    // dateRangeMax.value = '1960-12-31';
}

// Register event listeners
function registerEventListeners() {
    // Search form submission
    searchForm.addEventListener('submit', handleSearch);
    
    // Advanced search toggle
    advancedSearchToggle.addEventListener('click', toggleAdvancedSearch);
    
    // Result limit change
    resultLimit.addEventListener('change', updateResultsPerPage);
    
    // Match type change
    matchType.addEventListener('change', updateMatchType);
    
    // Sort order change
    sortBy.addEventListener('change', updateSortOrder);
    resultsSort.addEventListener('change', updateSortOrder);
    
    // Min score change
    minScore.addEventListener('input', handleMinScoreChange);
    
    // Date range change
    dateRangeMin.addEventListener('change', handleDateRangeChange);
    dateRangeMax.addEventListener('change', handleDateRangeChange);
    
    // Close modal
    closeModal.addEventListener('click', closeDocumentModal);
    
    // Close modal by clicking outside
    documentModal.addEventListener('click', e => {
        if (e.target === documentModal) {
            closeDocumentModal();
        }
    });
    
    // Escape key closes modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && documentModal.classList.contains('active')) {
            closeDocumentModal();
        }
    });
    
    // Tab switching
    vizTabs.forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });
    
    // Theme toggle
    themeToggleIcon.parentElement.addEventListener('click', toggleDarkMode);
    
    // Window resize - update chart responsiveness
    window.addEventListener('resize', debounce(updateChartResponsiveness, 250));
}

// Debounce function to limit how often a function runs during events like resize
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Initialize the application
registerEventListeners();
initializeDatePickers();
init();
});