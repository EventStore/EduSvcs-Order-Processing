import { JSONEventType, RecordedEvent } from "@eventstore/db-client";
import { Option, fromNullable } from "fp-ts/lib/Option";
import { EventEncoder } from "./EventEncoder";

function convertToKebabCase(input: string) {
    return input
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        ?.map((x) => x.toLowerCase())
        .join("-") ?? input;
}

export class JsonEventEncoder<Message extends { _named: string; }> implements EventEncoder<Message> {
    encode(decoded: Message): JSONEventType {
        return {
            type: convertToKebabCase(decoded._named),
            data: decoded
        };
    }
    tryDecode(encoded: RecordedEvent<JSONEventType>): Option<Message> {
        const decoded = encoded.data as Message;
        return fromNullable(decoded);
    }
}


