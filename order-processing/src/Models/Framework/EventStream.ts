import {
    AppendResult,
    EventStoreDBClient,
    FORWARDS,
    jsonEvent, 
    START, 
    StreamNotFoundError
} from "@eventstore/db-client";
import { v4 as uuidv4 } from "uuid";
import { EventEncoder } from "./EventEncoder";

export async function readFromStream<State, Event>(
    client: EventStoreDBClient, 
    stream: string, 
    initialState: State, 
    evolve: (state: State, event: Event) => State, 
    encoder: EventEncoder<Event>) : Promise<[State, bigint]> {
    let state = initialState;
    let revision = BigInt(-1);
    let reader = client
        .readStream(
            stream,
            {
                direction: FORWARDS,
                fromRevision: START,
                resolveLinkTos: false
            });
    let event_count = 0;
    let folded_event_count = 0;
    try 
    {
        for await (const event of reader) {
            if(event.event && event.event.isJson) {
                folded_event_count++;
                const decoded = encoder.tryDecode(event.event);
                switch (decoded._tag) {
                    case "Some": 
                        state = evolve(state, decoded.value);
                        break;
                }
            }
            event_count++;
            revision = event.event!.revision;
        }
    } catch (e) {
        if (e instanceof StreamNotFoundError) {
            /* ignore */    
            console.log(`Stream ${stream} not found`);
        } else {
            throw e;
        }
        
    }
    console.log(`Read from stream ${stream} up to revision ${revision} and evolved the state into ${JSON.stringify(state)} with ${folded_event_count} folded events out of ${event_count} events read`);
    return [state, revision];
}

export async function appendToStream<Event>(
    client: EventStoreDBClient, 
    stream: string, 
    revision: bigint, 
    causation_id: string,
    correlation_id: string,
    events: Event[], 
    encoder: EventEncoder<Event>) : Promise<AppendResult> {
    const appendResult =
        await client.appendToStream(
            stream,
            events.map(event => {
                return {
                    ...jsonEvent(encoder.encode(event)),
                    id: uuidv4(), 
                    metadata: {
                        "$causationId": causation_id, 
                        "$correlationId": correlation_id
                    }
                };
            }),
            {
                expectedRevision: revision === BigInt(-1) ? "no_stream" : revision
            }
        );
    return appendResult;
}