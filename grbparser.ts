import {
    GerberState,
    GerberCommand,
    CoordinateFormatSpec,
    GerberParseException} from "./primitives";
import * as cmds from "./commands";

/**
 * This is an internal class to "tokenize" the gerber commands from the stream.
 * 
 * It would remove all \n \r and \t from the stream and call a "consumer" for each
 * complete command found in the stream.
 * 
 * The input can be partial buffer.
 */
export class CommandParser {
    public lineNumber = 1;
    private nextTokenSeparator = '*';
    private consumer:(cmd:string, line:number, isAdvanced:boolean) => void
        = CommandParser.emptyConsumer;
    private commandLineStart:number;
    private command = "";
    private errorHandler:(line:number, buffer:string, idx:number) => void
        = CommandParser.consoleError;
    private static gCodeSplit = /^(G\d+)(.*D\d+)$/;
    private static g04Match = /^G0*4$/;
    private static dCmdMatch = /^([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?([XYIJ][\+\-]?\d+)?(D\d+)$/;
    private static coordinatesOrder = "XYIJ";

    parseBlock(buffer:string) {
        let idx:number;
        for(idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.lineNumber++;
                continue;
            } else if (nextChar == '\r') {
                continue;
            } else if (nextChar == '\t') {
                continue;
            } else if (nextChar == this.nextTokenSeparator) {
                //console.log(`cmd: ${this.command}`);
                this.commandPreprocessor();
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

    private static consoleError(lineNumber:number, buffer:string, idx:number) {
        console.log(`Error at line ${lineNumber}`);
        console.log(`   ${buffer}`);
        console.log(`---${'-'.repeat(idx + 1)}^`);
    }

    private static emptyConsumer(cmd:string, line:number) {
    }

    setConsumer(consumer:(cmd:string, lineNo:number, isAdvanced:boolean) => void)
        :(cmd:string, lineNo:number, isAdvanced:boolean) => void {
        let oldValue = this.consumer;
        this.consumer = consumer;
        return oldValue;
    }

    setErrorHandler(handler:(lineNumber:number, buffer:string, idx:number)=>void)
        : (lineNumber:number, buffer:string, idx:number)=>void {
        let old = this.errorHandler;
        this.errorHandler = handler;
        return old;
    }

    private commandPreprocessor() {
        let isAdvanced = this.nextTokenSeparator == '%';
        let cmd = this.command;
        if (!isAdvanced) {
            // Look for Gxx.....Dxx command
            // we would split it to Gxx*; ....Dxx*
            let match = CommandParser.gCodeSplit.exec(cmd);
            if (match) {
                let gCodeCmd = match[1];
                // Except G04 comment which ends in Dxx
                if (!CommandParser.g04Match.test(gCodeCmd)) {
                    let dCmd = match[2];
                    this.consumer(gCodeCmd, this.commandLineStart, false);
                    this.consumer(CommandParser.orderDoperation(dCmd), this.commandLineStart, false);
                    return;
                }
            }
        } else {
            // Some advanced commands can be combined together as per
            // the old spec. See if we have to split them apart.
            if (!cmd.startsWith("AM") && cmd.indexOf("*") != cmd.lastIndexOf("*")) {
                let parts = cmd.split("*").slice(0, -1);
                for (let part of parts) {
                    this.consumer(part + "*", this.commandLineStart, true);
                }
                return;
            }
        }
        this.consumer(CommandParser.orderDoperation(cmd), this.commandLineStart, isAdvanced);
    }

    private static coordinatePosition(coordinate:string):number {
        if (coordinate == undefined) {
            return 99;
        }
        return CommandParser.coordinatesOrder.indexOf(coordinate[0]);
    }

    /**
     * Sometimes we receive D operation where the coordinates are out of order
     * for example Y123X567D03. We convert it to X567Y123D03.
     * @param cmd input command
     */
    private static orderDoperation(cmd:string):string {
        let match = CommandParser.dCmdMatch.exec(cmd);
        if (!match) {
            return cmd;
        }
        let coordinateParts = match.slice(1, 5).sort((a, b) => {
            return CommandParser.coordinatePosition(a)
                - CommandParser.coordinatePosition(b);
        });
        let dcode = match[5];
        let result = "";
        for (let c of coordinateParts) {
            if (c != undefined) {
                result += c;
            }
        }
        result += dcode;
        return result;
    }
}

class ParserCommand {
    constructor(readonly cmd:GerberCommand, readonly lineNo:number) {
    }
}

/**
 * The main gerber parser class.
 * 
 * Usage TBD.
 */
export class GerberParser {
    private commandParser:CommandParser = new CommandParser();
    private fmt:CoordinateFormatSpec;
    private commandDispatcher:Array<[RegExp, (cmd:string) => GerberCommand]> = [
        [/^FS/, (cmd) => new cmds.FSCommand(cmd)],
        [/^MO/, (cmd) => new cmds.MOCommand(cmd)],
        [/^ADD/, (cmd) => new cmds.ADCommand(cmd)],
        [/^AM/, (cmd) => new cmds.AMCommand(cmd)],
        [/^AB/, (cmd) => new cmds.ABCommand(cmd)],
        [/^G[0]*4/, (cmd) => new cmds.G04Command(cmd)],
        [/D[0]*1$/, (cmd) => new cmds.D01Command(cmd, this.fmt)],
        [/D[0]*2$/, (cmd) => new cmds.D02Command(cmd, this.fmt)],
        [/D[0]*3$/, (cmd) => new cmds.D03Command(cmd, this.fmt)],
        [/^D(\d+)$/, (cmd) => new cmds.DCommand(cmd)],
        [/^G[0]*1$/, (cmd) => new cmds.G01Command(cmd)],
        [/^G[0]*2$/, (cmd) => new cmds.G02Command(cmd)],
        [/^G[0]*3$/, (cmd) => new cmds.G03Command(cmd)],
        [/^G[0]*36$/, (cmd) => new cmds.G36Command(cmd)],
        [/^G[0]*37$/, (cmd) => new cmds.G37Command(cmd)],
        [/^G[0]*74$/, (cmd) => new cmds.G74Command(cmd)],
        [/^G[0]*75$/, (cmd) => new cmds.G75Command(cmd)],
        [/^LP/, (cmd) => new cmds.LPCommand(cmd)],
        [/^LM/, (cmd) => new cmds.LMCommand(cmd)],
        [/^LR/, (cmd) => new cmds.LRCommand(cmd)],
        [/^LS/, (cmd) => new cmds.LSCommand(cmd)],
        [/^SR/, (cmd) => new cmds.SRCommand(cmd)],
        [/^M02/, (cmd) => new cmds.M02Command(cmd)],
        [/^T(A|F|O)/, (cmd) => new cmds.TCommand(cmd)],
        [/^TD/, (cmd) => new cmds.TDCommand(cmd)],
        [/^IP(?:POS|NEG)\*$/, null],
        [/^LN(?:.+)/, null],
        [/^IJ(?:.+)/, null],
        [/^IO(?:.+)/, null],
        [/^IR(?:.+)/, null],
        [/^AS(?:.+)/, null],
        [/^KO(?:.+)/, null],
        [/^MI(?:.+)/, null],
        [/^OF(?:.+)/, null],
        [/^RO(?:.+)/, null],
        [/^SF(?:.+)/, null],
        [/^G54$/, null],
        [/^G70$/, null],
        [/^G71$/, null],
        [/^G90$/, null],
        [/^G91$/, null]
    ];
    private commands:Array<ParserCommand> = [];

    constructor() {
        this.commandParser.setConsumer((cmd:string, lineNo:number) => this.parseCommand(cmd, lineNo));
    }

    parseBlock(block:string) {
        this.commandParser.parseBlock(block);
    }

    private parseCommand(cmd:string, lineNo:number) {
        try {
            let dispatcher = this.commandDispatcher.find(d => d[0].test(cmd));
            if (dispatcher == undefined) {
                throw new GerberParseException(`Invalid command ${cmd}`);
            }
            if (dispatcher[1] == null) {
                console.log(`WARNING: ignoring ${cmd}`);
                return;
            }
            let command = dispatcher[1](cmd);
            this.commands.push(new ParserCommand(command, lineNo));
            if (command.name === "FS") {
                let fsCmd = command as cmds.FSCommand;
                if (this.fmt != undefined) {
                    throw new GerberParseException("Format is already defined");
                }
                this.fmt = fsCmd.coordinateFormat;
            }
        } catch (e) {
            console.log(`Error parsing gerber file at line ${lineNo}.`);
            console.log(`Offending command: ${cmd}`);
            console.log(`Error: ${e}`);
            throw e;
        }
    }

    public output():string {
        let result = "";
        for (let parseCommand of this.commands) {
            let cmd = parseCommand.cmd;
            let cmdString = cmd.formatOutput(this.fmt);
            if (cmd.isAdvanced) {
                result += "%" + cmdString + "%";
            } else {
                result += cmdString + "*";
            }
            result += "\n";
        }
        return result;
    }
}
