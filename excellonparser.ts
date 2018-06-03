/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 * 
 * License: MIT License, see LICENSE.txt
 */

 import {
    CoordinateFormatSpec,
    ExcellonCommand,
    ExcellonParseException} from "./primitives";
import * as cmds from "./excelloncommands";

/**
 * This is an internal class to "tokenize" the excellon commands from the stream.
 * 
 * It would remove all \n \r and \t from the stream and call a "consumer" for each
 * complete command found in the stream.
 * 
 * The input can be partial buffer.
 */
export class CommandParser {
    public lineNumber = 1;
    private consumer:(cmd:string, line:number) => void
        = CommandParser.emptyConsumer;
    private commandLineStart:number;
    private command = "";
    private errorHandler:(line:number, buffer:string, idx:number) => void
        = CommandParser.consoleError;

    parseBlock(buffer:string) {
        let idx:number;
        for(idx = 0; idx < buffer.length; idx++) {
            let nextChar = buffer[idx];
            if (nextChar == '\n') {
                this.commandPreprocessor();
                this.command = "";
                this.lineNumber++;
                continue;
            } else if (nextChar == '\r') {
                continue;
            } else if (nextChar == '\t') {
                nextChar = ' ';
            } else {
                this.append(nextChar);
            }
        }
    }

    public flush() {
        if (this.command.length > 0) {
            this.commandPreprocessor();
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

    setConsumer(consumer:(cmd:string, lineNo:number) => void)
        :(cmd:string, lineNo:number) => void {
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
        let cmd = this.command;
        this.consumer(cmd, this.commandLineStart);
    }

}

class ParserCommand {
    constructor(readonly cmd:ExcellonCommand, readonly lineNo:number) {
    }
}

interface Parslet {
    exp:RegExp;
    cb:(cmd:string, lineNo:number) => ExcellonCommand;
}

/**
 * The main excellon parser class.
 * 
 * Usage TBD.
 */
export class ExcellonParser {
    private commandParser:CommandParser = new CommandParser();
    private fmt:CoordinateFormatSpec;

    // Order in this array is important, because some regex are more broad
    // and would detect previous commands.
    private commandDispatcher:Array<Parslet> = [
        {exp:/^M48$/, cb: (cmd, lineNo) => new cmds.M48Command(cmd, lineNo)},
        {exp:/^;.*/, cb: (cmd, lineNo) => new cmds.CommentCommand(cmd, lineNo)},
        {exp:/^R,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^VER,.*/, cb: (cmd, lineNo) => new cmds.AxisVersionCommand(cmd, lineNo)},
        {exp:/^FMAT,.*/, cb: (cmd, lineNo) => new cmds.FileFormatCommand(cmd, lineNo)},
        {exp:/^INCH,.*/, cb: (cmd, lineNo) => new cmds.UnitsCommand(cmd, lineNo)},
        {exp:/^METRIC,.*/, cb: (cmd, lineNo) => new cmds.UnitsCommand(cmd, lineNo)},
        {exp:/^BLKD,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^SBK,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^SG,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^TCST,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^ICI,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^OSTOP,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^RSB,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^ATC,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^FSB,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {
            exp:/^T(\d+(?:,\d+)?)((?:[BSFCDHZUNI](?:[+\-])?(?:\d*)(?:\.\d*)?)+)$/, 
            cb: (cmd, lineNo) => new cmds.ToolDefinitionCommand(cmd, lineNo)
        },
        {exp:/^%$/, cb: (cmd, lineNo) => new cmds.EndOfHeaderCommand(cmd, lineNo)},
        {exp:/^M47,.*/, cb: (cmd, lineNo) => new cmds.CommaCommandBase(cmd, lineNo)},
        {exp:/^G0*5$/, cb: (cmd, lineNo) => new cmds.G05Command(cmd, lineNo)},
        {exp:/^M71$/, cb: (cmd, lineNo) => new cmds.M71Command(cmd, lineNo)},
        {exp:/^M72$/, cb: (cmd, lineNo) => new cmds.M72Command(cmd, lineNo)},
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
            let dispatcher = this.commandDispatcher.find(d => d.exp.test(cmd));
            if (dispatcher == undefined) {
                throw new ExcellonParseException(`Invalid command ${cmd.substr(0, 100)}`);
            }
            if (dispatcher.cb == null) {
                //console.log(`WARNING: ignoring ${cmd}`);
                return;
            }
            let command = dispatcher.cb(cmd, lineNo);
            this.commands.push(new ParserCommand(command, lineNo));
            console.log(`Cmd: '${cmd}', '${command.formatOutput(null)}'`);
        } catch (e) {
            console.log(`Error parsing excellon file at line ${lineNo}.`);
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
            result += cmdString;
            result += "\n";
        }
        return result;
    }

    /*
    public execute(ctx:GerberState) {
        for (let parseCommand of this.commands) {
            parseCommand.cmd.execute(ctx);
        }
    }
    */
}
