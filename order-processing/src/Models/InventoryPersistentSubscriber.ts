import {
    CreatePersistentSubscriptionToAllOptions,
    EventStoreDBClient,
    PARK,
    PersistentSubscriptionExistsError,
    persistentSubscriptionToAllSettingsFromDefaults,
    PersistentSubscriptionToAll,
    WrongExpectedVersionError
} from "@eventstore/db-client";
import { Envelope } from "./Framework/Envelope";
import { EventEncoder } from "./Framework/EventEncoder";
import { MessageFilter } from "./Framework/MessageFilter";
import { InventoryHandler } from "./InventoryHandler";
import { InventoryCommand } from "./Inventory";
import { Clock } from "@js-joda/core";
import { JsonEventEncoder } from "./Framework/JsonEventEncoder";

class Subscriber implements AsyncDisposable {
    private readonly name: string;
    private readonly client: EventStoreDBClient;
    private readonly subscription: PersistentSubscriptionToAll;
    private readonly handler: InventoryHandler
    private readonly consumer: Promise<void>;
    private readonly encoder: EventEncoder<InventoryCommand>;

    constructor(
        name: string,
        client: EventStoreDBClient, 
        subscription: PersistentSubscriptionToAll,
        clock: Clock) {
        this.name = name;
        this.client = client;
        this.subscription = subscription;
        this.handler = new InventoryHandler(clock);
        this.encoder = new JsonEventEncoder<InventoryCommand>();
        this.consumer = this.consume();
    }

    async consume() {
        console.log(`Consuming a persistent subscription called ${this.name}`);
        for await (const event of this.subscription) {
            try {
                console.log(`${this.name} received an event ${event.event?.type} from stream ${event.event?.streamId}@${event.event?.revision}`);
                if (event.event && event.event.isJson) {
                    const command = this.encoder.tryDecode(event.event);
                    switch (command._tag) {
                        case "Some":
                            let correlation_id = event.event.id;
                            if (event.event.metadata) {
                                const metadata_record = event.event.metadata as Record<string | number, unknown>;
                                if (metadata_record && metadata_record["$correlationId"]) {
                                    correlation_id = metadata_record["$correlationId"] as string;
                                }
                            }
                            const envelope: Envelope<InventoryCommand> = {
                                message_id: event.event.id,
                                correlation_id: correlation_id,
                                body: command.value
                            }
                            await this.handler.handle(this.client, envelope);
                        break;
                    }
                }
                await this.subscription.ack(event);
            } catch (error) {
                if (error instanceof WrongExpectedVersionError) {
                    var wrong_expected_version_error = error as WrongExpectedVersionError;
                    console.error(`${this.name} failed to handle event ${event.event?.type} from stream ${event.event?.streamId}@${event.event?.revision} because \n`, wrong_expected_version_error);
                } else {
                    console.error(`${this.name} failed to handle event ${event.event?.type} from stream ${event.event?.streamId}@${event.event?.revision} because \n`, error);
                }
                await this.subscription.nack(PARK, error as string, event);
            }
        }
    }

    [Symbol.asyncDispose](): PromiseLike<void> {
        return this.subscription.unsubscribe();
    }
}

export class InventoryPersistentSubscriber {
    private readonly name: string;
    private readonly event_filter: MessageFilter;
    private readonly clock: Clock;

    constructor(name: string, clock: Clock) {
        this.name = name;
        this.clock = clock;
        this.event_filter = new MessageFilter([ "sent.bulk-reserve-items-from-inventory" ]);
    }

    async create_if_not_exists(client: EventStoreDBClient): Promise<void> {
        const options: CreatePersistentSubscriptionToAllOptions = {
            filter: this.event_filter.toServerFilter(1000)
        };
        console.log(`Setting up a persistent subscriber ${this.name} for a decider with filter expression ${this.event_filter.getRegularExpression()}`);
        try {
            await client.createPersistentSubscriptionToAll(this.name, persistentSubscriptionToAllSettingsFromDefaults({ startFrom: "start" }), options);
        } catch (e) {
            if (e instanceof PersistentSubscriptionExistsError) {
                // Ignore
            } else {
                throw e;
            }
        }
    }

    subscribe(client: EventStoreDBClient): AsyncDisposable {
        const subscription = client.subscribeToPersistentSubscriptionToAll(this.name);
        return new Subscriber(this.name, client, subscription, this.clock);
    }
}
