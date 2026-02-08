import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, query } from './db';
import { ingestLittleSis } from './ingest/ingestor';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// API Routes
app.get('/api/graph', async (req, res) => {
    try {
        const nodesRes = await query('SELECT * FROM nodes');
        const edgesRes = await query('SELECT * FROM edges');

        // Format for react-force-graph
        // It expects { nodes: [{id, ...}], links: [{source, target, ...}] }
        // Our edge source/target are IDs, which works for force-graph if nodes have matching IDs.

        res.json({
            nodes: nodesRes.rows,
            links: edgesRes.rows.map(e => ({
                source: e.source_node_id,
                target: e.target_node_id,
                ...e
            }))
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/node/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const nodeRes = await query('SELECT * FROM nodes WHERE id = $1', [id]);
        const edgesRes = await query(
            `SELECT e.*, n.name as target_name 
            FROM edges e 
            JOIN nodes n ON e.target_node_id = n.id 
            WHERE e.source_node_id = $1
            UNION
            SELECT e.*, n.name as target_name
            FROM edges e
            JOIN nodes n ON e.source_node_id = n.id
            WHERE e.target_node_id = $1`,
            [id]
        );
        res.json({ node: nodeRes.rows[0], edges: edgesRes.rows });
    } catch (e) {
        res.status(500).json({ error: 'Error fetching node details' });
    }
});

app.post('/api/ingest', async (req, res) => {
    // Manually trigger ingestion
    ingestLittleSis().then(() => console.log("Ingestion finished")).catch(e => console.error(e));
    res.json({ status: 'Ingestion started' });
});

const start = async () => {
    await initDb();

    // Auto-ingest if empty?
    try {
        const countRes = await query('SELECT count(*) FROM nodes');
        if (parseInt(countRes.rows[0].count) === 0) {
            console.log("Database empty. Starting auto-ingestion...");
            ingestLittleSis();
        }
    } catch (e) {
        console.error("Failed to check database count (db likely not init):", e);
    }

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
        const path = require('path');
        app.use(express.static(path.join(__dirname, '../../client/dist')));
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
        });
    }

    // Health Check for Dokploy
    app.get('/health', (req, res) => res.status(200).send('OK'));

    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
};

start();
