import sys, os, re
import math
import sqlite3
import time

# the database is a simple dictionary
database = {}

# regular expression for: extract words, extract ID from path, check for hexa value
chars = re.compile(r'\W+')
pattid = re.compile(r'(\d{3})/(\d{3})/(\d{3})')

# the higher ID
tokens = 0
documents = 0
terms = 0

class Term():
    termid = 0
    termfreq = 0
    docs = 0
    docids = {}

def splitchars(line):
    return chars.split(line)

def parsetoken(line):
    global documents
    global tokens
    global terms

    line = line.replace('\t', ' ')
    line = line.strip()
    
    l = splitchars(line)
    
    for elmt in l:
        elmt = elmt.replace('\n', '')
        lowerElmt = elmt.lower().strip()
        tokens += 1
        
        if not (lowerElmt in database.keys()):
            terms += 1
            database[lowerElmt] = Term()
            database[lowerElmt].termid = terms
            database[lowerElmt].docids = dict()
            database[lowerElmt].docs = 0
        
        if not (documents in database[lowerElmt].docids.keys()):
            database[lowerElmt].docs += 1
            database[lowerElmt].docids[documents] = 0
    
        database[lowerElmt].docids[documents] += 1
        database[lowerElmt].termfreq += 1
    
    return l

def process(filename):
    try:
        file = open(filename, 'r')
    except IOError:
        print(f"Error in file {filename}")
        return False
    else:
        for l in file.readlines():
            parsetoken(l)
    file.close()

def walkdir(cur, dirname):
    global documents
    all = [f for f in os.listdir(dirname) if os.path.isdir(os.path.join(dirname, f)) or os.path.isfile(os.path.join(dirname, f))]
    for f in all:
        if os.path.isdir(dirname + '/' + f):
            walkdir(cur, dirname + '/' + f)
        else:
            documents += 1
            cur.execute("INSERT INTO DocumentDictionary VALUES (?, ?)", (dirname+'/'+f, documents))
            process(dirname + '/' + f)
    return True

if __name__ == '__main__':
    t2 = time.localtime()
    print(f"Start Time: {t2.tm_hour:02d}:{t2.tm_min:02d}")
    
    folder = r"C:\Users\Administrator\Documents\CACM_Corpus"
    
    con = sqlite3.connect("indexer_part2.db")
    con.isolation_level = None
    cur = con.cursor()
    
    cur.execute("DROP TABLE IF EXISTS DocumentDictionary")
    cur.execute("DROP INDEX IF EXISTS idxDocumentDictionary")
    cur.execute("CREATE TABLE IF NOT EXISTS DocumentDictionary (DocumentName TEXT, DocId INT)")
    cur.execute("CREATE INDEX IF NOT EXISTS idxDocumentDictionary ON DocumentDictionary (DocId)")
    
    cur.execute("DROP TABLE IF EXISTS TermDictionary")
    cur.execute("DROP INDEX IF EXISTS idxTermDictionary")
    cur.execute("CREATE TABLE IF NOT EXISTS TermDictionary (Term TEXT, TermId INT)")
    cur.execute("CREATE INDEX IF NOT EXISTS idxTermDictionary ON TermDictionary (TermId)")
    
    cur.execute("DROP TABLE IF EXISTS Posting")
    cur.execute("DROP INDEX IF EXISTS idxPosting1")
    cur.execute("DROP INDEX IF EXISTS idxPosting2")
    cur.execute("CREATE TABLE IF NOT EXISTS Posting (TermId INT, DocId INT, tfidf REAL, docfreq INT, termfreq INT)")
    cur.execute("CREATE INDEX IF NOT EXISTS idxPosting1 ON Posting (TermId)")
    cur.execute("CREATE INDEX IF NOT EXISTS idxPosting2 ON Posting (DocId)")
    
    walkdir(cur, folder)
    
    t2 = time.localtime()
    print(f"Indexing Complete, write to disk: {t2.tm_hour:02d}:{t2.tm_min:02d}")
    
    for term, term_obj in database.items():
        cur.execute("INSERT INTO TermDictionary VALUES (?, ?)", (term, term_obj.termid))
        for doc_id, freq in term_obj.docids.items():
            cur.execute("INSERT INTO Posting VALUES (?, ?, ?, ?, ?)", 
                        (term_obj.termid, doc_id, 0, term_obj.docs, freq))
    
    print("The content of TermDictionary table are as follows:")
    cur.execute("SELECT * FROM TermDictionary")
    print(cur.fetchall())
    
    con.commit()
    con.close()
    
    print(f"Documents: {documents}")
    print(f"Terms: {terms}")
    print(f"Tokens: {tokens}")
    
    t2 = time.localtime()
    print(f"End Time: {t2.tm_hour:02d}:{t2.tm_min:02d}")