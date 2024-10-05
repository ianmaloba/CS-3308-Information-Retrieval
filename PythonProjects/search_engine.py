import sys, os, re
import math
import sqlite3
import time
from collections import defaultdict

# Global variables
database = {}
chars = re.compile(r'\W+')
pattid = re.compile(r'(\d{3})/(\d{3})/(\d{3})')
tokens = 0
documents = 0
terms = 0

class Term():
    def __init__(self):
        self.termid = 0
        self.termfreq = 0
        self.docs = 0
        self.docids = {}

def splitchars(line):
    return chars.split(line)

def parsetoken(line):
    global documents, tokens, terms
    
    line = line.replace('\t', ' ').strip()
    l = splitchars(line)
    
    for elmt in l:
        elmt = elmt.replace('\n', '')
        lowerElmt = elmt.lower().strip()
        
        if len(lowerElmt) < 2 or lowerElmt.isdigit() or not lowerElmt[0].isalpha():
            continue
        
        tokens += 1
        
        if lowerElmt not in database:
            terms += 1
            database[lowerElmt] = Term()
            database[lowerElmt].termid = terms
            database[lowerElmt].docids = {}
        
        if documents not in database[lowerElmt].docids:
            database[lowerElmt].docs += 1
            database[lowerElmt].docids[documents] = 0
        
        database[lowerElmt].docids[documents] += 1
        database[lowerElmt].termfreq += 1

def process(filename):
    try:
        with open(filename, 'r') as file:
            for line in file:
                parsetoken(line)
    except IOError:
        print(f"Error in file {filename}")
        return False
    return True

def walkdir(cur, dirname):
    global documents
    for root, dirs, files in os.walk(dirname):
        for file in files:
            filepath = os.path.join(root, file)
            documents += 1
            cur.execute("INSERT INTO DocumentDictionary VALUES (?, ?)", (filepath, documents))
            process(filepath)

def calculate_tfidf(cur):
    print("Calculating TF-IDF values...")
    cur.execute("BEGIN TRANSACTION")
    
    # Update tfidf values in Posting table
    for term, term_obj in database.items():
        if term_obj.docs > 0:  # Prevent division by zero
            idf = math.log10(documents / term_obj.docs)
            for doc_id, freq in term_obj.docids.items():
                tfidf = freq * idf
                cur.execute("""
                    UPDATE Posting 
                    SET tfidf = ?, docfreq = ?
                    WHERE TermId = ? AND DocId = ?
                """, (tfidf, term_obj.docs, term_obj.termid, doc_id))
    
    cur.execute("COMMIT")

def calculate_document_lengths(cur):
    print("Calculating document lengths...")
    cur.execute("""
        INSERT INTO DocumentLengths (DocId, DocLength)
        SELECT DocId, SQRT(SUM(tfidf * tfidf)) as length
        FROM Posting
        GROUP BY DocId
    """)

def process_query(query, cur):
    query_terms = {}
    for term in query.lower().split():
        if len(term) >= 2 and term[0].isalpha() and not term.isdigit():
            cur.execute("SELECT TermId FROM TermDictionary WHERE Term = ?", (term,))
            result = cur.fetchone()
            if result:
                term_id = result[0]
                query_terms[term_id] = query_terms.get(term_id, 0) + 1
    return query_terms

