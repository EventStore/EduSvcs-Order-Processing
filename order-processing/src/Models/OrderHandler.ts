import { AppendResult, EventStoreDBClient } from "@eventstore/db-client";
import { order, OrderCommand, OrderEvent } from "./Order";
import { readFromStream, appendToStream } from "./Framework/EventStream";
import { Envelope } from "./Framework/Envelope";
import { Clock } from "@js-joda/core";
import { JsonEventEncoder } from "./Framework/JsonEventEncoder";

export class OrderHandler {
    private readonly order;
    private readonly encoder: JsonEventEncoder<OrderEvent>;

    constructor(clock: Clock)
    {
        this.order = order(clock);
        this.encoder = new JsonEventEncoder<OrderEvent>();
    }

    async handle(client: EventStoreDBClient, command: Envelope<OrderCommand>) : Promise<[OrderEvent[], AppendResult]> {
        const stream = "order-system:order:" + command.body.order_id;
        const [state, revision] = await readFromStream(client, stream, this.order.initialState(), this.order.evolve, this.encoder);
        const events = this.order.decide(command.body, state);
        const append_result = await appendToStream(client, stream, revision, command.message_id, command.correlation_id, events, this.encoder);
        return [events, append_result];
    }
}

