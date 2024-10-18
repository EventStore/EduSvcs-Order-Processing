export type Began = { 
    _named: "began" 
};

export type Received<Input> = { 
    _named: "received",
    data: Input 
};

export type Sent<Output> = { 
    _named: "sent",
    data: Output
};

export type Completed = { 
    _named: "completed"
};

export type WorkflowEvent<Input, Output> = 
    | Began
    | Received<Input>
    | Sent<Output>
    | Completed;

export type Send<Output> = { 
    _named: "send",
    data: Output
};

export type Complete = { 
    _named: "complete"
};
export type WorkflowCommand<Output> =
    | Send<Output>
    | Complete;

export function translate<Input, Output>(begins: boolean, input: Input, outputs: WorkflowCommand<Output>[]) : WorkflowEvent<Input, Output>[] {
    let events : WorkflowEvent<Input, Output>[] = [];
    if(begins) {
        events.push({ _named: "began" });
    }
    events.push({ _named: "received", data: input });
    outputs.forEach(output => {
        switch(output._named) {
            case "send":
                events.push({ _named: "sent", data: output.data });
                break;
            case "complete":
                events.push({ _named: "completed" });
                break;
        }
    });
    return events;
}

