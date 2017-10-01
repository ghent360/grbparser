import {GerberState} from "./primitives";

export class CommandParser {
    public lineNumber = 1;
    private nextTokenSeparator = '*';
    private consumer:(cmd:string, line:number) => void = CommandParser.emptyConsumer;
    private commandLineStart:number;
    private command = "";
    private errorHandler:(line:number, buffer:string, idx:number) => void = CommandParser.error;

    parseBlock(buffer:string) {
        let idx:number;
        for(idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.lineNumber++;
                continue;
            } else if (nextChar == '\r') {
                continue;
            } else if (nextChar == this.nextTokenSeparator) {
                //console.log(`cmd: ${this.command}`);
                this.consumer(this.command, this.commandLineStart);
                this.command = "";
                this.nextTokenSeparator = '*';
                continue;
            } else if (nextChar == '%') {
                if (this.command.trim().length != 0) {
                    console.log(`Error, what to do with '${this.command}?'`);
                }
                this.command = "";
                this.nextTokenSeparator = '%';
            } else {
                this.append(nextChar);
            }
        }
    }

    private append(chr:string) {
        if (this.command.length == 0) {
            this.commandLineStart = this.lineNumber;
        }
        this.command += chr;
    }

    private static error(lineNumber:number, buffer:string, idx:number) {
        console.log(`Error at line ${lineNumber}`);
        console.log(`   ${buffer}`);
        console.log(`---${'-'.repeat(idx + 1)}^`);
    }

    private static emptyConsumer(cmd:string, line:number) {
    }

    pushConsumer(consumer:(cmd:string, lineNo:number) => void) {
        this.consumer = consumer;
    }

    setErrorHandler(handler:(lineNumber:number, buffer:string, idx:number)=>void)
        : (lineNumber:number, buffer:string, idx:number)=>void {
        let old = this.errorHandler;
        this.errorHandler = handler;
        return old;
    }
}

export class GerberParser {
    private commandParser:CommandParser = new CommandParser();
    private state:GerberState = new GerberState();

    constructor() {
        this.commandParser.pushConsumer((cmd:string, lineNo:number) => this.parseCommand(cmd, lineNo));
    }

    parseBlock(block:string) {
        this.commandParser.parseBlock(block);
    }

    private parseCommand(cmd:string, lineNo:number) {
        this.state.setLineNo(lineNo);
    }
}
