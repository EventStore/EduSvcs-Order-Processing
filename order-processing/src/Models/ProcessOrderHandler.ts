import { AppendResult, EventStoreDBClient } from "@eventstore/db-client";
import { readFromStream, appendToStream } from "./Framework/EventStream";
import { WorkflowEvent, translate } from "./Framework/Workflow";
import { Envelope } from "./Framework/Envelope";
import { JsonWorkflowEventEncoder } from "./Framework/JsonWorkflowEventEncoder";
import { ProcessOrderInput, ProcessOrderOutput, process_order } from "./ProcessOrder";
import { JsonEventEncoder } from "./Framework/JsonEventEncoder";

export class ProcessOrderHandler {
    private process_order;
    private encoder: JsonWorkflowEventEncoder<ProcessOrderInput, ProcessOrderOutput>;

    constructor() {
        this.process_order = process_order();
        this.encoder = new JsonWorkflowEventEncoder<ProcessOrderInput, ProcessOrderOutput>(
            new JsonEventEncoder<ProcessOrderInput>(),
            new JsonEventEncoder<ProcessOrderOutput>()
        );
    }

    async handle(client: EventStoreDBClient, input: Envelope<ProcessOrderInput>): Promise<[WorkflowEvent<ProcessOrderInput, ProcessOrderOutput>[], AppendResult]> {
        const stream = "order-system:process-order:" + input.correlation_id;
        const [state, revision] = await readFromStream(client, stream, this.process_order.initialState(), this.process_order.evolve, this.encoder);
        const commands = this.process_order.decide(input.body, state);
        const events = translate(revision === BigInt(-1), input.body, commands);
        const append_result = await appendToStream(client, stream, revision, input.message_id, input.correlation_id, events, this.encoder);
        return [events, append_result];
    }
}

