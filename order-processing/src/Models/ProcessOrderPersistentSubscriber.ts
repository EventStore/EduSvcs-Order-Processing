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
import { ProcessOrderInput } from "./ProcessOrder";
import { JsonEventEncoder } from "./Framework/JsonEventEncoder";
import { ProcessOrderHandler } from "./ProcessOrderHandler";

class Subscriber implements AsyncDisposable {
    private readonly name: string;
    private readonly client: EventStoreDBClient;
    private readonly subscription: PersistentSubscriptionToAll;
    private readonly handler: ProcessOrderHandler;
    private readonly consumer: Promise<void>;
    private readonly encoder: EventEncoder<ProcessOrderInput>;
    
    constructor(name: string, client: EventStoreDBClient, subscription: PersistentSubscriptionToAll) {
        this.name = name;
        this.client = client;
        this.subscription = subscription;
        this.handler = new ProcessOrderHandler();
        this.encoder = new JsonEventEncoder<ProcessOrderInput>();
        this.consumer = this.consume();
    }
    
    async consume() {
        console.log(`Consuming a persistent subscription called ${this.name}`);
        for await (const event of this.subscription) {
            try {
                console.log(`${this.name} received an event ${event.event?.type} from stream ${event.event?.streamId}@${event.event?.revision}`);
                if (event.event && event.event.isJson) {
                    const input = this.encoder.tryDecode(event.event);
                    switch (input._tag) {
                        case "Some":
                            let correlation_id = event.event.id;
                            if (event.event.metadata) {
                                const metadata_record = event.event.metadata as Record<string | number, unknown>;
                                if (metadata_record && metadata_record["$correlationId"]) {
                                    correlation_id = metadata_record["$correlationId"] as string;
                                }
                            }
                            const envelope: Envelope<ProcessOrderInput> = {
                                message_id: event.event.id,
                                correlation_id: correlation_id,
                                body: input.value
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

export class ProcessOrderPersistentSubscriber {
    private readonly name: string;
    private readonly input_filter: MessageFilter;

    constructor(name: string) {
        this.name = name;
        this.input_filter = new MessageFilter([ "order-placed", "bulk-reserve-items-from-inventory-succeeded", "bulk-reserve-items-from-inventory-failed" ]);
    }

    async create_if_not_exists(client: EventStoreDBClient): Promise<void> {
        const options: CreatePersistentSubscriptionToAllOptions = {
            filter: this.input_filter.toServerFilter(1000)
        };

        console.log(`Setting up a persistent subscriber ${this.name} for a workflow with filter expression ${this.input_filter.getRegularExpression()}`);

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
        return new Subscriber(this.name, client, subscription);
    }
}



