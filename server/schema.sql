CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT, -- Link to the original PDF/Source
    source_type TEXT -- 'flight_log', 'court_doc', 'black_book'
);

CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'person', 'organization', 'location'
    aliases TEXT[], -- Array of alternate names
    normalized_name TEXT GENERATED ALWAYS AS (lower(name)) STORED,
    external_id TEXT, -- e.g., 'littlesis:36043'
    UNIQUE(normalized_name)
);

CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    relationship_type TEXT, -- 'flight_passenger', 'co_occurrence', 'associate'
    confidence FLOAT DEFAULT 1.0, -- 1.0 for flight logs, <1.0 for NLP extraction
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    metadata JSONB -- Specific details (flight date, page number)
);

CREATE INDEX IF NOT EXISTS idx_nodes_normalized_name ON nodes(normalized_name);
CREATE INDEX IF NOT EXISTS idx_nodes_external_id ON nodes(external_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
