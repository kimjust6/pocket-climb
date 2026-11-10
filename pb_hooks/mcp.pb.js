/// <reference path="../pb_data/types.d.ts" />

/**
 * Model Context Protocol (MCP) Server for PocketBase
 * Based on pbjsmcp (https://github.com/benallfree/pbjsmcp, discussion https://ganigeorgiev.com/pocketbase/discussions/8365)
 *
 * Implements MCP Streamable HTTP transport (stateless JSON-RPC 2.0).
 * Requires superuser authentication via Bearer token ($apis.requireSuperuserAuth()).
 */

const handleMcpPost = (e) => {
    const { createMcpServer, pocketbaseTools } = require(`${__hooks}/pbjsmcp/index.js`);
    const { updateClimbsFromOpenBeta } = require(`${__hooks}/pages/utils/pocket.js`);

    const climbTools = [
        {
            name: "update_climbs_from_openbeta",
            description: "Synchronize/update climbs from OpenBeta (https://api.openbeta.io/) with the fewest HTTP requests possible (via GraphQL area batching).",
            inputSchema: {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        enum: ["areas", "catalog"],
                        description: "Sync mode: 'areas' (default, updates local crags in database) or 'catalog' (paginates global OpenBeta leaf areas)",
                    },
                    batchSize: {
                        type: "number",
                        description: "Number of areas per GraphQL request (default: 50 for areas, 100 for catalog)",
                    },
                    limit: {
                        type: "number",
                        description: "Max number of areas to process (0 = all)",
                    },
                    offset: {
                        type: "number",
                        description: "Starting offset for batching",
                    },
                    dryRun: {
                        type: "boolean",
                        description: "If true, simulates without writing to the database",
                    },
                    areaUuid: {
                        type: "string",
                        description: "Optional specific area UUID to update",
                    },
                },
            },
            handler: ({ args }) => updateClimbsFromOpenBeta(args),
        },
    ];

    return createMcpServer({
        name: "pocket-climb",
        version: "1.0.0",
        instructions: "MCP server for PocketBase managing pocket-climb (PocketPages + PocketBase). Use pb_* tools for database operations and update_climbs_from_openbeta for climbing route synchronization.",
        tools: [
            ...pocketbaseTools(),
            ...climbTools,
        ],
    }).handle(e);
};

const handleMcpGet = (e) => e.json(405, { message: "Method Not Allowed. Use POST for MCP JSON-RPC 2.0 requests." });

routerAdd("POST", "/mcp", handleMcpPost, $apis.requireSuperuserAuth());
routerAdd("GET", "/mcp", handleMcpGet);
routerAdd("POST", "/api/mcp", handleMcpPost, $apis.requireSuperuserAuth());
routerAdd("GET", "/api/mcp", handleMcpGet);

