import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { PlaceOrder } from "./Models/Order";
import { AppContext } from "./AppContext";

const app = new Hono<{ Variables: AppContext }>();

app.post(":id/place", 
    zValidator(
        'json',
        z.object({
            from_cart_id: z.string(),
            customer_id: z.string(),
            items: z.array(z.object({
                product_id: z.string(),
                quantity: z.number(),
                unitPrice: z.string()
            }))
        })
    ),
    async (c) => {
    const order_id = c.req.param("id");
    const order_body = c.req.valid("json");
    const command : PlaceOrder = {
        _named: "PlaceOrder",
        order_id: order_id,
        from_cart_id: order_body.from_cart_id,
        customer_id: order_body.customer_id,
        items: []
    };
    for (let index = 0; index < order_body.items.length; index++) {
        const item = order_body.items[index];
        command.items.push({
            line_item_id: index.toString(),
            product_id: item.product_id,
            quantity: item.quantity,
            unitPrice: item.unitPrice
        });   
    }

    const envelope = {
        message_id: c.get('requestId'),
        correlation_id: c.get('requestId'),
        body: command
    };

    const [events, append_result] = await c.var.root.OrderHandler.handle(c.var.client, envelope);

    if (append_result.success) {
        c.status(200);
        c.res.headers.append("X-ES-NextExpectedVersion", append_result.nextExpectedRevision.toString());
        return c.json(events);
    } else {
        c.status(409);
        return c.text(`Could not place order ${order_id}`);
    }    
});

export default app;