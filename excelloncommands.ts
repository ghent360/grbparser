import { ExcellonParseException, ExcellonCommand } from "./primitives";

/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2018
 * 
 * License: MIT License, see LICENSE.txt
 */

 /**
 * This file contains classes that implement functionality for
 * the individual excellon commands.
 * 
 * Each command class would parse the command from the input text and construct one or more
 * primitives which hold the command data in consumable form.
 * 
 * Each command class would be able to construct a well formatted text representation of
 * the command suitable for output in a gerber file.
 * 
 * Note that in the input text the command separators are stipped by the command tokenizer.
 */

export class CommentCommand implements ExcellonCommand {
    private static matchExp = /^;.*$/;
    private comment:string;
    readonly name = "Comment";

    constructor(cmd:string, readonly lineNo?:number) {
        if (cmd[0] != ';') {
            throw new ExcellonParseException(`Invalid comment command ${cmd}`);
        }
        this.comment = cmd.substr(1);
    }

    formatOutput():string {
        return ';' + this.comment;
    }
}

export class BaseGCodeCommand {
    readonly codeId:number;
    private static matchExp = /^G(\d+)$/;

    constructor(cmd:string, cmdCode?:number, readonly lineNo?:number) {
        let match = BaseGCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid G command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        if (cmdCode != undefined && this.codeId != cmdCode) {
            throw new ExcellonParseException(
                `G code mismatch expected ${cmdCode} got ${this.codeId}`);
        }
    }

    formatOutput():string {
        let result = "G";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }
}

export class G05Command extends BaseGCodeCommand implements ExcellonCommand {
    readonly name = "G05";
    constructor(cmd:string, lineNo?:number) {
        super(cmd, 5, lineNo);
    }
}

export class BaseMCodeCommand {
    readonly codeId:number;
    private static matchExp = /^M(\d+)$/;

    constructor(cmd:string, cmdCode?:number, readonly lineNo?:number) {
        let match = BaseMCodeCommand.matchExp.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid M command format ${cmd}`);
        }
        this.codeId = Number.parseInt(match[1]);
        if (cmdCode != undefined && this.codeId != cmdCode) {
            throw new ExcellonParseException(
                `M code mismatch expected ${cmdCode} got ${this.codeId}`);
        }
    }

    formatOutput():string {
        let result = "M";
        if (this.codeId < 10) {
            result += "0";
        }
        result += this.codeId;
        return result;
    }
}

export class M48Command extends BaseMCodeCommand implements ExcellonCommand {
    readonly name = "M48";
    constructor(cmd:string, lineNo?:number) {
        super(cmd, 48, lineNo);
    }
}

export class M72Command extends BaseMCodeCommand implements ExcellonCommand {
    readonly name = "M72";
    constructor(cmd:string, lineNo?:number) {
        super(cmd, 72, lineNo);
    }
}

export class M71Command extends BaseMCodeCommand implements ExcellonCommand {
    readonly name = "M71";
    constructor(cmd:string, lineNo?:number) {
        super(cmd, 71, lineNo);
    }
}

export class CommaCommandBase implements ExcellonCommand {
    values:Array<string>;
    name:string;

    constructor(cmd:string, readonly lineNo?:number) {
        let parts = cmd.split(',');
        this.name = parts[0];
        parts.splice(0, 1);
        this.values = parts;
    }

    formatOutput():string {
        let result = this.name;
        this.values.forEach(v => result = result + "," + v);
        return result;
    }
}

export class ResetCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'R') {
            throw new ExcellonParseException(`Invalid R command ${cmd}`);
        }
    }
}

export class AxisVersionCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'VER') {
            throw new ExcellonParseException(`Invalid VER command ${cmd}`);
        }
    }
}

export class FileFormatCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'FMAT') {
            throw new ExcellonParseException(`Invalid FMAT command ${cmd}`);
        }
    }
}

export class UnitsCommand extends CommaCommandBase {
    constructor(cmd:string, readonly lineNo?:number) {
        super(cmd, lineNo);
        if (this.name != 'INCH' && this.name != 'METRIC') {
            throw new ExcellonParseException(`Invalid units command ${cmd}`);
        }
    }
}

interface Modifier {
    readonly code:string;
    readonly value:number;
}

class ToolPost {
    constructor(readonly start:number, readonly end?:number) {
    }

    isRange() {
        return this.end && this.end != this.start;
    }

    toString():string {
        if (this.isRange()) {
            return this.start + "," + this.end;
        }
        return this.start.toString();
    }
}

const numChars = '+-.0123456789';

function parseMods(mods:string):Array<Modifier> {
    let result = [];
    while (mods.length > 0) {
        let code = mods[0];
        let idx:number;
        for (idx = 1; idx < mods.length; idx++) {
            if (numChars.indexOf(mods[idx]) < 0) {
                break;
            }
        }
        if (idx == 1) {
            throw new ExcellonParseException(`Invalid modifier ${mods}`);
        }
        let valueStr = mods.substr(1, idx - 1);
        result.push({code:code, value:Number.parseFloat(valueStr)});
        mods = mods.substr(idx);
    }
    return result;
}

export class ToolDefinitionCommand implements ExcellonCommand {
    readonly name = 'T';
    readonly tool:ToolPost;
    readonly modifiers:Array<Modifier>;

    private static match = /^T(\d+(?:,\d+)?)((?:[BSFCDHZUNI](?:[+\-])?(?:\d*)(?:\.\d*)?)+)$/;
    private static toolMatch = /^(\d+)(?:,(\d+))?$/;

    constructor(cmd:string, readonly lineNo?:number) {
        let match = ToolDefinitionCommand.match.exec(cmd);
        if (!match) {
            throw new ExcellonParseException(`Invalid tool definition command ${cmd}`);
        }
        let tool = ToolDefinitionCommand.toolMatch.exec(match[1]);
        if (!tool) {
            throw new ExcellonParseException(`Invalid tool definition command ${cmd}`);
        }
        let toolStart = Number.parseInt(tool[1]);
        let toolEnd = tool.length > 2 ? Number.parseInt(tool[2]) : undefined;
        this.tool = new ToolPost(toolStart, toolEnd);
        if (match.length > 2) {
            this.modifiers = parseMods(match[2]);
        }
    }

    formatOutput():string {
        let result = "T" + this.tool.toString();
        this.modifiers.forEach(m => result += m.code + m.value);
        return result;
    }
}

export class EndOfHeaderCommand implements ExcellonCommand {
    readonly name = "%";

    constructor(cmd:string, readonly lineNo?:number) {
        if (cmd != '%') {
            throw new ExcellonParseException(`Invalid end of header command ${cmd}`);
        }
    }

    formatOutput():string {
        return '%';
    }
}

