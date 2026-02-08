import axios from 'axios';
import { query } from '../db';

const LITTLESIS_API = 'https://littlesis.org/api';

export async function ingestLittleSis(rootEntityId: number = 36043) {
    console.log(`Starting LittleSis ingestion for entity ${rootEntityId}...`);

    try {
        // 1. Fetch Root Entity details to ensure we have the main node correct
        console.log("Fetching root entity details...");
        const rootRes = await axios.get(`${LITTLESIS_API}/entities/${rootEntityId}`);
        const rootEntity = rootRes.data.data;
        await upsertNode(rootEntity.id, rootEntity.attributes.name, rootEntity.attributes.primary_ext);

        // 2. Fetch Relationships
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            console.log(`Fetching relationships page ${page}...`);
            try {
                const relsRes = await axios.get(`${LITTLESIS_API}/entities/${rootEntityId}/relationships`, {
                    params: { page }
                });

                const relationships = relsRes.data.data;
                const meta = relsRes.data.meta;

                for (const rel of relationships) {
                    await processRelationship(rootEntityId, rel);
                }

                if (page >= meta.pageCount) {
                    hasMore = false;
                } else {
                    page++;
                }
                // Rate limit friendliness
                await new Promise(r => setTimeout(r, 200));
            } catch (err: any) { // Type assertion for catch block
                console.error(`Error fetching page ${page}:`, err.message);
                hasMore = false;
            }
        }

        console.log('Ingestion complete.');

    } catch (error) {
        console.error('Ingestion failed:', error);
    }
}

async function upsertNode(externalId: number, name: string, typeRaw: string) {
    const type = typeRaw.toLowerCase().includes('org') || typeRaw.toLowerCase().includes('business') ? 'organization' : 'person';
    const extIdStr = `littlesis:${externalId}`;

    // Simple name cleanup
    const cleanName = name.replace(/_/g, ' ');

    await query(
        `INSERT INTO nodes (name, type, aliases, external_id) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (normalized_name) DO UPDATE SET 
            external_id = EXCLUDED.external_id,
            type = EXCLUDED.type
         RETURNING id`,
        [cleanName, type, [cleanName], extIdStr]
    );
}

async function processRelationship(rootId: number, rel: any) {
    // Extract info from rel.links
    // entity: "https://littlesis.org/person/462098-Stephen_Halper"
    // related: "https://littlesis.org/person/36043-Jeffrey_Epstein"

    // Determine which is "other"
    const url1 = rel.links.entity;
    const url2 = rel.links.related;

    // Parse ID and Name from URL
    const parseUrl = (url: string) => {
        const parts = url.split('/');
        const segment = parts[parts.length - 1]; // "462098-Stephen_Halper"
        const dashIndex = segment.indexOf('-');
        const id = parseInt(segment.substring(0, dashIndex));
        const name = segment.substring(dashIndex + 1).replace(/_/g, ' ');
        // Determine type from URL path component? .../person/... or .../org/...
        const typeRaw = parts[parts.length - 2] === 'org' ? 'Organization' : 'Person';
        return { id, name, typeRaw };
    };

    const ent1 = parseUrl(url1);
    const ent2 = parseUrl(url2);

    const other = ent1.id === rootId ? ent2 : ent1;

    // Upsert the other node
    await upsertNode(other.id, other.name, other.typeRaw);

    // Insert Edge
    // We need internal database IDs.
    const getDbId = async (extId: number) => {
        const res = await query(`SELECT id FROM nodes WHERE external_id = $1`, [`littlesis:${extId}`]);
        return res.rows[0]?.id;
    };

    const sourceDbId = await getDbId(rootId);
    const targetDbId = await getDbId(other.id);

    if (sourceDbId && targetDbId) {
        await query(
            `INSERT INTO edges (source_node_id, target_node_id, relationship_type, confidence, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [sourceDbId, targetDbId, rel.attributes.description || 'connected', 1.0, { littlesis_id: rel.id }]
        );
    }
}
