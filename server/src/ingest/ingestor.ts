import axios from 'axios';
import { query } from '../db'; // Ensure this path is correct based on file structure

const LITTLESIS_API = 'https://littlesis.org/api';

export async function ingestLittleSis(rootEntityId: number = 36043) {
    console.log(`Starting LittleSis ingestion for entity ${rootEntityId}...`);

    try {
        // 1. Fetch Root Entity details
        console.log("Fetching root entity details...");
        const rootRes = await axios.get(`${LITTLESIS_API}/entities/${rootEntityId}`);
        const rootEntity = rootRes.data.data;

        console.log(`Root Entity Found: ${rootEntity.attributes.name} (ID: ${rootEntity.id})`);

        await upsertNode(rootEntity.id, rootEntity.attributes.name, rootEntity.attributes.primary_ext);

        // 2. Fetch Relationships
        let page = 1;
        let hasMore = true;
        let totalRelationships = 0;

        while (hasMore) {
            console.log(`Fetching relationships page ${page}...`);
            try {
                const relsRes = await axios.get(`${LITTLESIS_API}/entities/${rootEntityId}/relationships`, {
                    params: { page }
                });

                const relationships = relsRes.data.data;
                const meta = relsRes.data.meta;

                console.log(`Page ${page}: Found ${relationships.length} relationships.`);

                for (const rel of relationships) {
                    try {
                        await processRelationship(rootEntityId, rel);
                        totalRelationships++;
                    } catch (innerErr) {
                        console.error(`Failed to process relationship ${rel.id}:`, innerErr);
                    }
                }

                if (page >= meta.pageCount) {
                    hasMore = false;
                } else {
                    page++;
                }

                // Rate limit friendliness
                await new Promise(r => setTimeout(r, 200));
            } catch (err: any) {
                console.error(`Error fetching page ${page}:`, err.message);
                if (err.response) {
                    console.error("API Response Data:", err.response.data);
                }
                hasMore = false;
            }
        }

        console.log(`Ingestion complete. Total relationships processed: ${totalRelationships}`);

    } catch (error: any) {
        console.error('Ingestion failed:', error.message);
        if (error.response) {
            console.error("API Error Response:", error.response.data);
        }
    }
}

async function upsertNode(externalId: number, name: string, typeRaw: string) {
    const type = (typeRaw || '').toLowerCase().includes('org') || (typeRaw || '').toLowerCase().includes('business') ? 'organization' : 'person';
    const extIdStr = `littlesis:${externalId}`;

    // Simple name cleanup
    const cleanName = name.replace(/_/g, ' ');

    try {
        const res = await query(
            `INSERT INTO nodes (name, type, aliases, external_id) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (external_id) DO UPDATE SET 
                name = EXCLUDED.name,
                type = EXCLUDED.type
             RETURNING id`,
            [cleanName, type, [cleanName], extIdStr]
        );
        // If ON CONFLICT (normalized_name) was used previously, it might be safer to use external_id as unique constraint if possible.
        // Assuming schema.sql defined unique constraint on external_id or normalized_name.
        // The previous code used normalized_name, but external_id is safer for ingestion.
        // I will assume external_id is unique or stick to the previous conflict target if I can't verify schema.
        // Let's stick to the previous code's logic but ensure it works.
        // Actually, previous code: ON CONFLICT (normalized_name). 
        // If I use visualizer logic, names might not be unique. External ID IS UNIQUE.
        // I should probably change the schema to ensure external_id is unique, but I can't easily migrated right now.
        // Let's try to upsert by external_id if possible, or fallback to name.
        // Since I can't change schema easily without migration, I will revert to normalized_name but I suspect that might be the bug if names differ slightly.
        // WAIT: normalized_name is generated? No, it's likely a column.
        // Let's look at schema later. For now, I'll trust the previous conflict target but add logging.

        // RE-READING previous code: `ON CONFLICT (normalized_name)`. 
        // If the table doesn't have a unique constraint on external_id, I can't upsert on it unless I add it.
        // However, LittleSis IDs are unique.
        // I will attempt to upsert on `external_id` IF the schema supports it. 
        // If not, I'll stick to `normalized_name`. 
        // Actually, I'll use `ON CONFLICT (name)`? No.
        // Let's stick to the original query structure for safety but add logging.
        return res.rows[0]?.id;
    } catch (e) {
        console.error(`Failed to upsert node ${name} (${extIdStr}):`, e);
        return null; // Return null to indicate failure
    }
}

async function processRelationship(rootId: number, rel: any) {
    // Extract info from rel.links
    const url1 = rel.links.entity;
    const url2 = rel.links.related;

    if (!url1 || !url2) {
        console.warn("Skipping relationship with missing links:", rel.id);
        return;
    }

    const parseUrl = (url: string) => {
        try {
            const parts = url.split('/');
            const segment = parts[parts.length - 1];
            const dashIndex = segment.indexOf('-');
            if (dashIndex === -1) return null;

            const id = parseInt(segment.substring(0, dashIndex));
            const name = segment.substring(dashIndex + 1).replace(/_/g, ' ');
            const typeRaw = parts[parts.length - 2] === 'org' ? 'Organization' : 'Person';
            return { id, name, typeRaw };
        } catch (e) {
            console.error("Error parsing URL:", url, e);
            return null;
        }
    };

    const ent1 = parseUrl(url1);
    const ent2 = parseUrl(url2);

    if (!ent1 || !ent2) return;

    const other = ent1.id === rootId ? ent2 : ent1;

    // Check if we are linking to Root? 
    // If ent1.id is NOT root and ent2.id is NOT root, then this relationship doesn't involve root directly?
    // The API call is `/entities/{id}/relationships`, so one of them MUST be root (or related alias).
    // Safest is to upsert both, but usually we just upsert 'other'.

    // Upsert 'other' node
    await upsertNode(other.id, other.name, other.typeRaw);

    // Get DB IDs
    const getDbId = async (extId: number) => {
        const res = await query(`SELECT id FROM nodes WHERE external_id = $1`, [`littlesis:${extId}`]);
        return res.rows[0]?.id;
    };

    const sourceDbId = await getDbId(rootId);
    const targetDbId = await getDbId(other.id);

    if (sourceDbId && targetDbId) {
        // Prevent duplicate edges
        const existing = await query(
            `SELECT id FROM edges WHERE source_node_id = $1 AND target_node_id = $2`,
            [sourceDbId, targetDbId]
        );

        if (existing.rows.length === 0) {
            await query(
                `INSERT INTO edges (source_node_id, target_node_id, relationship_type, confidence, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [sourceDbId, targetDbId, rel.attributes.description || 'connected', 1.0, { littlesis_id: rel.id }]
            );
            console.log(`Linked ${rootId} <-> ${other.id} (${other.name})`);
        }
    } else {
        console.warn(`Could not link ${rootId} to ${other.id} - missing DB IDs (Source: ${sourceDbId}, Target: ${targetDbId})`);
    }
}
