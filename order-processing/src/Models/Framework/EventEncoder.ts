import { JSONEventType, RecordedEvent } from "@eventstore/db-client";
import { Option } from "fp-ts/lib/Option";

export interface EventEncoder<Event> {
    encode(decoded: Event): JSONEventType;
    tryDecode(encoded: RecordedEvent<JSONEventType>): Option<Event>;
}