def search(query, cur):
    query_terms = process_query(query, cur)
    if not query_terms:
        return []
    
    # Calculate query weights and document scores
    query_weights = {}
    doc_scores = defaultdict(float)
    query_length = 0
    
    for term_id, count in query_terms.items():
        cur.execute("""
            SELECT docfreq FROM Posting 
            WHERE TermId = ? 
            GROUP BY TermId
        """, (term_id,))
        result = cur.fetchone()
        if result:
            doc_freq = result[0]
            idf = math.log10(documents / doc_freq) if doc_freq > 0 else 0
            query_weight = count * idf
            query_weights[term_id] = query_weight
            query_length += query_weight ** 2
            
            # Get matching documents
            cur.execute("""
                SELECT DocId, tfidf 
                FROM Posting 
                WHERE TermId = ?
            """, (term_id,))
            
            for doc_id, tfidf in cur.fetchall():
                doc_scores[doc_id] += query_weight * tfidf
    
    query_length = math.sqrt(query_length)
    
    # Calculate final similarities
    similarities = []
    for doc_id, score in doc_scores.items():
        cur.execute("SELECT DocLength FROM DocumentLengths WHERE DocId = ?", (doc_id,))
        result = cur.fetchone()
        if result and result[0] > 0 and query_length > 0:
            doc_length = result[0]
            similarity = score / (query_length * doc_length)
            similarities.append((similarity, doc_id))
    
    return sorted(similarities, reverse=True)

def setup_database(cur):
    cur.executescript("""
        DROP TABLE IF EXISTS DocumentDictionary;
        CREATE TABLE DocumentDictionary (DocumentName TEXT, DocId INTEGER PRIMARY KEY);
        
        DROP TABLE IF EXISTS TermDictionary;
        CREATE TABLE TermDictionary (Term TEXT, TermId INTEGER PRIMARY KEY);
        
        DROP TABLE IF EXISTS Posting;
        CREATE TABLE Posting (
            TermId INTEGER,
            DocId INTEGER,
            tfidf REAL DEFAULT 0,
            docfreq INTEGER DEFAULT 0,
            termfreq INTEGER DEFAULT 0
        );
        
        DROP TABLE IF EXISTS DocumentLengths;
        CREATE TABLE DocumentLengths (DocId INTEGER PRIMARY KEY, DocLength REAL);
        
        CREATE INDEX IF NOT EXISTS idxPosting1 ON Posting (TermId);
        CREATE INDEX IF NOT EXISTS idxPosting2 ON Posting (DocId);
    """)

def main():
    t2 = time.localtime()
    print(f"Start Time: {t2.tm_hour:02d}:{t2.tm_min:02d}")
    
    folder = r"C:\Users\Administrator\Documents\CACM_Corpus"
    
    con = sqlite3.connect("indexer_part2.db")
    cur = con.cursor()
    
    setup_database(cur)
    
    print("Indexing documents...")
    walkdir(cur, folder)
    
    print("Writing terms to database...")
    cur.execute("BEGIN TRANSACTION")
    for term, term_obj in database.items():
        cur.execute("INSERT INTO TermDictionary VALUES (?, ?)", (term, term_obj.termid))
        for doc_id, freq in term_obj.docids.items():
            cur.execute("INSERT INTO Posting (TermId, DocId, termfreq) VALUES (?, ?, ?)", 
                       (term_obj.termid, doc_id, freq))
    cur.execute("COMMIT")
    
    calculate_tfidf(cur)
    calculate_document_lengths(cur)
    
    print(f"\nDocuments indexed: {documents}")
    print(f"Unique terms: {terms}")
    print(f"Total tokens: {tokens}")
    
    while True:
        query = input("\nEnter your search query (or 'quit' to exit): ")
        if query.lower() == 'quit':
            break
        
        results = search(query, cur)
        
        print(f"\nFound {len(results)} matching documents")
        if results:
            print("\nTop 20 results:")
            for i, (score, doc_id) in enumerate(results[:20], 1):
                cur.execute("SELECT DocumentName FROM DocumentDictionary WHERE DocId = ?", (doc_id,))
                filename = os.path.basename(cur.fetchone()[0])
                print(f"{i}. {filename} (Score: {score:.4f})")
            
            if len(results) > 20:
                print(f"\nShowing top 20 of {len(results)} total matches")
        else:
            print("No matching documents found.")
    
    con.close()
    
    t2 = time.localtime()
    print(f"End Time: {t2.tm_hour:02d}:{t2.tm_min:02d}")

if __name__ == '__main__':
    main()