import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { AppContext } from "./AppContext";
import { BulkReceiveItemsIntoInventory } from "./Models/Inventory";

const app = new Hono<{ Variables: AppContext }>();

app.post("bulk-receive", 
    zValidator(
        'json',
        z.object({
            items: z.array(z.object({
                sku: z.string(),
                quantity: z.number()
            }))
        })
    ),
    async (c) => {
    const inventory_body = c.req.valid("json");
    const command : BulkReceiveItemsIntoInventory = {
        _named: "BulkReceiveItemsIntoInventory",
        ...inventory_body
    };

    const envelope = {
        message_id: c.get('requestId'),
        correlation_id: c.get('requestId'),
        body: command
    };

    const [events, append_result] = await c.var.root.InventoryHandler.handle(c.var.client, envelope);

    if (append_result.success) {
        c.status(200);
        c.res.headers.append("X-ES-NextExpectedVersion", append_result.nextExpectedRevision.toString());
        return c.json(events);
    } else {
        c.status(409);
        return c.text(`Could not bulk receive into inventory`);
    }    
});

export default app;