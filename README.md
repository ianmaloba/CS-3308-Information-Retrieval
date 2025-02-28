# Information Retrieval System for CACM Corpus

## Overview
This project implements a full-featured information retrieval system that indexes and enables searching through the CACM (Communications of the ACM) corpus. I developed this as part of my CS3308 Information Retrieval course assignment, and expanded it to include a modern web-based user interface.

The system combines a Python backend for indexing with a responsive web frontend for searching and visualizing results.

## Live Demo
Available online at:
- https://cacm.ianmaloba.com/ or
- https://codepen.io/ianmaloba/full/mydReKQ

## Features

### Backend (Python)
- Document indexing with SQLite database storage
- TF-IDF scoring for relevance ranking
- Cosine similarity-based document retrieval
- Support for the CACM corpus (570 computer science abstracts)
- Stopword filtering and term processing

### Frontend (HTML/CSS/JavaScript)
- Real-time document loading and indexing with progress visualization
- Advanced search options (match type, minimum score, date range)
- Interactive visualizations of search results (term frequency, document relevance)
- Document viewer with highlighted search terms
- Similar document suggestions

## Project Structure
```plaintext
📦 CS-3308-Information-Retrieval/
├── index.html          # Main web interface
├── styles.css          # Styling for the UI
├── script.js           # Frontend logic and search functionality
├── PythonProjects/
│   ├── indexer_main.py     # Indexer for CACM corpus
│   ├── search_engine.py    # Backend search functionality
│   └── indexer_part2.db    # SQLite database with indexed data
└── CACM_Corpus/
   └── cacm/
       ├── CACM-0001.HTML
       ├── CACM-0002.HTML
       └── ... (570 documents)
```       
       
## Usage

### Web Interface
1. Open `index.html` in a web browser
2. The system will automatically fetch and index documents from the CACM corpus
3. Enter search queries in the search box
4. Use advanced options to refine searches
5. View document content by clicking on search results

### Python Backend
If you want to use the Python components directly:
```bash
cd PythonProjects
python indexer_main.py  # To build the index
python search_engine.py  # To run search queries       
```


## Technologies Used

### Web Interface

- HTML5, CSS3, JavaScript (ES6+)
- Chart.js for data visualization
- Python 3.x for backend processing
- SQLite for data storage
- TF-IDF and Vector Space Model for information retrieval

## Development Notes
The initial assignment required building the indexer and search engine in Python. I expanded upon this by developing a complete web interface that could work independently or integrate with the Python backend through an API-like approach.
The frontend uses modern JavaScript techniques to fetch documents directly from the GitHub repository, process them in real-time, and provide an interactive search experience.

## Future Improvements

- Implement query expansion and spelling correction
- Add support for additional document formats and collections


## License
This project is licensed under the [MIT License](https://github.com/ianmaloba/CS-3308-Information-Retrieval/blob/main/LICENSE).