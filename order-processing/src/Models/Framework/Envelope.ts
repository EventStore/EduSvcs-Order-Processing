export type Envelope<Body> = {
    message_id: string,
    correlation_id: string,
    body: Body
}