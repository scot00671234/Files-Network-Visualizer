import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const initDb = async () => {
    const schemaPath = path.join(__dirname, '../../schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Initializing Database API...');
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(schemaSql);
            await client.query('COMMIT');
            console.log('Database Initialized Successfully.');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Database Initialization Failed:', e);
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Error connecting to database:", err);
    }
};
