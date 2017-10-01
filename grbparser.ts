
export class CommandParser {
    public lineNumber = 1;
    private nextTokenSeparator = '*';
    private leftoverBuffer = "";
    private consumerStack:Array<(cmd:string, line:number) => void> = [];
    private commandLineStart:number;
    private command = "";

    public parseBlock(block:string) {
        let buffer = this.leftoverBuffer + block;
        let idx:number;
        this.leftoverBuffer = "";
        for(idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.lineNumber++;
                continue;
            } else if (nextChar == '\r') {
                continue;
            } else if (nextChar == '\\') {
                if (buffer.length - idx < 6) {
                    this.leftoverBuffer = buffer.substring(idx);
                    break;
                }
                if (buffer[idx + 1] != 'u') {
                    this.error(this.lineNumber, buffer, idx);
                    idx++;
                    continue;
                }
                let hexCode = buffer.substring(idx + 2, idx + 6);
                let unicodeChar = String.fromCharCode(Number.parseInt(hexCode, 16));
                this.append(unicodeChar);
                idx += 5;
                continue;
            } else if (nextChar == this.nextTokenSeparator) {
                //console.log(`cmd: ${this.command}`);
                this.consumerStack[this.consumerStack.length - 1](this.command, this.commandLineStart);
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

    private error(lineNumber:number, buffer:string, idx:number) {
        console.log(`Error at line ${lineNumber}`);
        console.log(`   ${buffer}`);
        console.log(`---${'-'.repeat(idx + 1)}^`);
    }

    public pushConsumer(consumer:(cmd:string, lineNo:number) => void) {
        this.consumerStack.push(consumer);
    }

    public popConsumer() {
        this.consumerStack.pop();
    }
}