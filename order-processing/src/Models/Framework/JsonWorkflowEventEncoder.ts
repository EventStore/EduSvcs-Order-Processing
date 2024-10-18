import { JSONEventType, JSONType, RecordedEvent } from "@eventstore/db-client";
import { EventEncoder } from "./EventEncoder";
import { WorkflowEvent } from "./Workflow";
import { Option, some, none } from "fp-ts/lib/Option";

function convertToKebabCase(input: string) {
    return input
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        ?.map((x) => x.toLowerCase())
        .join("-") ?? input;
}

export class JsonWorkflowEventEncoder<Input extends { "_named": string }, Output extends { "_named": string }> implements EventEncoder<WorkflowEvent<Input, Output>> {
    private input_encoder : EventEncoder<Input>;
    private output_encoder : EventEncoder<Output>;

    constructor(input_encoder: EventEncoder<Input>, output_encoder: EventEncoder<Output>) {
        this.input_encoder = input_encoder;
        this.output_encoder = output_encoder;
    }

    encode(decoded: WorkflowEvent<Input, Output>): JSONEventType {
        let result : JSONEventType;
        switch (decoded._named) {
            case "began":
                result = {
                    type: "began",
                    data: {}
                }
                break;
            case "received":
                const encoded_input = this.input_encoder.encode(decoded.data);
                result = {
                    type: `received.${convertToKebabCase(decoded.data._named)}`,
                    data: encoded_input.data
                }
                break;
            case "sent":
                const encoded_output = this.output_encoder.encode(decoded.data);
                result = {
                    type: `sent.${convertToKebabCase(decoded.data._named)}`,
                    data: encoded_output.data
                }
                break;
            case "completed":
                result = {
                    type: "completed",
                    data: {}
                }
                break;
        }
        return result;
    }

    tryDecode(encoded: RecordedEvent<JSONEventType>): Option<WorkflowEvent<Input, Output>> {
        let result : Option<WorkflowEvent<Input, Output>> = none;
        const [workflow_event_type] = encoded.type.split(".") ?? [];
        switch (workflow_event_type) {
            case "began":
                result = some({ _named: "began" });
                break;
            case "received":
                const decoded_received = this.input_encoder.tryDecode(encoded);
                switch (decoded_received._tag) {
                    case "Some":
                        result = some({ 
                            _named: "received",
                            data: decoded_received.value
                        });
                        break;
                    default:
                        result = none;
                        break;
                }
                break;
            case "sent":
                const decoded_sent = this.output_encoder.tryDecode(encoded);
                switch (decoded_sent._tag) {
                    case "Some":
                        result = some({ 
                            _named: "sent",
                            data: decoded_sent.value
                        });
                        break;
                    default:
                        result = none;
                        break;
                }
                break;
            case "completed":
                result = some({ _named: "completed" });
                break;
        }
        return result;
    }
}