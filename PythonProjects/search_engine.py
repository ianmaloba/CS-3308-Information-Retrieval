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
        with open(filename, 'r', encoding='utf-8', errors='ignore') as file:
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
    
    for term, term_obj in database.items():
        if term_obj.docs > 0:
            idf = math.log10(documents / term_obj.docs)
            for doc_id, freq in term_obj.docids.items():
                tfidf = freq * idf
                cur.execute("""
                    UPDATE Posting 
                    SET tfidf = ?, docfreq = ?
                    WHERE TermId = ? AND DocId = ?
                """, (tfidf, term_obj.docs, term_obj.termid, doc_id))

def calculate_document_lengths(cur):
    print("Calculating document lengths...")
    cur.execute("""
        INSERT OR REPLACE INTO DocumentLengths (DocId, DocLength)
        SELECT DocId, SQRT(SUM(tfidf * tfidf)) as length
        FROM Posting
        GROUP BY DocId
    """)

def process_query(query, cur):
    query_terms = {}
    for term in query.lower().split():
        if len(term) >= 2 and term[0].isalpha() and not term.isdigit():
            print(f"Searching for term: {term}")
            cur.execute("SELECT TermId, Term FROM TermDictionary WHERE Term = ?", (term,))
            result = cur.fetchone()
            if result:
                term_id, found_term = result
                print(f"Found term: {found_term} with TermId: {term_id}")
                query_terms[term_id] = query_terms.get(term_id, 0) + 1
            else:
                print(f"Term not found in dictionary: {term}")
    return query_terms

def search(query, cur):
    global documents  # Ensure we're using the global documents variable
    query_terms = process_query(query, cur)
    print(f"Processed query terms: {query_terms}")
    if not query_terms:
        return []
    
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
            print(f"Term ID: {term_id}, Document Frequency: {doc_freq}, Total Documents: {documents}")
            try:
                idf = math.log10(documents / doc_freq) if doc_freq > 0 else 0
            except ValueError:
                print(f"Error calculating IDF. Documents: {documents}, Doc Freq: {doc_freq}")
                idf = 0
            query_weight = count * idf
            query_weights[term_id] = query_weight
            query_length += query_weight ** 2
            
            cur.execute("""
                SELECT DocId, tfidf 
                FROM Posting 
                WHERE TermId = ?
            """, (term_id,))
            
            for doc_id, tfidf in cur.fetchall():
                doc_scores[doc_id] += query_weight * tfidf
    
    print(f"Query weights: {query_weights}")
    print(f"Document scores: {dict(doc_scores)}")
    
    query_length = math.sqrt(query_length)
    
    similarities = []
    for doc_id, score in doc_scores.items():
        cur.execute("SELECT DocLength FROM DocumentLengths WHERE DocId = ?", (doc_id,))
        result = cur.fetchone()
        if result and result[0] > 0 and query_length > 0:
            doc_length = result[0]
            similarity = score / (query_length * doc_length)
            similarities.append((similarity, doc_id))
    
    print(f"Calculated similarities: {similarities}")
    return sorted(similarities, reverse=True)

def setup_database(cur):
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS DocumentDictionary (DocumentName TEXT, DocId INTEGER PRIMARY KEY);
        
        CREATE TABLE IF NOT EXISTS TermDictionary (Term TEXT, TermId INTEGER PRIMARY KEY);
        
        CREATE TABLE IF NOT EXISTS Posting (
            TermId INTEGER,
            DocId INTEGER,
            tfidf REAL DEFAULT 0,
            docfreq INTEGER DEFAULT 0,
            termfreq INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS DocumentLengths (DocId INTEGER PRIMARY KEY, DocLength REAL);
        
        CREATE INDEX IF NOT EXISTS idxPosting1 ON Posting (TermId);
        CREATE INDEX IF NOT EXISTS idxPosting2 ON Posting (DocId);
    """)

def main():
    global documents  # Declare documents as global
    t2 = time.localtime()
    print(f"Start Time: {t2.tm_hour:02d}:{t2.tm_min:02d}")
    
    folder = r"C:\Users\Administrator\Documents\CACM_Corpus"
    
    con = sqlite3.connect("indexer_part2.db")
    cur = con.cursor()
    
    setup_database(cur)
    
    # Check if the database is already populated
    cur.execute("SELECT COUNT(*) FROM DocumentDictionary")
    doc_count = cur.fetchone()[0]
    
    if doc_count == 0:
        print("Indexing documents...")
        walkdir(cur, folder)
        
        print("Writing terms to database...")
        for term, term_obj in database.items():
            cur.execute("INSERT INTO TermDictionary VALUES (?, ?)", (term, term_obj.termid))
            for doc_id, freq in term_obj.docids.items():
                cur.execute("INSERT INTO Posting (TermId, DocId, termfreq) VALUES (?, ?, ?)", 
                           (term_obj.termid, doc_id, freq))
        
        calculate_tfidf(cur)
        calculate_document_lengths(cur)
        
        con.commit()
    else:
        print("Using existing index...")
        cur.execute("SELECT COUNT(*) FROM DocumentDictionary")
        documents = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM TermDictionary")
        terms = cur.fetchone()[0]
    
    print(f"\nDocuments indexed: {documents}")
    print(f"Unique terms: {terms}")
    
    # Debug: Print some sample terms from the database
    print("\nSample terms from the database:")
    cur.execute("SELECT Term, TermId FROM TermDictionary LIMIT 10")
    sample_terms = cur.fetchall()
    for term, term_id in sample_terms:
        print(f"Term: {term}, TermId: {term_id}")
    
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