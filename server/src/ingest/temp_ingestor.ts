import axios from 'axios';
import { query } from '../db';

const LITTLESIS_API = 'https://littlesis.org/api';

interface LittleSisEntity {
    id: number;
    attributes: {
        id: number;
        name: string;
        blurb: string | null;
        types: string[];
        primary_ext: string;
    };
}

interface LittleSisRelationship {
    id: number;
    attributes: {
        id: number;
        description1: string; // Description from perspective of entity1
        description2: string; // Description from perspective of entity2
        category_id: number;
    };
    links: {
        entity1: string; // URL to entity1
        entity2: string; // URL to entity2
    };
}

// Map LittleSis categories to our edge types if possible, or just use description
// For now, we'll use the description string.

export async function ingestLittleSis(rootEntityId: number = 36043) {
    console.log(`Starting ingestion for LittleSis entity ${rootEntityId}...`);

    try {
        // 1. Fetch Root Entity
        const rootRes = await axios.get(`${LITTLESIS_API}/entities/${rootEntityId}`);
        const rootEntity = rootRes.data.data;
        await upsertNode(rootEntity);

        // 2. Fetch Relationships
        // LittleSis paginates. 
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            console.log(`Fetching relationships page ${page}...`);
            const relsRes = await axios.get(`${LITTLESIS_API}/entities/${rootEntityId}/relationships`, {
                params: { page }
            });

            const relationships = relsRes.data.data;
            const meta = relsRes.data.meta;

            for (const rel of relationships) {
                await processRelationship(rootEntity.id, rel);
            }

            if (page >= meta.pageCount) {
                hasMore = false;
            } else {
                page++;
            }
            // Be nice to the API
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('Ingestion complete.');

    } catch (error) {
        console.error('Ingestion failed:', error);
    }
}

async function upsertNode(entity: LittleSisEntity) {
    const { id, attributes } = entity;
    const type = attributes.primary_ext === 'Person' ? 'person' : 'organization';

    await query(
        `INSERT INTO nodes (name, type, aliases) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (normalized_name) DO UPDATE SET type = EXCLUDED.type
         RETURNING id`,
        [attributes.name, type, [attributes.name]] // Initialize alias with name
    );
    // Note: We might want to store the LittleSis ID in metadata later.
}

async function processRelationship(rootId: number, rel: any) {
    // rel.attributes contains description
    // rel.links.entity1 and entity2 contain the URLs. We need to parse IDs.

    // Check which one is the "other" entity
    const id1 = parseInt(rel.links.entity1.split('/').pop() || '0');
    const id2 = parseInt(rel.links.entity2.split('/').pop() || '0');

    const otherId = id1 === rootId ? id2 : id1;

    // We need to fetch the "other" entity details to get its name if we don't have it.
    // LittleSis relationship response "included" might have it, or we fetch it.
    // Actually, usually graph APIs include the related node summary. 
    // Let's check LittleSis response structure more carefully. 
    // For now, we'll fetch the individual entity if it's not in the 'included' section?
    // Doing N+1 fetches is bad. 
    // LittleSis response structure usually includes "included" array with entity data.

    // Let's assume we need to fetch it for now, but valid optimizations exist.
    // To avoid rate limits, maybe we just use the name if available?
    // Actually, let's look at the `rel` object again. It usually links to the entity.

    // Better strategy: 
    // Fetch the detailed entity ONLY if we haven't seen it. 
    // But we need the name to insert into `nodes`.

    try {
        const otherEntityRes = await axios.get(`${LITTLESIS_API}/entities/${otherId}`);
        const otherEntity = otherEntityRes.data.data;
        await upsertNode(otherEntity);

        const desc = id1 === rootId ? rel.attributes.description1 : rel.attributes.description2;

        // Find database IDs for nodes
        const rootDbRes = await query(`SELECT id FROM nodes WHERE normalized_name = lower($1)`, [id1 === rootId ? "Jeffrey Epstein" : otherEntity.attributes.name]); // This is shaky if name changed.
        // Better: Store external ID.
        // I will add external_id to schema.sql to make this robust.
    } catch (e) {
        console.error(`Failed to process related entity ${otherId}:`, e);
    }
}
