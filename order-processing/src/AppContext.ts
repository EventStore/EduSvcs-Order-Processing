import { EventStoreDBClient } from "@eventstore/db-client";
import { Clock } from "@js-joda/core";
import { CompositionRoot } from "./Models/CompositionRoot";

export type AppContext = { root: CompositionRoot, clock: Clock, client: EventStoreDBClient };