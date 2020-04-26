/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

import {
    GerberState,
    GerberCommand,
    CoordinateFormatSpec,
    GerberParseException} from "./primitives";
import * as cmds from "./gerbercommands";

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
    private static gCodeSplit = /^(G\d+)((?:[XYIJ][\+\-]?\d+)*(?:D\d+)?)$/;
    private static gdmnCodeSplit = /^([GDMN]\d+)((?:[GDMN]\d+)+)$/;
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
            if (match && match[2]) {
                let gCodeCmd = match[1];
                // Except G04 comment which ends in Dxx
                if (!CommandParser.g04Match.test(gCodeCmd)) {
                    let dCmd = match[2];
                    this.consumer(gCodeCmd, this.commandLineStart, false);
                    this.consumer(CommandParser.orderDOperation(dCmd), this.commandLineStart, false);
                    return;
                }
            }
            do {
                match = CommandParser.gdmnCodeSplit.exec(cmd);
                if (!match) {
                    break;
                }
                let firstCmd = match[1];
                if (!CommandParser.g04Match.test(firstCmd)) {
                    cmd = match[2];
                    this.consumer(firstCmd, this.commandLineStart, false);
                }
            } while (cmd && cmd.length > 0);
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
        this.consumer(CommandParser.orderDOperation(cmd), this.commandLineStart, isAdvanced);
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
    private static orderDOperation(cmd:string):string {
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
    private lastDcmd:number = -1;

    // Order in this array is important, because some regex are more broad
    // and would detect previous commands.
    private commandDispatcher:Array<[RegExp, (cmd:string, lineNo:number) => GerberCommand]> = [
        [/^FS/, (cmd, lineNo:number) => new cmds.FSCommand(cmd, lineNo)],
        [/^MO/, (cmd, lineNo:number) => new cmds.MOCommand(cmd, lineNo)],
        [/^ADD/, (cmd, lineNo:number) => new cmds.ADCommand(cmd, lineNo)],
        [/^AM/, (cmd, lineNo:number) => new cmds.AMCommand(cmd, lineNo)],
        [/^AB/, (cmd, lineNo:number) => new cmds.ABCommand(cmd, lineNo)],
        [/^G[0]*4[^\d]/, (cmd, lineNo:number) => new cmds.G04Command(cmd, lineNo)],
        [/^G[0]*4$/, (cmd, lineNo:number) => new cmds.G04Command(cmd, lineNo)],
        [/D[0]*1$/, (cmd, lineNo:number) => {
            this.lastDcmd = 1;
            return new cmds.D01Command(cmd, this.fmt, lineNo);
        }],
        [/^(?:[XYIJ][\+\-]?\d+){1,4}$/, (cmd, lineNo:number) => {
            if (this.lastDcmd == 1) {
                return new cmds.D01Command(cmd, this.fmt, lineNo);
            } else if (this.lastDcmd == 2) {
                return new cmds.D02Command(cmd, this.fmt, lineNo);
            } else if (this.lastDcmd == 3) {
                return new cmds.D03Command(cmd, this.fmt, lineNo);
            }
            return null;
        }],
        [/D[0]*2$/, (cmd, lineNo:number) => {
            this.lastDcmd = 2;
            return new cmds.D02Command(cmd, this.fmt, lineNo);
        }],
        [/D[0]*3$/, (cmd, lineNo:number) => {
            this.lastDcmd = 3;
            return new cmds.D03Command(cmd, this.fmt, lineNo);
        }],
        [/^D(\d+)$/, (cmd, lineNo:number) => new cmds.DCommand(cmd, lineNo)],
        [/^G[0]*1$/, (cmd, lineNo:number) => new cmds.G01Command(cmd, lineNo)],
        [/^G[0]*2$/, (cmd, lineNo:number) => new cmds.G02Command(cmd, lineNo)],
        [/^G[0]*3$/, (cmd, lineNo:number) => new cmds.G03Command(cmd, lineNo)],
        [/^G[0]*10$/, (cmd, lineNo:number) => new cmds.G10Command(cmd, lineNo)],
        [/^G[0]*11$/, (cmd, lineNo:number) => new cmds.G11Command(cmd, lineNo)],
        [/^G[0]*12$/, (cmd, lineNo:number) => new cmds.G12Command(cmd, lineNo)],
        [/^G[0]*36$/, (cmd, lineNo:number) => new cmds.G36Command(cmd, lineNo)],
        [/^G[0]*37$/, (cmd, lineNo:number) => new cmds.G37Command(cmd, lineNo)],
        [/^G[0]*70$/, (cmd, lineNo:number) => new cmds.G70Command(cmd, lineNo)],
        [/^G[0]*71$/, (cmd, lineNo:number) => new cmds.G71Command(cmd, lineNo)],
        [/^G[0]*74$/, (cmd, lineNo:number) => new cmds.G74Command(cmd, lineNo)],
        [/^G[0]*75$/, (cmd, lineNo:number) => new cmds.G75Command(cmd, lineNo)],
        [/^G[0]*90$/, (cmd, lineNo:number) => new cmds.G90Command(cmd, lineNo)],
        [/^G[0]*91$/, (cmd, lineNo:number) => new cmds.G91Command(cmd, lineNo)],
        [/^LP/, (cmd, lineNo:number) => new cmds.LPCommand(cmd, lineNo)],
        [/^LM/, (cmd, lineNo:number) => new cmds.LMCommand(cmd, lineNo)],
        [/^LR/, (cmd, lineNo:number) => new cmds.LRCommand(cmd, lineNo)],
        [/^LS/, (cmd, lineNo:number) => new cmds.LSCommand(cmd, lineNo)],
        [/^SR/, (cmd, lineNo:number) => new cmds.SRCommand(cmd, lineNo)],
        [/^M0*[02]/, (cmd, lineNo:number) => new cmds.M02Command(cmd, lineNo)],
        [/^M0*1/, null],
        [/^T(A|F|O)/, (cmd, lineNo:number) => new cmds.TCommand(cmd, lineNo)],
        [/^TD/, (cmd, lineNo:number) => new cmds.TDCommand(cmd, lineNo)],
        [/^IP(?:POS|NEG)\*$/, null],
        [/^LN(?:.+)/, null],
        [/^IN.*\*$/, null],
        [/^ICAS\*$/, null],
        [/^IJ(?:.+)/, null],
        [/^IO(?:.+)/, null],
        [/^IR(?:.+)/, null],
        [/^AS(?:.+)/, null],
        [/^KO(?:.+)/, null],
        [/^MI(?:.+)/, null],
        [/^OF(?:.+)/, null],
        [/^RO(?:.+)/, null],
        [/^SF(?:.+)/, null],
        [/^G[0]*0$/, null], // Move
        [/^G[0]*54$/, null], // Prepare tool
        [/^G[0]*55$/, null]  // Prepare to flash
    ];
    private commands:Array<ParserCommand> = [];

    constructor() {
        this.commandParser.setConsumer((cmd:string, lineNo:number) => this.parseCommand(cmd, lineNo));
    }

    parseBlock(block:string) {
        this.commandParser.parseBlock(block);
    }

    private parseCommand(cmd:string, lineNo:number) {
        if (cmd.length == 0) {
            return;
        }
        try {
            let dispatcher = this.commandDispatcher.find(d => d[0].test(cmd));
            if (dispatcher == undefined) {
                throw new GerberParseException(`Invalid command ${cmd.substr(0, 100)}`);
            }
            if (dispatcher[1] == null) {
                //console.log(`WARNING: ignoring ${cmd}`);
                return;
            }
            let command = dispatcher[1](cmd, lineNo);
            this.commands.push(new ParserCommand(command, lineNo));
            if (command.name === "FS") {
                let fsCmd = command as cmds.FSCommand;
                if (this.fmt != undefined) {
                    //throw new GerberParseException("Format is already defined");
                    console.log("Format is already defined");
                }
                this.fmt = fsCmd.coordinateFormat;
            }
        } catch (e) {
            console.log(`Error parsing gerber file at line ${lineNo}.`);
            console.log(`Offending command: ${cmd.substr(0, 100)}`);
            console.log(`Message: ${e}`);
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

    public execute(ctx:GerberState) {
        for (let parseCommand of this.commands) {
            parseCommand.cmd.execute(ctx);
        }
    }
}
