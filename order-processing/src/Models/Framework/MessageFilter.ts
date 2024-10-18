import { RegexFilter } from "@eventstore/db-client";

export class MessageFilter {
    private readonly messages: string[];

    constructor(messages: string[]) {
        this.messages = messages;
    }

    getRegularExpression(): string {
        return `^${this.messages.join("$|^")}$`;
    }

    toServerFilter(checkpointInterval: number): RegexFilter {
        return {
            checkpointInterval: checkpointInterval,
            filterOn: "eventType",
            regex: this.getRegularExpression()
        };
    }
}