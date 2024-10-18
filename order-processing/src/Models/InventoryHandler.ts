import { AppendResult, EventStoreDBClient } from "@eventstore/db-client";
import { inventory, InventoryCommand, InventoryEvent } from "./Inventory";
import { readFromStream, appendToStream } from "./Framework/EventStream";
import { Envelope } from "./Framework/Envelope";
import { Clock } from "@js-joda/core";
import { JsonEventEncoder } from "./Framework/JsonEventEncoder";

export class InventoryHandler {
    private readonly stream;
    private readonly inventory;
    private readonly encoder: JsonEventEncoder<InventoryEvent>;

    constructor(clock: Clock)
    {
        this.stream = "inventory-system:" + clock.instant().atZone(clock.zone()).year();
        this.inventory = inventory(clock);
        this.encoder = new JsonEventEncoder<InventoryEvent>();
    }

    async handle(client: EventStoreDBClient, command: Envelope<InventoryCommand>) : Promise<[InventoryEvent[], AppendResult]> {
        const [state, revision] = await readFromStream(client, this.stream, this.inventory.initialState(), this.inventory.evolve, this.encoder);
        const events = this.inventory.decide(command.body, state);
        const append_result = await appendToStream(client, this.stream, revision, command.message_id, command.correlation_id, events, this.encoder);
        return [events, append_result];
    }
}

