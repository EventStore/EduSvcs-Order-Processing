import { Hono } from 'hono';
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { requestId } from 'hono/request-id'
import order_router from './OrderRouter';
import inventory_router from './InventoryRouter';
import { AppContext } from './AppContext';
import { Clock } from '@js-joda/core';
import { EventStoreDBClient } from '@eventstore/db-client';
import { compose } from './Models/CompositionRoot';
import { serve } from '@hono/node-server';

const app = new Hono<{ Variables: AppContext }>();

const clock = Clock.systemUTC();

const root = compose(clock);

const client =  new EventStoreDBClient(
    { endpoint: `localhost:2113`, throwOnAppendFailure: true },
    { insecure: true },
    { username: "admin", password: "changeit" }
);

root.OrderPersistentSubscriber.create_if_not_exists(client);
root.InventoryPersistentSubscriber.create_if_not_exists(client);
root.ProcessOrderSubscriber.create_if_not_exists(client);

root.OrderPersistentSubscriber.subscribe(client);
root.InventoryPersistentSubscriber.subscribe(client);
root.ProcessOrderSubscriber.subscribe(client);

app.use(logger())
app.use(prettyJSON())
app.use('*', requestId())

app.use(async (c, next) => {
    c.set("root", root);
    c.set("clock", clock);
    c.set("client", client);
    await next();
});

app.route("/orders", order_router);
app.route("/inventory", inventory_router);

serve(app)