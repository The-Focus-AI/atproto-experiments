/**
 * CAR (Content Addressable aRchive) Parser for AT Protocol
 *
 * Uses browser-compatible IPLD libraries to parse CAR files
 * and extract AT Protocol records without Node.js dependencies.
 */

import { CarReader } from '@ipld/car';
import { decode as decodeCBOR } from '@ipld/dag-cbor';

/**
 * Parse a CAR file and extract all collection types
 * @param {Uint8Array} carData - The raw CAR file bytes
 * @returns {Promise<{collections: string[], totalRecords: number, totalBlocks: number}>}
 */
export async function scanCarForCollections(carData) {
    const reader = await CarReader.fromBytes(carData);

    const collections = new Set();
    let totalRecords = 0;
    let totalBlocks = 0;

    // Iterate through all blocks in the CAR file
    for await (const { cid, bytes } of reader.blocks()) {
        totalBlocks++;

        try {
            // Decode the CBOR block to a JavaScript object
            const record = decodeCBOR(bytes);

            // Check if this is an AT Protocol record (has $type field)
            if (record && typeof record === 'object' && record.$type) {
                collections.add(record.$type);
                totalRecords++;
            }
        } catch (error) {
            // Skip blocks that aren't records (commits, MST nodes, etc.)
            // This is expected and normal
        }
    }

    return {
        collections: Array.from(collections).sort(),
        totalRecords,
        totalBlocks,
        roots: (await reader.getRoots()).map(cid => cid.toString())
    };
}

/**
 * Parse a CAR file and extract all records organized by collection
 * @param {Uint8Array} carData - The raw CAR file bytes
 * @returns {Promise<{records: Object, stats: Object}>}
 */
export async function parseCarFile(carData) {
    const reader = await CarReader.fromBytes(carData);

    const records = {};
    let totalRecords = 0;
    let totalBlocks = 0;

    // Iterate through all blocks in the CAR file
    for await (const { cid, bytes } of reader.blocks()) {
        totalBlocks++;

        try {
            // Decode the CBOR block to a JavaScript object
            const record = decodeCBOR(bytes);

            // Check if this is an AT Protocol record (has $type field)
            if (record && typeof record === 'object' && record.$type) {
                const collectionType = record.$type;

                if (!records[collectionType]) {
                    records[collectionType] = [];
                }

                records[collectionType].push({
                    cid: cid.toString(),
                    ...record
                });

                totalRecords++;
            }
        } catch (error) {
            // Skip blocks that aren't records (commits, MST nodes, etc.)
        }
    }

    return {
        records,
        stats: {
            totalRecords,
            totalBlocks,
            collections: Object.keys(records).length,
            size: carData.byteLength,
            roots: (await reader.getRoots()).map(cid => cid.toString())
        }
    };
}
